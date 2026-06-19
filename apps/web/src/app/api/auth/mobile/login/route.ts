import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();

  if (!email || !password) {
    return NextResponse.json({ error: "Email y contraseña requeridos" }, { status: 400 });
  }

  // Throttle brute-force: 10 intentos por IP+email cada 15 min
  const ip = getClientIp(req);
  const rl = rateLimit(`mobile-login:${ip}:${String(email).toLowerCase()}`, 10, 15 * 60_000);
  if (!rl.success) {
    return NextResponse.json({ error: "Demasiados intentos. Espera unos minutos." }, { status: 429 });
  }

  const user = await db.user.findUnique({ where: { email } });

  if (!user?.passwordHash) {
    return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });
  }

  const token = jwt.sign(
    { userId: user.id, email: user.email },
    process.env.NEXTAUTH_SECRET!,
    { expiresIn: "30d" }
  );

  return NextResponse.json({ token, user: { id: user.id, name: user.name, email: user.email } });
}
