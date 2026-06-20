import { db } from "@/server/db";
import { decrypt } from "@/lib/sat-crypto";
import {
  buildService,
  createQuery,
  verifyRequest,
  downloadPackage,
  parsePackage,
  type ParsedCfdi,
} from "./nodecfdi-service";

interface MonthlyFinancials {
  period: Date; // first day of month
  ingresos: number;
  egresos: number;
  ivaCobrado: number;
  balance: number;
}

/** Groups parsed CFDIs by month and computes the four finance metrics. */
function groupByMonth(cfdis: ParsedCfdi[]): MonthlyFinancials[] {
  const map = new Map<string, MonthlyFinancials>();

  for (const c of cfdis) {
    if (!c.date) continue;
    const d = new Date(c.date);
    if (Number.isNaN(d.getTime())) continue;

    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    if (!map.has(key)) {
      map.set(key, {
        period: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)),
        ingresos: 0,
        egresos: 0,
        ivaCobrado: 0,
        balance: 0,
      });
    }
    const entry = map.get(key)!;

    if (c.type === "I") {
      entry.ingresos += c.total;
      entry.ivaCobrado += c.tax;
    } else if (c.type === "E") {
      entry.egresos += c.total;
    }
    entry.balance = entry.ingresos - entry.egresos;
  }

  return Array.from(map.values()).sort(
    (a, b) => a.period.getTime() - b.period.getTime(),
  );
}

/**
 * Builds a nodecfdi service from a stored (encrypted) credential.
 * Decrypted material is held only for the lifetime of this call.
 */
async function serviceForCredential(credential: {
  encryptedCer: string;
  encryptedKey: string;
  encryptedPassword: string;
}) {
  const cerBin = decrypt(credential.encryptedCer);
  const keyBin = decrypt(credential.encryptedKey);
  const password = decrypt(credential.encryptedPassword).toString("utf8");
  return buildService(cerBin, keyBin, password);
}

/**
 * Requests CFDIs (issued + received) for the last 3 months and records a
 * SatDownloadRequest per query with the SAT-returned request id.
 */
export async function startSatDownload(organizationId: string): Promise<void> {
  const credential = await db.satCredential.findUnique({
    where: { organizationId },
  });
  if (!credential) {
    throw new Error("No SAT credential found for this organization");
  }

  await db.satCredential.update({
    where: { organizationId },
    data: { syncStatus: "syncing", lastError: null },
  });

  try {
    const periodTo = new Date();
    const periodFrom = new Date();
    periodFrom.setMonth(periodFrom.getMonth() - 3);

    const { service } = await serviceForCredential(credential);

    const types: Array<"issued" | "received"> = ["issued", "received"];
    for (const downloadType of types) {
      const satRequestId = await createQuery(
        service,
        periodFrom,
        periodTo,
        downloadType,
      );
      await db.satDownloadRequest.create({
        data: {
          organizationId,
          satRequestId,
          downloadType,
          periodFrom,
          periodTo,
          status: "accepted",
        },
      });
    }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Error al solicitar al SAT";
    await db.satCredential.update({
      where: { organizationId },
      data: { syncStatus: "error", lastError: message },
    });
    throw err;
  }
}

async function recomputeMetrics(
  organizationId: string,
  cfdis: ParsedCfdi[],
): Promise<void> {
  const months = groupByMonth(cfdis);

  for (const month of months) {
    const baseData = {
      organizationId,
      category: "FINANCE" as const,
      source: "SAT" as const,
      unit: "MXN",
      period: month.period,
    };

    const upsertMetric = async (name: string, value: number) => {
      const existing = await db.metric.findFirst({
        where: { organizationId, name, period: month.period, source: "SAT" },
      });
      if (existing) {
        await db.metric.update({ where: { id: existing.id }, data: { value } });
      } else {
        await db.metric.create({ data: { ...baseData, name, value } });
      }
    };

    await Promise.all([
      upsertMetric("Ingresos", month.ingresos),
      upsertMetric("Egresos", month.egresos),
      upsertMetric("Balance Fiscal", month.balance),
      upsertMetric("IVA Cobrado", month.ivaCobrado),
    ]);
  }
}

/**
 * Polls non-terminal SatDownloadRequests, downloads finished packages, parses
 * CFDIs, and recomputes Metric rows per organization.
 *
 * If `organizationId` is given, only that org is processed; otherwise all orgs
 * with non-terminal requests are processed (cron use).
 */
