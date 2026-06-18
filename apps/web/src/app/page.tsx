import Link from "next/link";
import { BarChart3, Brain, Zap, ArrowRight, Shield, Globe } from "lucide-react";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="fixed top-0 z-50 w-full border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg gradient-bg flex items-center justify-center">
              <span className="text-xs font-bold text-white">S</span>
            </div>
            <span className="text-lg font-bold text-foreground">MetrixPro</span>
          </div>
          <nav className="hidden items-center gap-8 md:flex">
            <Link href="#features" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              Funciones
            </Link>
            <Link href="/pricing" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              Precios
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline">
              Iniciar Sesión
            </Link>
            <Link
              href="/register"
              className="rounded-lg gradient-bg px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              Comenzar Gratis
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 pt-16">
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(37,99,168,0.06),transparent_60%)]" />

          <div className="container relative mx-auto px-4 py-20 text-center sm:py-32">
            <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm text-primary">
              <Zap className="h-3.5 w-3.5" />
              Potenciado con Inteligencia Artificial
            </div>

            <h1 className="mx-auto max-w-4xl text-3xl font-bold tracking-tight text-foreground sm:text-5xl md:text-7xl">
              Todos los números de tu empresa,{" "}
              <span className="gradient-text">en un solo lugar</span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
              Conecta tu ERP y CRM, visualiza métricas en tiempo real y recibe
              reportes inteligentes con IA. Toma mejores decisiones, más rápido.
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/register"
                className="group flex w-full items-center justify-center gap-2 rounded-xl gradient-bg px-8 py-3.5 text-lg font-medium text-white transition-opacity hover:opacity-90 sm:w-auto"
              >
                Prueba 14 días gratis
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                href="/pricing"
                className="w-full rounded-xl border border-border bg-card px-8 py-3.5 text-center text-lg font-medium text-foreground transition-colors hover:bg-secondary sm:w-auto"
              >
                Ver precios
              </Link>
            </div>

            <div className="relative mx-auto mt-20 max-w-5xl">
              <div className="rounded-2xl border border-border bg-card p-2 shadow-lg">
                <div className="rounded-xl bg-secondary/30 p-6 sm:p-8">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-4">
                    {[65, 45, 80, 55].map((w, i) => (
                      <div key={i} className="rounded-lg border border-border bg-card p-3 sm:p-4">
                        <div className="h-2 w-12 rounded bg-muted mb-2" />
                        <div className="h-4 rounded gradient-bg" style={{ width: `${w}%` }} />
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-border bg-card p-4">
                      <div className="flex items-end gap-1 h-24 sm:h-32">
                        {[40, 65, 50, 80, 60, 75, 90, 55, 70, 85, 60, 45].map((h, i) => (
                          <div key={i} className="flex-1 rounded-t gradient-bg" style={{ height: `${h}%` }} />
                        ))}
                      </div>
                    </div>
                    <div className="rounded-lg border border-border bg-card p-4">
                      <div className="flex items-end gap-1 h-24 sm:h-32">
                        {[30, 45, 60, 40, 55, 70, 50, 65, 80, 45, 55, 70].map((h, i) => (
                          <div key={i} className="flex-1 rounded-t bg-primary/20" style={{ height: `${h}%` }} />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-border bg-secondary/30 py-10">
          <div className="container mx-auto px-4">
            <p className="text-center text-sm font-medium uppercase tracking-widest text-muted-foreground">
              Diseñado para empresas mexicanas
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-8 sm:gap-16">
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">500+</p>
                <p className="mt-1 text-sm text-muted-foreground">Métricas</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">6</p>
                <p className="mt-1 text-sm text-muted-foreground">Integraciones</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">IA</p>
                <p className="mt-1 text-sm text-muted-foreground">Incluida</p>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="relative border-t border-border py-24">
          <div className="container mx-auto px-4">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-foreground sm:text-4xl">
                Todo lo que necesitas para{" "}
                <span className="gradient-text">dirigir tu empresa</span>
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
                Una plataforma unificada que centraliza todas las métricas de tu negocio.
              </p>
            </div>

            <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  icon: BarChart3,
                  title: "Métricas en Tiempo Real",
                  description: "Finanzas, ventas, operaciones, RRHH y marketing. Todo sincronizado automáticamente desde QuickBooks y HubSpot.",
                  color: "bg-primary/8 text-primary",
                },
                {
                  icon: Brain,
                  title: "Reportes con IA",
                  description: "Recibe análisis mensuales generados por inteligencia artificial con insights accionables y recomendaciones.",
                  color: "bg-amber-50 text-amber-600",
                },
                {
                  icon: Globe,
                  title: "Web + Mobile",
                  description: "Dashboards personalizables disponibles en web y app nativa. Tus KPIs siempre contigo.",
                  color: "bg-emerald-50 text-emerald-600",
                },
              ].map((feature) => (
                <div
                  key={feature.title}
                  className="rounded-2xl border border-border bg-card p-6 transition-all hover:shadow-md sm:p-8"
                >
                  <div className={`inline-flex rounded-xl ${feature.color} p-3`}>
                    <feature.icon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-foreground">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-border py-24">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-card p-8 text-center shadow-sm sm:p-12">
              <Shield className="mx-auto h-10 w-10 text-primary" />
              <h2 className="mt-4 text-3xl font-bold text-foreground">Conecta. Visualiza. Decide.</h2>
              <p className="mt-3 text-muted-foreground">
                Únete a los empresarios que ya toman decisiones basadas en datos reales.
              </p>
              <Link
                href="/register"
                className="mt-8 inline-flex items-center gap-2 rounded-xl gradient-bg px-8 py-3.5 text-lg font-medium text-white transition-opacity hover:opacity-90"
              >
                Comenzar Ahora
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8">
        <div className="container mx-auto flex flex-col items-center gap-4 px-4 text-center text-sm text-muted-foreground sm:flex-row sm:justify-between">
          <p>&copy; {new Date().getFullYear()} MetrixPro by Stratium. Todos los derechos reservados.</p>
          <div className="flex gap-6">
            <Link href="#" className="transition-colors hover:text-foreground">Privacidad</Link>
            <Link href="#" className="transition-colors hover:text-foreground">Términos</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
