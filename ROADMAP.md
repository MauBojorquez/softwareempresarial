# MetrixPro - Roadmap de Ajustes

## 1. Ajuste de Paquetes/Planes
- **Starter**: 3 integraciones (CRM, ERP, Meta Ads) en vez de 1
- Medir límites por **volumen de datos** y **reportes IA** en vez de por número de integraciones
- Revisar estructura de precios acorde

## 2. Reportes IA con Contexto Histórico
- Base de datos que guarde información mes con mes por cliente
- Módulo de **Historial** para consultar reportes pasados
- El IA debe tener contexto acumulado para dar mejores insights

## 3. Cada Pestaña Conectada a su Fuente de Datos
- **Ventas** → Conectar a CRM (HubSpot) o Google Sheets / Excel
- **Operaciones/ERP** → Inventario, logística (conectar a sistema ERP)
- **Marketing** → Meta Ads (ya conectado)
- **Finanzas** → QuickBooks (ya existe código)
- Si no hay conexión, mostrar mensaje "Conecta tu [fuente]" con link a integraciones
- **Entrada manual**: poder agregar datos que no estén en el sistema (ej. una venta fuera del CRM)

## 4. Meta Ads - Más Profundidad
- Ver más meses de historial (no solo mes actual vs anterior)
- Lista de campañas individuales con su costo y métricas
- Número de campañas activas
- Desglose por campaña

## 5. Overview
- Agregar toda la información de todas las fuentes conectadas
- Resumen ejecutivo real basado en datos reales

## 6. Rediseño de Estilo (Prioridad Alta)
- **Inspiración**: Estética tipo BlackRock / corporativo futurista
- **Base**: Blanco suave (no harsh white), tonos grises
- **Paleta**: Grises, blancos cálidos, acentos sutiles corporativos
- **Tipografía**: Fuentes legibles, profesionales, que no cansen la vista
- **Sin ruido visual**: Limpio, minimalista, profesional
- **NO** el negro actual

## 7. Logos e Identidad
- Logo de la app: Logo de Stratium (pendiente que el usuario lo suba)
- Logos de integraciones: Meta (logo real), HubSpot (logo real), QuickBooks, etc.
- Aspecto profesional en toda la UI

## 8. Seguridad
- Revisar que todo tenga su entorno de seguridad
- Auth, tokens, permisos, validaciones

---

## Estado Actual
- [x] Meta Ads OAuth conectado y funcionando
- [x] Stripe con 3 planes live
- [x] Página de Marketing con datos reales de Meta
- [x] Ajuste de planes/límites (Starter: 3 integraciones, 3 usuarios)
- [x] Rediseño de estilo (tema light corporativo BlackRock-inspired)
- [x] Historial de reportes (API + UI para ver reportes pasados)
- [x] Entrada manual de datos (Finanzas, Ventas, Operaciones, RH)
- [x] Meta Ads profundidad (campañas, 6 meses historial, tabs)
- [x] Conectar cada pestaña a su fuente (empty states + manual entry)
- [x] Overview con datos reales agregados
- [x] Reportes IA generados con Claude API + datos reales
- [ ] Logo de Stratium (pendiente: el usuario necesita subir el archivo)
- [ ] Logos reales de integraciones (SVG/PNG de Meta, HubSpot, etc.)
- [ ] Seguridad: revisar tokens, permisos, validaciones
- [ ] HubSpot integration con credenciales reales
- [ ] QuickBooks integration con credenciales reales
