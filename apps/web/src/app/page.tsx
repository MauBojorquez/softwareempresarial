import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary" />
            <span className="text-xl font-bold">MetrixPro</span>
          </div>
          <nav className="flex items-center gap-4">
            <Link href="/pricing" className="text-sm text-muted-foreground hover:text-foreground">
              Precios
            </Link>
            <Link
              href="/login"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Iniciar Sesión
            </Link>
            <Link
              href="/register"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Comenzar Gratis
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="container mx-auto px-4 py-24 text-center">
          <h1 className="mx-auto max-w-4xl text-5xl font-bold tracking-tight sm:text-6xl">
            Todos los números de tu empresa,{" "}
            <span className="text-primary">en un solo lugar</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Conecta tu ERP y CRM, visualiza métricas en tiempo real y recibe
            reportes inteligentes con IA. Toma mejores decisiones, más rápido.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link
              href="/register"
              className="rounded-lg bg-primary px-8 py-3 text-lg font-medium text-primary-foreground hover:bg-primary/90"
            >
              Prueba 14 días gratis
            </Link>
            <Link
              href="/pricing"
              className="rounded-lg border px-8 py-3 text-lg font-medium hover:bg-accent"
            >
              Ver precios
            </Link>
          </div>
        </section>

        <section className="border-t bg-muted/50 py-20">
          <div className="container mx-auto px-4">
            <h2 className="text-center text-3xl font-bold">Todo lo que necesitas para dirigir tu empresa</h2>
            <div className="mt-12 grid gap-8 md:grid-cols-3">
              {[
                {
                  title: "Métricas en Tiempo Real",
                  description: "Finanzas, ventas, operaciones, RRHH y marketing. Todo sincronizado automáticamente desde QuickBooks y HubSpot.",
                },
                {
                  title: "Reportes con IA",
                  description: "Recibe análisis mensuales generados por inteligencia artificial con insights accionables y recomendaciones personalizadas.",
                },
                {
                  title: "Dashboard Ejecutivo",
                  description: "Dashboards personalizables para ver exactamente los KPIs que importan. Disponible en web y móvil.",
                },
              ].map((feature) => (
                <div key={feature.title} className="rounded-xl border bg-card p-6">
                  <h3 className="text-lg font-semibold">{feature.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} MetrixPro. Todos los derechos reservados.
        </div>
      </footer>
    </div>
  );
}