export async function pollSatDownloads(organizationId?: string): Promise<void> {
  const requests = await db.satDownloadRequest.findMany({
    where: {
      status: { in: ["pending", "accepted", "finished"] },
      ...(organizationId ? { organizationId } : {}),
    },
  });

  // Group requests by organization.
  const byOrg = new Map<string, typeof requests>();
  for (const r of requests) {
    const list = byOrg.get(r.organizationId) ?? [];
    list.push(r);
    byOrg.set(r.organizationId, list);
  }

  for (const [orgId, orgRequests] of byOrg) {
    const credential = await db.satCredential.findUnique({
      where: { organizationId: orgId },
    });
    if (!credential) continue;

    let serviceBundle: Awaited<ReturnType<typeof serviceForCredential>>;
    try {
      serviceBundle = await serviceForCredential(credential);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "No se pudo abrir la e.firma";
      await db.satCredential.update({
        where: { organizationId: orgId },
        data: { syncStatus: "error", lastError: message },
      });
      continue;
    }

    const service = serviceBundle.service;
    let orgFailed = false;
    // Accumulate CFDIs parsed during this poll so we never download a package
    // more than once per run.
    const allCfdis: ParsedCfdi[] = [];
    const seenUuids = new Set<string>();

    const pushCfdis = (parsed: ParsedCfdi[]) => {
      for (const c of parsed) {
        if (c.uuid) {
          if (seenUuids.has(c.uuid)) continue;
          seenUuids.add(c.uuid);
        }
        allCfdis.push(c);
      }
    };

    for (const r of orgRequests) {
      if (!r.satRequestId) continue;
      try {
        const verify = await verifyRequest(service, r.satRequestId);

        if (verify.isFailure) {
          await db.satDownloadRequest.update({
            where: { id: r.id },
            data: {
              status: "failed",
              lastError: verify.statusName,
              attempts: r.attempts + 1,
              lastCheckedAt: new Date(),
            },
          });
          orgFailed = true;
          continue;
        }

        if (!verify.isFinished) {
          await db.satDownloadRequest.update({
            where: { id: r.id },
            data: {
              status: "accepted",
              attempts: r.attempts + 1,
              lastCheckedAt: new Date(),
            },
          });
          continue;
        }

        // Finished — store package ids, download & parse each package.
        await db.satDownloadRequest.update({
          where: { id: r.id },
          data: {
            status: "finished",
            packageIds: verify.packageIds,
            attempts: r.attempts + 1,
            lastCheckedAt: new Date(),
          },
        });

        for (const pkgId of verify.packageIds) {
          const zip = await downloadPackage(service, pkgId);
          pushCfdis(await parsePackage(zip));
        }

        await db.satDownloadRequest.update({
          where: { id: r.id },
          data: { status: "downloaded", lastCheckedAt: new Date() },
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Error al verificar/descargar";
        await db.satDownloadRequest.update({
          where: { id: r.id },
          data: {
            lastError: message,
            attempts: r.attempts + 1,
            lastCheckedAt: new Date(),
          },
        });
        orgFailed = true;
      }
    }

    // Pull in any previously-downloaded requests' packages so the recompute
    // reflects ALL data, not just what finished this poll.
    const priorDownloaded = await db.satDownloadRequest.findMany({
      where: { organizationId: orgId, status: "downloaded" },
    });
    const processedIds = new Set(orgRequests.map((r) => r.id));
    for (const req of priorDownloaded) {
      if (processedIds.has(req.id)) continue; // already parsed above
      for (const pkgId of req.packageIds) {
        try {
          const zip = await downloadPackage(service, pkgId);
          pushCfdis(await parsePackage(zip));
        } catch {
          // skip package; do not abort the whole recompute
        }
      }
    }

    if (allCfdis.length > 0) {
      await recomputeMetrics(orgId, allCfdis);
    }

    // Update credential status based on remaining non-terminal requests.
    const remaining = await db.satDownloadRequest.count({
      where: {
        organizationId: orgId,
        status: { in: ["pending", "accepted", "finished"] },
      },
    });

    if (orgFailed) {
      await db.satCredential.update({
        where: { organizationId: orgId },
        data: { syncStatus: "error" },
      });
    } else if (remaining === 0) {
      await db.satCredential.update({
        where: { organizationId: orgId },
        data: { syncStatus: "synced", lastSyncAt: new Date(), lastError: null },
      });
    }
  }
}
