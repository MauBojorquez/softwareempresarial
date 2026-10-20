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

- **Invitar:** Configuración → Invitar Usuarios (correo + rol de acceso + **Puesto**). Entran con Google (correo corporativo) o con la contraseña que crean desde la invitación.
- **Registro cerrado:** no hay página de registro. Solo pueden entrar miembros existentes o quien tenga una **invitación vigente** (también con Google). Cualquier otra cuenta ve "Esta cuenta no tiene acceso".
- **Asignar/cambiar puesto a alguien que ya existe:** Configuración → **Miembros y puestos** (solo Dirección). Un miembro **sin puesto** (badge naranja) no ve módulos por rol.
- **Equipo** (menú, solo admin) es solo actividad; la gestión de puestos vive en Configuración.

---

## Reglas de negocio clave

- **Cobranza:** cada factura es independiente (no hay abonos) y lleva una casilla **Pagado** con fecha de pago. Al marcarla se avisa a Dirección "X ya pagó".
- **Número Crítico:** meta del mes configurable (tablero Dirección). Cobrado real = **suma de facturas pagadas cuya fecha de pago cae en el mes**. Semáforo: verde si %avance ≥ %mes transcurrido; amarillo 70–100% de ese ritmo; rojo debajo.
- **Metas por vendedor:** las fija Dirección (tablero), igual que la meta del mes.
- **Operaciones:** *velocidad del mes* = tareas completadas ÷ tareas del mes (calculada). *Salud general* = **promedio** de los clientes (verde 100, amarillo 50, rojo 0); los dados de BAJA no cuentan. *Crecimiento de cartera* lo captura Anahí a mano en su reporte.
- **CRM (etapas):** NUEVO → CONTACTADO → SESIÓN AGENDADA → DIAGNÓSTICO VENDIDO → PROPUESTA ENVIADA → CERRADO GANADO / CERRADO PERDIDO.
  - **Diagnóstico Vendido** genera una Venta de **$9,997 ÚNICA** (una sola vez) y el lead sigue vivo.
  - **Cerrado Ganado** exige monto/tipo/fecha de cobro esperada → genera Venta.
  - **Cerrado Perdido** exige motivo. Un lead puede generar varias ventas.
  - **Venta manual** (sin lead): solo Dirección.
- **Reporte diario:** uno por persona por día, editable hasta medianoche (zona America/Mexico_City), luego se congela. Cada quien ve el suyo; Dirección ve todos. Recordatorio push a las 20:00 MX a quien no lo mandó.
- **Rocas:** todos las ven; solo Dirección crea/edita/borra; cada dueño actualiza el % de la suya (o se calcula solo si la roca usa checklist). El **color se calcula** de la fecha límite y el avance; nunca se captura.
- **Flujo de efectivo — transferencias:** mover saldo entre cuentas no cuenta como entrada ni salida; solo mueve el saldo. Borrar una transferencia borra ambos lados.

---

## API v1 (Make, sitio web, bot de WhatsApp)

Todas usan `Authorization: Bearer <API_KEY>` (la key se crea en **Configuración → API Keys**; es por organización). Errores en español como `{ "error": "..." }`.

| Método | Ruta | Uso |
|---|---|---|
| POST | `/api/v1/leads` | Ingesta de leads (web o Meta). `nombre` obligatorio; `origen` META/ORGANICO/OUTBOUND/REFERIDO/RED_DIRECTA; opcionales empresa, telefono, email, mensaje (→ nota), campana, participantes, puesto, urgencia, duenoEmail. Avisa a Dirección y Comercial. |
| GET | `/api/v1/leads?telefono=` | Buscar lead por los últimos 10 dígitos. |
| PATCH | `/api/v1/leads/{id}` | Bot: solo NUEVO→CONTACTADO→SESION_AGENDADA; `nota` opcional. |
| GET | `/api/v1/clientes` | Cartera con `diaReporte`. |
| GET/POST | `/api/v1/tareas` | Leer por cliente y rango de `fechaLimite`; crear (cliente, titulo, responsable por id o correo, fechaLimite). |
| GET | `/api/v1/team` | Nombre, correo, whatsapp, puesto. |
| GET/POST | `/api/v1/rocas` | Leer por mes y responsable; crear (color siempre calculado). |
| POST | `/api/v1/automations/consolidado` | Correo consolidado del equipo para Dirección (Make, L–V 8:00). `?dryRun=1` para probar. |
| POST | `/api/v1/automations/pendientes?userId=` | Correo de pendientes de una persona (Make, L–V 9:50, una llamada por persona). |

