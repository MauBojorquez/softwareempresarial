import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/server/db";
import { checkFeatureAccess, PLAN_LIMITS } from "@/server/services/billing/plan-limits";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const membership = await db.membership.findFirst({
    where: { userId: session.user.id },
    include: { organization: true },
  });

  if (!membership) {
    return NextResponse.json({ error: "No organization" }, { status: 404 });
  }

  const access = await checkFeatureAccess(membership.organizationId, "aiChatEnabled");
  if (!access.allowed) {
    return NextResponse.json({ error: access.reason }, { status: 403 });
  }

  const sub = await db.subscription.findUnique({
    where: { organizationId: membership.organizationId },
  });

  if (!sub) {
    return NextResponse.json({ error: "Suscripción requerida" }, { status: 403 });
  }

  const limits = PLAN_LIMITS[sub.plan];
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const todayMessages = await db.aIChatMessage.count({
    where: {
      organizationId: membership.organizationId,
      role: "user",
      createdAt: { gte: startOfDay },
    },
  }).catch(() => 0);

  if (todayMessages >= limits.aiChatMessagesPerDay) {
    return NextResponse.json({
      error: `Límite diario alcanzado (${limits.aiChatMessagesPerDay} mensajes). Actualiza tu plan para más.`,
    }, { status: 429 });
  }

  const body = await req.json();
  const { message, history = [] } = body;

  if (!message || typeof message !== "string" || message.trim().length === 0) {
    return NextResponse.json({ error: "Mensaje vacío" }, { status: 400 });
  }

  const trimmedMessage = message.trim().slice(0, 2000);

  try {
    const metrics = await db.metric.findMany({
      where: { organizationId: membership.organizationId },
      orderBy: { period: "desc" },
      take: 50,
    });

    const metricsContext = metrics.length > 0
      ? metrics.map((m) => `${m.name}: ${m.value}${m.unit ? ` ${m.unit}` : ""} (${m.category}, ${m.period.toISOString().split("T")[0]})`).join("\n")
      : "No hay métricas registradas aún.";

    const systemPrompt = `Eres un consultor empresarial experto de MetrixPro. Tu rol es ayudar a empresarios mexicanos a tomar mejores decisiones basadas en datos.

Contexto de la empresa:
- Nombre: ${membership.organization.name}
- Industria: ${membership.organization.industry || "No especificada"}

Métricas recientes del negocio:
${metricsContext}

Instrucciones:
- Responde siempre en español
- Sé conciso pero accionable — da recomendaciones específicas
- Usa los datos disponibles para fundamentar tus respuestas
- Si te preguntan algo fuera de negocios, redirige amablemente al contexto empresarial
- Formatea con markdown cuando ayude a la claridad
- No inventes datos — si no tienes la información, dilo
- Enfócate en: estrategia, finanzas, marketing, ventas, operaciones, recursos humanos`;

    const anthropic = new Anthropic();

    const messages = [
      ...history.slice(-10).map((h: any) => ({
        role: h.role as "user" | "assistant",
        content: h.content,
      })),
      { role: "user" as const, content: trimmedMessage },
    ];

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    });

    const reply = response.content[0]?.type === "text" ? response.content[0].text : "No pude generar una respuesta.";

    try {
      await db.aIChatMessage.createMany({
        data: [
          { organizationId: membership.organizationId, userId: session.user.id, role: "user", content: trimmedMessage },
          { organizationId: membership.organizationId, userId: session.user.id, role: "assistant", content: reply },
        ],
      });
    } catch {
      // table might not exist yet
    }

    return NextResponse.json({
      reply,
      remaining: limits.aiChatMessagesPerDay - todayMessages - 1,
    });
  } catch (err: any) {
    console.error("AI Chat error:", err);
    if (err.message?.includes("API key")) {
      return NextResponse.json({ error: "API de IA no configurada. Contacta al administrador." }, { status: 500 });
    }
    return NextResponse.json({ error: "Error al procesar tu mensaje" }, { status: 500 });
  }
}
