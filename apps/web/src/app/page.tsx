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
                <div className="rounded-xl bg-secondary/30 p-4 sm:p-6">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-4">
                    {[
                      { label: "Ingresos YTD", value: "$2.4M", trend: "+12%" },
                      { label: "Ventas del Mes", value: "847", trend: "+8%" },
                      { label: "Gasto en Ads", value: "$45K", trend: "-3%" },
                      { label: "Margen Neto", value: "23.5%", trend: "+2%" },
                    ].map((card) => (
                      <div key={card.label} className="rounded-lg border border-border bg-card p-3 sm:p-4">
                        <p className="text-[10px] text-muted-foreground sm:text-xs">{card.label}</p>
                        <p className="mt-1 text-base font-bold text-foreground sm:text-xl">{card.value}</p>
                        <p className="text-[10px] font-medium text-emerald-600 sm:text-xs">{card.trend} vs mes anterior</p>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-border bg-card p-4">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Ingresos vs Gastos (12 meses)</p>
                      <div className="flex items-end gap-1 h-24 sm:h-32">
                        {[40, 65, 50, 80, 60, 75, 90, 55, 70, 85, 60, 78].map((h, i) => (
                          <div key={i} className="flex-1 flex flex-col gap-0.5 justify-end h-full">
                            <div className="rounded-t gradient-bg" style={{ height: `${h}%` }} />
                            <div className="rounded-t bg-destructive/30" style={{ height: `${h * 0.6}%` }} />
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center gap-4 mt-2">
                        <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full gradient-bg" /><span className="text-[10px] text-muted-foreground">Ingresos</span></div>
                        <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-destructive/30" /><span className="text-[10px] text-muted-foreground">Gastos</span></div>
                      </div>
                    </div>
                    <div className="rounded-lg border border-border bg-card p-4">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Campañas Meta Ads</p>
                      <div className="space-y-2">
                        {[
                          { name: "Campaña Verano", status: "Activa", spend: "$12,400", ctr: "3.2%" },
                          { name: "Retargeting Web", status: "Activa", spend: "$8,700", ctr: "4.1%" },
                          { name: "Prospección B2B", status: "Pausada", spend: "$5,200", ctr: "1.8%" },
                        ].map((c) => (
                          <div key={c.name} className="flex items-center justify-between rounded-md bg-secondary/50 px-2.5 py-2 text-[11px] sm:text-xs">
                            <div className="flex items-center gap-2">
                              <div className={`h-1.5 w-1.5 rounded-full ${c.status === "Activa" ? "bg-emerald-500" : "bg-amber-500"}`} />
                              <span className="font-medium text-foreground">{c.name}</span>
                            </div>
                            <div className="flex items-center gap-3 text-muted-foreground">
                              <span>{c.spend}</span>
                              <span>CTR {c.ctr}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <p className="mt-2 text-[10px] text-muted-foreground text-center">Datos en tiempo real de tu cuenta</p>
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
                <p className="text-2xl font-bold text-foreground">5</p>
                <p className="mt-1 text-sm text-muted-foreground">Categorías de métricas</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">3</p>
                <p className="mt-1 text-sm text-muted-foreground">Integraciones</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">IA</p>
                <p className="mt-1 text-sm text-muted-foreground">con Claude</p>
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

        <section className="border-t border-border py-24 bg-secondary/30">
          <div className="container mx-auto px-4">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-foreground sm:text-4xl">
                Cómo <span className="gradient-text">Funciona</span>
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
                Tres pasos para tener el control total de tu empresa.
              </p>
            </div>

            <div className="relative mt-16 flex flex-col items-center gap-12 lg:flex-row lg:justify-center lg:gap-0">
              <div className="hidden lg:block absolute top-10 left-1/2 -translate-x-1/2 w-2/3 h-0.5 bg-border" />
              <div className="lg:hidden absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-0.5 bg-border" />

              {[
                { step: "1", title: "Conecta", description: "Integra tu ERP, CRM y plataformas publicitarias en minutos" },
                { step: "2", title: "Visualiza", description: "Todas tus métricas en un dashboard centralizado y configurable" },
                { step: "3", title: "Decide", description: "Recibe reportes con IA y toma decisiones basadas en datos" },
              ].map((item) => (
                <div key={item.step} className="relative z-10 flex flex-col items-center text-center lg:flex-1 lg:px-8">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-primary bg-card text-2xl font-bold text-primary shadow-sm">
                    {item.step}
                  </div>
                  <h3 className="mt-4 text-xl font-semibold text-foreground">{item.title}</h3>
                  <p className="mt-2 max-w-xs text-sm text-muted-foreground">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-border py-24">
          <div className="container mx-auto px-4">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-foreground sm:text-4xl">
                Construido para <span className="gradient-text">tu operación</span>
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
                Capacidades reales del producto, sin números inflados.
              </p>
            </div>

            <div className="mt-16 grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { stat: "5 Categorías", description: "Finanzas, Ventas, Ops, RH, Marketing" },
                { stat: "3 Integraciones", description: "Meta Ads, QuickBooks, HubSpot" },
                { stat: "IA Integrada", description: "Reportes automáticos con Claude" },
                { stat: "CSV + Manual", description: "Importa datos como quieras" },
              ].map((item) => (
                <div key={item.stat} className="rounded-2xl border border-border bg-card p-6 text-center transition-all hover:shadow-md sm:p-8">
                  <p className="text-2xl font-bold text-foreground">{item.stat}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
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