- Dueño por defecto de leads: `duenoEmail` → env `META_LEAD_OWNER_EMAIL` → el miembro con puesto **Comercial** → dueño de la org.
- **Marketing** consume gasto/impresiones/CPL de Meta Ads (OAuth). Se conecta o reconecta desde el botón de la propia página de Marketing.

## Automatizaciones diarias (Make + Claude)

- **8:00 L–V — Consolidado:** reportes diarios del día hábil anterior (el lunes trae vie–dom) + resumen IA + quién no envió. Solo a Dirección; no usa el correo de nadie.
- **9:50 L–V — Pendientes:** a cada persona solo lo suyo: tareas vencidas, rocas en riesgo, meta de su puesto, su último reporte y, si conectó su Google (Configuración → Mi correo y reuniones), compromisos y seguimientos detectados en su Gmail y en las notas de Gemini de Meet. Los correos no se guardan.
- Escenarios en Make: "StratiuMetrics · Consolidado diario del equipo" y "StratiuMetrics · Pendientes personales", con el keychain **CRM LEADS**.

---

## Variables de entorno (nombres; los valores viven en Vercel)

Núcleo: `DATABASE_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `NODE_ENV`
Google login: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
Meta: `META_APP_ID`, `META_APP_SECRET`
Leads Meta (opcional): `META_LEAD_OWNER_EMAIL`
Correo: `RESEND_API_KEY`, `RESEND_API_KEY_2`, `EMAIL_FROM`
Push: `VAPID_PRIVATE_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_SUBJECT`
Cron: `CRON_SECRET`
IA: `ANTHROPIC_API_KEY`, `AI_DAILY_MODEL` (opcional)
Google Workspace (Gmail/Drive por persona): `GOOGLE_WORKSPACE_CLIENT_ID`, `GOOGLE_WORKSPACE_CLIENT_SECRET`, `GOOGLE_TOKEN_KEY` (no cambiarla: invalida las conexiones)

> Eliminado al pasar de SaaS a herramienta interna: landing, precios, registro público, términos/privacidad, página de estado, Stripe, SAT, QuickBooks, HubSpot, y las secciones genéricas (RRHH, Operaciones, Ventas viejo, Metas, Reporte IA mensual, Chat IA, Integraciones). Sus tablas siguen en la base para no perder datos.

---

## Crons (vercel.json)

- `/api/cron/insights` — 14:00 UTC
- `/api/cron/daily-report-reminder` — 02:00 UTC = **20:00 MX** (recordatorio de reporte diario)

---

## Push / PWA

- Push cableado: **factura marcada pagada** → Dirección; **roca al pasar a amarillo o rojo** → dueño + Dirección; **reporte diario enviado** → Dirección; **salud de Operaciones a amarillo/rojo** → Dirección; **lead nuevo por la API** → Dirección + Comercial; **reporte pendiente** → la persona (cron 20:00).
- Instalable en iOS/Android. **En iPhone el push solo funciona con la app instalada** en pantalla de inicio (límite de iOS).

---

## Deploy / operación

- Push a `main` → Vercel despliega. El build corre `prisma generate && prisma db push --accept-data-loss && next build`, así que las migraciones de esquema se aplican en cada deploy.
- Regla de trabajo: **build local verde antes de cada push** (`npx prisma generate && npx tsc --noEmit && npx next build`).
</content>
