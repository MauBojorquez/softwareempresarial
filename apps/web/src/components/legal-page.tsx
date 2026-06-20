import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/**
 * Shared chrome for the public legal pages (privacy / terms). Renders the same
 * header and footer used across the marketing site so the documents feel native
 * to the product. `children` should be the document body (sections).
 */
export function LegalShell({
  title,
  updatedAt,
  intro,
  children,
}: {
  title: string;
  updatedAt: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="fixed top-0 z-50 w-full border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg gradient-bg" />
            <span className="text-lg font-bold">StratiuMetrics</span>
          </Link>
          <Link
            href="/login"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Iniciar Sesión
          </Link>
        </div>
      </header>

      <main className="container mx-auto max-w-3xl px-4 pb-20 pt-24 sm:pt-32">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Volver al inicio
        </Link>

        <h1 className="mt-6 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Última actualización: {updatedAt}</p>
        <p className="mt-6 text-base leading-relaxed text-muted-foreground">{intro}</p>

        <div className="legal-body mt-10 space-y-8">{children}</div>

        <div className="mt-16 rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
          ¿Dudas sobre este documento? Escríbenos a{" "}
          <a href="mailto:soporte@somosstratium.com" className="font-medium text-primary hover:underline">
            soporte@somosstratium.com
          </a>
          .
        </div>
      </main>

      <footer className="border-t border-border py-8">
        <div className="container mx-auto flex flex-col items-center gap-4 px-4 text-center text-sm text-muted-foreground sm:flex-row sm:justify-between">
          <p>&copy; {new Date().getFullYear()} StratiuMetrics. Todos los derechos reservados.</p>
          <div className="flex gap-6">
            <Link href="/privacidad" className="transition-colors hover:text-foreground">Privacidad</Link>
            <Link href="/terminos" className="transition-colors hover:text-foreground">Términos</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

/** A titled section within a legal document. */
export function LegalSection({ id, n, title, children }: { id?: string; n: number; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-lg font-semibold text-foreground">
        {n}. {title}
      </h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}
