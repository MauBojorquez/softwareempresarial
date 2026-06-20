import type { Metadata } from "next";
import { LegalShell, LegalSection } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Términos de Servicio | StratiuMetrics",
  description:
    "Términos de Servicio de StratiuMetrics: condiciones de uso, planes y pagos, propiedad de tus datos, integraciones, reportes con IA y responsabilidades.",
  alternates: { canonical: "/terminos" },
};

export default function TerminosPage() {
  return (
    <LegalShell
      title="Términos de Servicio"
      updatedAt="20 de junio de 2026"
      intro="Estos Términos de Servicio rigen el uso de StratiuMetrics. Al crear una cuenta o utilizar la plataforma, aceptas estas condiciones. Las redactamos para que sean justas y entendibles; si algo no te queda claro, escríbenos."
    >
      <LegalSection n={1} title="Aceptación de los términos">
        <p>
          Al registrarte o usar StratiuMetrics confirmas que leíste y aceptas estos Términos y nuestro{" "}
          <a href="/privacidad" className="text-primary hover:underline">Aviso de Privacidad</a>. Si usas la
          plataforma en nombre de una empresa, declaras que tienes facultades para obligarla.
        </p>
      </LegalSection>

      <LegalSection n={2} title="Descripción del servicio">
        <p>
          StratiuMetrics es una plataforma de inteligencia de negocio que te permite capturar e integrar
          métricas (finanzas, ventas, operaciones, recursos humanos y marketing), visualizarlas en un
          dashboard, definir metas y generar reportes ejecutivos con inteligencia artificial. El alcance de
          las funciones depende del plan que contrates.
        </p>
      </LegalSection>

      <LegalSection n={3} title="Cuentas y elegibilidad">
        <p>
          Debes ser mayor de edad y proporcionar información veraz al registrarte. Eres responsable de
          mantener la confidencialidad de tus credenciales y de toda la actividad que ocurra en tu cuenta.
          Notifícanos de inmediato si detectas un uso no autorizado.
        </p>
      </LegalSection>

      <LegalSection n={4} title="Planes, prueba y pagos">
        <ul className="ml-5 list-disc space-y-1.5">
          <li>Ofrecemos un plan gratuito y planes de pago con funciones adicionales.</li>
          <li>Los planes de pago pueden incluir un período de prueba; al terminar, se aplicará el cobro correspondiente salvo que canceles antes.</li>
          <li>Los pagos se procesan a través de Stripe. La suscripción se renueva automáticamente según el ciclo elegido (mensual o anual) hasta que la canceles.</li>
          <li>Puedes cancelar en cualquier momento; conservarás el acceso hasta el final del período ya pagado. Salvo que la ley indique lo contrario, los pagos no son reembolsables de forma proporcional.</li>
          <li>Podemos ajustar precios notificándote con anticipación razonable.</li>
        </ul>
      </LegalSection>

      <LegalSection n={5} title="Uso aceptable">
        <p>Te comprometes a no:</p>
        <ul className="ml-5 list-disc space-y-1.5">
          <li>Usar la plataforma para fines ilícitos o cargar datos sobre los que no tienes derechos.</li>
          <li>Intentar vulnerar la seguridad, acceder a datos de otras organizaciones o interrumpir el servicio.</li>
          <li>Realizar ingeniería inversa, revender o copiar la plataforma sin autorización.</li>
          <li>Abusar de los recursos del sistema o de las integraciones de terceros.</li>
        </ul>
      </LegalSection>

      <LegalSection n={6} title="Propiedad de tus datos">
        <p>
          <strong>Tus datos son tuyos.</strong> Conservas la titularidad de toda la información y métricas que
          cargues. Nos otorgas únicamente la licencia necesaria para almacenarlos, procesarlos y mostrártelos
          como parte del servicio. Puedes exportarlos o eliminarlos en cualquier momento.
        </p>
      </LegalSection>

      <LegalSection n={7} title="Propiedad intelectual de la plataforma">
        <p>
          El software, la marca, el diseño y el contenido de StratiuMetrics son propiedad de Stratium y están
          protegidos por las leyes aplicables. Estos Términos no te transfieren ningún derecho sobre la
          plataforma más allá del uso permitido.
        </p>
      </LegalSection>

      <LegalSection n={8} title="Integraciones de terceros">
        <p>
          La plataforma puede conectarse con servicios externos (SAT, Meta, HubSpot, entre otros). El uso de
          esos servicios se rige por sus propios términos y políticas. No somos responsables de la
          disponibilidad, exactitud o cambios de dichos terceros, pero trabajamos para mantener las
          integraciones funcionando.
        </p>
      </LegalSection>

      <LegalSection n={9} title="Reportes generados con IA">
        <p>
          Los reportes y análisis generados con inteligencia artificial son una herramienta de apoyo a la
          toma de decisiones y pueden contener imprecisiones. No constituyen asesoría financiera, fiscal,
          contable ni legal. Te recomendamos validar la información con un profesional antes de tomar
          decisiones relevantes.
        </p>
      </LegalSection>

      <LegalSection n={10} title="Disponibilidad del servicio">
        <p>
          Nos esforzamos por mantener la plataforma disponible y segura, pero el servicio se ofrece
          &ldquo;tal cual&rdquo;. Podemos realizar mantenimientos o actualizaciones que generen
          interrupciones temporales. No garantizamos que el servicio sea ininterrumpido o libre de errores.
        </p>
      </LegalSection>

      <LegalSection n={11} title="Limitación de responsabilidad">
        <p>
          En la máxima medida permitida por la ley, StratiuMetrics y Stratium no serán responsables por daños
          indirectos, incidentales o consecuentes, ni por pérdida de ganancias o datos derivados del uso o la
          imposibilidad de uso de la plataforma. Nuestra responsabilidad total se limitará al monto que hayas
          pagado por el servicio en los doce meses previos al evento que originó la reclamación.
        </p>
      </LegalSection>

      <LegalSection n={12} title="Terminación">
        <p>
          Puedes dejar de usar el servicio y eliminar tu cuenta cuando quieras desde Configuración. Podemos
          suspender o cancelar cuentas que incumplan estos Términos. Al terminar, se aplicará lo previsto en
          el Aviso de Privacidad respecto a la eliminación de tus datos.
        </p>
      </LegalSection>

      <LegalSection n={13} title="Cambios a los términos">
        <p>
          Podemos actualizar estos Términos para reflejar mejoras o cambios legales. Publicaremos la versión
          vigente en esta página y, cuando los cambios sean relevantes, te lo notificaremos. El uso continuado
          del servicio implica la aceptación de los términos actualizados.
        </p>
      </LegalSection>

      <LegalSection n={14} title="Ley aplicable">
        <p>
          Estos Términos se rigen por las leyes de los Estados Unidos Mexicanos. Cualquier controversia se
          resolverá ante los tribunales competentes, sin perjuicio de los derechos que la ley reconozca a los
          consumidores.
        </p>
      </LegalSection>
    </LegalShell>
  );
}
