import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";

export async function POST(req: NextRequest) {
  const { name, email, password, company } = await req.json();

  if (!name || !email || !password || !company) {
    return NextResponse.json({ error: "Todos los campos son requeridos" }, { status: 400 });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (typeof email !== "string" || !emailRegex.test(email) || email.length > 255) {
    return NextResponse.json({ error: "Email inválido" }, { status: 400 });
  }

  const trimmedName = typeof name === "string" ? name.trim().slice(0, 100) : "";
  const trimmedCompany = typeof company === "string" ? company.trim().slice(0, 100) : "";
  if (!trimmedName || !trimmedCompany) {
    return NextResponse.json({ error: "Nombre y empresa son requeridos" }, { status: 400 });
  }

  if (typeof password !== "string" || password.length < 8) {
    return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres" }, { status: 400 });
  }

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Este email ya está registrado" }, { status: 409 });
  }

  const { hash } = await import("bcryptjs");
  const passwordHash = await hash(password, 12);

  const user = await db.user.create({
    data: {
      name: trimmedName,
      email,
      passwordHash,
      organization: {
        create: {
          name: trimmedCompany,
        },
      },
    },
    include: { organization: true },
  });

  await db.membership.create({
    data: {
      userId: user.id,
      organizationId: user.organization!.id,
      role: "ADMIN",
    },
  });

  return NextResponse.json({ id: user.id, email: user.email }, { status: 201 });
}
