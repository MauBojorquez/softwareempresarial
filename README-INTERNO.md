# StratiuMetrics — Guía interna (Mau)

Herramienta interna de Stratium. 5 personas, control de acceso por **puesto** (jobRole)
validado en backend. Producción despliega desde `main` (Vercel).

---

## Puestos (jobRole) y qué ve cada uno

El acceso real se valida en el backend (`src/lib/access.ts`), no solo en el menú.

| Puesto | Módulos que ve |
|---|---|
| **DIRECCION** (Mau) | Todo: Resumen, Finanzas (Dashboard, Flujo, Cobranza), Operativo (Cartera, Tareas), Comercial (CRM, Ventas, Marketing), Reportes, Rocas, Dirección |
| **OPERACIONES** (Anahí) | Resumen, Operativo (Cartera, Tareas), Reportes, Rocas |
| **COMERCIAL** (Juan Carlos) | Resumen, Comercial (CRM, Ventas, **Marketing solo conteo de leads**), Reportes, Rocas |
| **MARKETING** (Amzi) | Resumen, Comercial (CRM = **solo sus leads**, Marketing completo), Reportes, Rocas |
| **ADMINISTRACION** (Emmanuel) | Resumen, Finanzas (Flujo, Cobranza), Operativo (Cartera, Tareas), Ventas (ver), Reportes, Rocas |

> Si alguien fuerza una URL o un bloque que no le toca, el backend responde 403 / no manda datos.

---

## Administración de usuarios

- **Invitar:** Configuración → Invitar Usuarios (correo + rol de acceso + **Puesto**). Entran con Google (correo corporativo).
- **Asignar/cambiar puesto a alguien que ya existe:** Configuración → **Miembros y puestos** (solo Dirección). Un miembro **sin puesto** (badge naranja) no ve módulos por rol.
- **Equipo** (menú, solo admin) es solo actividad; la gestión de puestos vive en Configuración.

---

## Reglas de negocio clave

- **Cobranza (abonos):** el estatus (PENDIENTE/PARCIAL/PAGADA/VENCIDA) **se calcula** de los abonos, no se captura. Solo **Administración y Dirección** registran o borran abonos → un pago registrado = pago confirmado.
- **Número Crítico:** meta del mes configurable (tablero Dirección). Cobrado real = **suma de abonos (Payments) del mes**. Semáforo: verde si %avance ≥ %mes transcurrido; amarillo 70–100% de ese ritmo; rojo debajo.
- **Metas por vendedor:** las fija Dirección (tablero), igual que la meta del mes.
- **Operaciones:** *velocidad del mes* = tareas completadas ÷ tareas del mes (calculada). *Salud general* = peor caso entre clientes (rojo > amarillo > verde) + conteo. *Crecimiento de cartera* lo captura Anahí a mano en su reporte.
- **CRM (etapas):** NUEVO → CONTACTADO → SESIÓN AGENDADA → DIAGNÓSTICO VENDIDO → PROPUESTA ENVIADA → CERRADO GANADO / CERRADO PERDIDO.
  - **Diagnóstico Vendido** genera una Venta de **$9,997 ÚNICA** (una sola vez) y el lead sigue vivo.
  - **Cerrado Ganado** exige monto/tipo/fecha de cobro esperada → genera Venta.
  - **Cerrado Perdido** exige motivo. Un lead puede generar varias ventas.
  - **Venta manual** (sin lead): solo Dirección.
- **Reporte diario:** uno por persona por día, editable hasta medianoche (zona America/Mexico_City), luego se congela. Cada quien ve el suyo; Dirección ve todos. Recordatorio push a las 20:00 MX a quien no lo mandó.
- **Rocas:** todos las ven; solo Dirección crea/edita/borra; cada dueño actualiza el % y estatus de la suya.

---

## Integración Meta (leads vía Make)

Endpoint de ingesta:

```
POST https://<dominio>/api/v1/leads
Headers: Authorization: Bearer <API_KEY>   |   Content-Type: application/json
Body: { "nombre": "…"(req), "empresa": "…", "contacto": "…", "campana": "…", "duenoEmail": "…"(opcional) }
Éxito 201: { ok:true, leadId, etapa:"NUEVO", origen:"META", duenoId }
Errores: 401 (key), 429 (rate limit 120/min), 400 (nombre faltante/JSON), 422 (sin dueño)
```

- La API Key se crea en **Configuración → API Keys**.
- Dueño por defecto: `duenoEmail` del body → env `META_LEAD_OWNER_EMAIL` → el miembro con puesto **Comercial** → dueño de la org. (Hoy caen en Juan Carlos.)
- El bloque **Marketing** también consume gasto/impresiones/CPL de la integración Meta (OAuth, métricas `META_ADS`). CPL = gasto ÷ leads.

---

## Variables de entorno (nombres; los valores viven en Vercel)

Núcleo: `DATABASE_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `NODE_ENV`
Google login: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
Meta: `META_APP_ID`, `META_APP_SECRET`
Leads Meta (opcional): `META_LEAD_OWNER_EMAIL`
Correo: `RESEND_API_KEY`, `RESEND_API_KEY_2`, `EMAIL_FROM`
Push: `VAPID_PRIVATE_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_SUBJECT`
Cron: `CRON_SECRET`
IA: `ANTHROPIC_API_KEY`

> Fuera del alcance (eliminados): SAT, billing/Stripe, QuickBooks, HubSpot. `ApiKey` se conserva (Make/WhatsApp + ingesta de leads).

---

## Crons (vercel.json)

- `/api/cron/insights` — 14:00 UTC
- `/api/cron/daily-report-reminder` — 02:00 UTC = **20:00 MX** (recordatorio de reporte diario)

---

## Push / PWA

- Push cableado: **cobro registrado** → Dirección + Administración; **roca al entrar en rojo** → dueño + Dirección; **reporte pendiente** → la persona (cron).
- Instalable en iOS/Android. **En iPhone el push solo funciona con la app instalada** en pantalla de inicio (límite de iOS).

---

## Deploy / operación

- Push a `main` → Vercel despliega. El build corre `prisma generate && prisma db push --accept-data-loss && next build`, así que las migraciones de esquema se aplican en cada deploy.
- Regla de trabajo: **build local verde antes de cada push** (`npx prisma generate && npx tsc --noEmit && npx next build`).
</content>
