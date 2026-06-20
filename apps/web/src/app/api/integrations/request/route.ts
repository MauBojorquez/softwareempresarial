import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sendEmail } from "@/server/services/email";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = rateLimit(`integration-request:${ip}`, 5, 60_000);
  if (!rl.success) return NextResponse.json({ error: "Demasiadas solicitudes" }, { status: 429 });

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { message } = (await req.json()) as { message?: string };
  if (!message?.trim()) return NextResponse.json({ error: "Mensaje requerido" }, { status: 400 });

  const userName = session.user.name ?? session.user.email ?? "Usuario";
  const userEmail = session.user.email ?? "";

  await sendEmail(
    "maubojorquez@somosstratium.com",
    `🔌 Solicitud de integración — StratiuMetrics`,
    `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px;">
      <h2 style="color:#18181b;margin:0 0 8px;">Nueva solicitud de integración</h2>
      <p style="color:#71717a;font-size:14px;margin:0 0 24px;">Un usuario solicita una nueva integración en StratiuMetrics.</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr><td style="padding:8px 0;color:#71717a;width:120px;">Usuario</td><td style="padding:8px 0;color:#18181b;font-weight:600;">${userName}</td></tr>
        <tr><td style="padding:8px 0;color:#71717a;">Correo</td><td style="padding:8px 0;color:#18181b;">${userEmail}</td></tr>
      </table>
      <div style="margin-top:20px;padding:16px;background:#f4f4f5;border-radius:10px;">
        <p style="margin:0;color:#3f3f46;font-size:14px;line-height:1.6;white-space:pre-wrap;">${message.trim()}</p>
      </div>
    </div>`,
  );

  return NextResponse.json({ success: true });
}
