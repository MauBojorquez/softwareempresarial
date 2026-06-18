import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="text-center">
        <div className="mx-auto mb-6 h-16 w-16 rounded-2xl gradient-bg flex items-center justify-center">
          <span className="text-2xl font-bold text-white">404</span>
        </div>
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Página no encontrada</h1>
        <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
          La página que buscas no existe o fue movida.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link
            href="/dashboard/overview"
            className="rounded-lg gradient-bg px-5 py-2.5 text-sm font-medium text-white hover:opacity-90"
          >
            Ir al Dashboard
          </Link>
          <Link
            href="/"
            className="rounded-lg border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground hover:bg-secondary"
          >
            Inicio
          </Link>
        </div>
      </div>
    </div>
  );
}
