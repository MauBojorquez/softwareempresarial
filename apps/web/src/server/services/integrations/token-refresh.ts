import { db } from "@/server/db";

export async function refreshQuickBooksToken(organizationId: string) {
  const integration = await db.integration.findUnique({
    where: { organizationId_type: { organizationId, type: "QUICKBOOKS" } },
  });

  if (!integration?.refreshToken) throw new Error("No refresh token");

  const response = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${process.env.QUICKBOOKS_CLIENT_ID}:${process.env.QUICKBOOKS_CLIENT_SECRET}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: integration.refreshToken,
    }),
  });

  if (!response.ok) throw new Error("Failed to refresh QuickBooks token");

  const tokens = await response.json();

  await db.integration.update({
    where: { id: integration.id },
    data: {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    },
  });

  return tokens.access_token;
}

export async function refreshHubSpotToken(organizationId: string) {
  const integration = await db.integration.findUnique({
    where: { organizationId_type: { organizationId, type: "HUBSPOT" } },
  });

  if (!integration?.refreshToken) throw new Error("No refresh token");

  const response = await fetch("https://api.hubapi.com/oauth/v1/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: process.env.HUBSPOT_CLIENT_ID!,
      client_secret: process.env.HUBSPOT_CLIENT_SECRET!,
      refresh_token: integration.refreshToken,
    }),
  });

  if (!response.ok) throw new Error("Failed to refresh HubSpot token");

  const tokens = await response.json();

  await db.integration.update({
    where: { id: integration.id },
    data: {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    },
  });

  return tokens.access_token;
}

export async function ensureValidToken(organizationId: string, type: "QUICKBOOKS" | "HUBSPOT") {
  const integration = await db.integration.findUnique({
    where: { organizationId_type: { organizationId, type } },
  });

  if (!integration) throw new Error(`${type} integration not found`);

  if (integration.expiresAt && integration.expiresAt < new Date()) {
    if (type === "QUICKBOOKS") return refreshQuickBooksToken(organizationId);
    return refreshHubSpotToken(organizationId);
  }

  return integration.accessToken;
}
