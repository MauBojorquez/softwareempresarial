import type { Metadata } from "next";
import { LegalShell, LegalSection } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Aviso de Privacidad | StratiuMetrics",
  description:
    "Aviso de Privacidad de StratiuMetrics: qué datos recolectamos, para qué los usamos, con quién los compartimos y cómo ejerces tus derechos ARCO.",
  alternates: { canonical: "/privacidad" },
};

export default function PrivacidadPage() {
  return (
    <LegalShell
      title="Aviso de Privacidad"
      updatedAt="20 de junio de 2026"
      intro="En StratiuMetrics tu información y la de tu empresa son la base de tu confianza. Este Aviso de Privacidad explica, de forma clara y sin letras chiquitas, qué datos recabamos, con qué fines, con quién los compartimos y cómo puedes controlarlos en todo momento."
    >
      <LegalSection n={1} title="Quién es el responsable de tus datos">
        <p>
          El responsable del tratamiento de tus datos personales es <strong>StratiuMetrics</strong>, un
          producto operado por Stratium (&ldquo;nosotros&rdquo;). Puedes contactarnos en cualquier momento en{" "}
          <a href="mailto:soporte@somosstratium.com" className="text-primary hover:underline">
            soporte@somosstratium.com
          </a>
          .
        </p>
        <p>
          Este aviso se rige por la Ley Federal de Protección de Datos Personales en Posesión de los
          Particulares (LFPDPPP) de México y su reglamento.
        </p>
      </LegalSection>

      <LegalSection n={2} title="Qué datos recabamos">
        <p>Recolectamos únicamente la información necesaria para operar el servicio:</p>
        <ul className="ml-5 list-disc space-y-1.5">
          <li>
            <strong>Datos de cuenta:</strong> nombre, correo electrónico, teléfono (opcional), foto de
            perfil (opcional) y una versión cifrada de tu contraseña. Nunca almacenamos tu contraseña en
            texto plano.
          </li>
          <li>
            <strong>Datos de tu empresa:</strong> nombre, industria, logotipo, color de marca y los
            miembros de tu equipo que invites.
          </li>
          <li>
            <strong>Métricas de negocio:</strong> los datos financieros, de ventas, operaciones, recursos
            humanos y marketing que captures manualmente o importes.
          </li>
          <li>
            <strong>Datos fiscales (SAT):</strong> si conectas el SAT, procesamos la información fiscal
            necesaria (ingresos, egresos, IVA) para mostrarte tus indicadores. Las credenciales se
            almacenan de forma cifrada y se usan exclusivamente para sincronizar tus datos.
          </li>
          <li>
            <strong>Integraciones de terceros:</strong> tokens de acceso de servicios que conectes
            voluntariamente (por ejemplo Meta Ads o HubSpot), usados solo para traer tus propias métricas.
          </li>
          <li>
            <strong>Datos de facturación:</strong> si contratas un plan de pago, el cobro lo procesa
            Stripe. No almacenamos los datos completos de tu tarjeta en nuestros servidores.
          </li>
          <li>
            <strong>Datos de uso y técnicos:</strong> registros de actividad, preferencias (tema,
            notificaciones), suscripciones a notificaciones y datos técnicos básicos para seguridad y
            diagnóstico.
          </li>
        </ul>
      </LegalSection>

      <LegalSection n={3} title="Para qué usamos tus datos (finalidades)">
        <p>
          <strong>Finalidades primarias</strong> (necesarias para darte el servicio):
        </p>
        <ul className="ml-5 list-disc space-y-1.5">
          <li>Crear y administrar tu cuenta y la de tu organización.</li>
          <li>Calcular, visualizar y exportar tus métricas e indicadores.</li>
          <li>Generar reportes ejecutivos con inteligencia artificial.</li>
          <li>Sincronizar la información de las integraciones que conectes.</li>
          <li>Enviarte notificaciones operativas y alertas que configures.</li>
          <li>Procesar pagos y administrar tu suscripción.</li>
          <li>Brindar soporte y garantizar la seguridad de la plataforma.</li>
        </ul>
        <p>
          <strong>Finalidades secundarias</strong> (opcionales): mejorar el producto y enviarte
          comunicaciones sobre novedades. Puedes oponerte a estas en cualquier momento sin que ello afecte
          el servicio, escribiéndonos al correo de contacto.
        </p>
      </LegalSection>

      <LegalSection n={4} title="Con quién compartimos tus datos">
        <p>
          No vendemos tus datos. Los compartimos únicamente con proveedores que nos ayudan a operar, bajo
          obligaciones de confidencialidad y solo en la medida necesaria:
        </p>
        <ul className="ml-5 list-disc space-y-1.5">
          <li><strong>Infraestructura y hospedaje</strong> para ejecutar la aplicación y la base de datos.</li>
          <li><strong>Stripe</strong>, para procesar pagos de forma segura.</li>
          <li><strong>Anthropic (Claude)</strong>, para generar los reportes con IA a partir de tus métricas.</li>
          <li><strong>Proveedores que tú conectes</strong> (SAT, Meta, HubSpot, entre otros), según las integraciones que actives.</li>
        </ul>
        <p>
          También podremos divulgar información cuando una autoridad competente lo requiera conforme a la
          ley.
        </p>
      </LegalSection>

      <LegalSection n={5} title="Inteligencia artificial">
        <p>
          Los reportes con IA se generan enviando un resumen de tus métricas a nuestro proveedor de modelos
          de lenguaje para redactar el análisis. Estos datos se usan exclusivamente para producir tu reporte
          y no para entrenar modelos. La IA es una herramienta de apoyo: las decisiones de negocio siguen
          siendo tuyas.
        </p>
      </LegalSection>

      <LegalSection n={6} title="Por cuánto tiempo conservamos tus datos">
        <p>
          Conservamos tu información mientras tu cuenta esté activa. Cuando eliminas tu cuenta, borramos de
          forma permanente tu organización y los datos asociados (métricas, reportes, integraciones, metas),
          salvo aquello que debamos retener por obligaciones legales o fiscales.
        </p>
      </LegalSection>

      <LegalSection n={7} title="Tus derechos ARCO">
        <p>
          Tienes derecho a <strong>Acceder</strong>, <strong>Rectificar</strong>, <strong>Cancelar</strong> u{" "}
          <strong>Oponerte</strong> al tratamiento de tus datos, así como a revocar tu consentimiento:
        </p>
        <ul className="ml-5 list-disc space-y-1.5">
          <li>Puedes ver y editar la mayoría de tus datos directamente en <strong>Configuración</strong>.</li>
          <li>
            Puedes <strong>eliminar tu cuenta y todos tus datos</strong> tú mismo desde Configuración →
            Zona de peligro, sin necesidad de contactarnos.
          </li>
          <li>
            Para cualquier otra solicitud ARCO, escríbenos a{" "}
            <a href="mailto:soporte@somosstratium.com" className="text-primary hover:underline">
              soporte@somosstratium.com
            </a>{" "}
            y responderemos en los plazos que marca la ley.
          </li>
        </ul>
      </LegalSection>

      <LegalSection n={8} title="Seguridad">
        <p>
          Aplicamos medidas técnicas y organizativas para proteger tu información: cifrado de contraseñas y
          credenciales sensibles, conexiones cifradas (HTTPS), control de acceso por organización y roles, y
          aislamiento de los datos de cada empresa. Ningún sistema es 100% infalible, pero trabajamos
          continuamente para mantener tu información segura.
        </p>
      </LegalSection>

      <LegalSection n={9} title="Transferencias internacionales">
        <p>
          Algunos de nuestros proveedores operan fuera de México. Cuando esto ocurre, nos aseguramos de que
          existan salvaguardas adecuadas para proteger tus datos conforme a la legislación aplicable.
        </p>
      </LegalSection>

      <LegalSection n={10} title="Menores de edad">
        <p>
          StratiuMetrics es una herramienta empresarial dirigida a personas mayores de 18 años. No
          recabamos intencionalmente datos de menores de edad.
        </p>
      </LegalSection>

      <LegalSection n={11} title="Cambios a este aviso">
        <p>
          Podemos actualizar este Aviso de Privacidad para reflejar mejoras del producto o cambios legales.
          Publicaremos la versión vigente en esta página con su fecha de actualización y, cuando los cambios
          sean relevantes, te lo notificaremos.
        </p>
      </LegalSection>
    </LegalShell>
  );
}
