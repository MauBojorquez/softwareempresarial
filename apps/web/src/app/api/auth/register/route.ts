import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";

export async function POST(req: NextRequest) {
  const { name, email, password, company } = await req.json();

  if (!name || !email || !password || !company) {
    return NextResponse.json({ error: "Todos los campos son requeridos" }, { status: 400 });
  }

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Este email ya está registrado" }, { status: 409 });
  }

  const { hash } = await import("bcryptjs");
  const passwordHash = await hash(password, 12);

  const user = await db.user.create({
    data: {
      name,
      email,
      passwordHash,
      organization: {
        create: {
          name: company,
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
