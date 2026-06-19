import Link from "next/link";
import { BarChart3, Brain, Zap, ArrowRight, Shield, Globe } from "lucide-react";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="fixed top-0 z-50 w-full border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2 animate-fade-in-up">
            <div className="h-8 w-8 rounded-lg gradient-bg flex items-center justify-center animate-float-logo icon-pop">
              <span className="text-xs font-bold text-white">S</span>
            </div>
            <span className="text-lg font-bold text-foreground">MetrixPro</span>
          </div>
          <nav className="hidden items-center gap-8 md:flex">
            <Link href="#features" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Funciones</Link>
            <Link href="/pricing" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Precios</Link>
          </nav>
          <div className="flex items-center gap-3 anim-d2">
            <Link href="/login" className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline">Iniciar Sesión</Link>
            <Link href="/register" className="rounded-lg gradient-bg px-4 py-2 text-sm font-medium text-white transition-all hover:opacity-90 hover:shadow-lg hover:shadow-purple-500/20 pulse-glow">
              Comenzar Gratis
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 pt-16">
        {/* Hero */}
        <section className="relative overflow-hidden">
          {/* Animated chart lines */}
          <style>{`
            @keyframes drawLine1 { from { stroke-dashoffset: 2000; } to { stroke-dashoffset: 0; } }
            @keyframes drawLine2 { from { stroke-dashoffset: 2500; } to { stroke-dashoffset: 0; } }
            @keyframes drawLine3 { from { stroke-dashoffset: 3000; } to { stroke-dashoffset: 0; } }
            .chart-line-1 { stroke-dasharray: 2000; stroke-dashoffset: 2000; animation: drawLine1 20s linear infinite; }
            .chart-line-2 { stroke-dasharray: 2500; stroke-dashoffset: 2500; animation: drawLine2 25s linear infinite; }
            .chart-line-3 { stroke-dasharray: 3000; stroke-dashoffset: 3000; animation: drawLine3 30s linear infinite; }
          `}</style>
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <svg width="100%" height="100%" viewBox="0 0 1200 400" preserveAspectRatio="none">
              <polyline className="chart-line-1" fill="none" stroke="#8b5cf6" strokeWidth="2" opacity="0.06"
                points="0,320 80,300 160,310 240,270 320,280 400,240 480,255 560,210 640,225 720,180 800,195 880,150 960,165 1040,120 1120,135 1200,90" />
              <polyline className="chart-line-2" fill="none" stroke="#8b5cf6" strokeWidth="2" opacity="0.04"
                points="0,360 100,340 200,355 300,315 380,330 460,295 540,310 620,265 700,280 780,235 860,250 940,205 1020,220 1100,170 1200,140" />
              <polyline className="chart-line-3" fill="none" stroke="#6366f1" strokeWidth="1.5" opacity="0.04"
                points="0,380 60,365 140,375 220,345 300,360 400,320 480,335 560,290 660,305 760,255 840,270 920,225 1000,240 1100,190 1200,160" />
            </svg>
          </div>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.07),transparent_60%)] pointer-events-none" />

          {/* Floating metric bubbles */}
          <div className="absolute top-24 right-8 animate-float opacity-0 anim-d4 pointer-events-none hidden xl:block" style={{animationFillMode:"both"}}>
            <div className="rounded-2xl border border-purple-400/20 bg-card/80 backdrop-blur-sm px-4 py-3 shadow-xl">
              <p className="text-[10px] text-muted-foreground">Ingresos YTD</p>
              <p className="text-lg font-bold text-foreground">$2.4M</p>
              <p className="text-[10px] text-emerald-500 font-medium">↑ +12%</p>
            </div>
          </div>
          <div className="absolute top-48 right-40 animate-float-d1 opacity-0 anim-d5 pointer-events-none hidden xl:block" style={{animationFillMode:"both"}}>
            <div className="rounded-2xl border border-purple-400/15 bg-card/60 backdrop-blur-sm px-4 py-3 shadow-lg">
              <p className="text-[10px] text-muted-foreground">Nuevos Clientes</p>
              <p className="text-lg font-bold text-foreground">+23%</p>
            </div>
          </div>
          <div className="absolute top-72 right-12 animate-float-d2 opacity-0 anim-d6 pointer-events-none hidden xl:block" style={{animationFillMode:"both"}}>
            <div className="rounded-2xl border border-purple-400/15 bg-card/60 backdrop-blur-sm px-4 py-3 shadow-lg">
              <p className="text-[10px] text-muted-foreground">Ventas</p>
              <p className="text-lg font-bold text-foreground">847 ↑</p>
            </div>
          </div>

          <div className="container relative mx-auto px-4 py-20 text-center sm:py-32">
            <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm text-primary animate-scale-in">
              <Zap className="h-3.5 w-3.5" />
              Potenciado con Inteligencia Artificial
            </div>

            <h1 className="mx-auto max-w-4xl text-3xl font-bold tracking-tight text-foreground sm:text-5xl md:text-7xl animate-fade-in-up anim-d1">
              Todos los números de tu empresa,{" "}
              <span className="gradient-text">en un solo lugar</span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground anim-d2">
              Conecta tu ERP y CRM, visualiza métricas en tiempo real y recibe
              reportes inteligentes con IA. Toma mejores decisiones, más rápido.
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row anim-d3">
              <Link
                href="/register"
                className="group flex w-full items-center justify-center gap-2 rounded-xl gradient-bg px-8 py-3.5 text-lg font-medium text-white transition-all hover:opacity-90 hover:shadow-xl hover:shadow-purple-500/25 hover:-translate-y-0.5 pulse-glow sm:w-auto"
              >
                Prueba 14 días gratis
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1.5" />
              </Link>
              <Link
                href="/pricing"
                className="w-full rounded-xl border border-border bg-card px-8 py-3.5 text-center text-lg font-medium text-foreground transition-all hover:bg-secondary hover:border-primary/30 hover:-translate-y-0.5 hover:shadow-md sm:w-auto"
              >
                Ver precios
              </Link>
            </div>

            {/* Dashboard preview */}
            <div className="relative mx-auto mt-20 max-w-5xl anim-d4">
              <div className="rounded-2xl border border-border bg-card p-2 shadow-2xl shadow-purple-500/10 card-hover">
                <div className="rounded-xl bg-secondary/30 p-4 sm:p-6">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-4">
                    {[
                      { label: "Ingresos YTD", value: "$2.4M", trend: "+12%" },
                      { label: "Ventas del Mes", value: "847", trend: "+8%" },
                      { label: "Gasto en Ads", value: "$45K", trend: "-3%" },
                      { label: "Margen Neto", value: "23.5%", trend: "+2%" },
                    ].map((card, i) => (
                      <div key={card.label} className={`rounded-lg border border-border bg-card p-3 sm:p-4 card-hover anim-d${i + 1}`}>
                        <p className="text-[10px] text-muted-foreground sm:text-xs">{card.label}</p>
                        <p className="mt-1 text-base font-bold text-foreground sm:text-xl">{card.value}</p>
                        <p className={`text-[10px] font-medium sm:text-xs ${card.trend.startsWith("+") ? "text-emerald-500" : "text-red-500"}`}>{card.trend} vs mes anterior</p>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-border bg-card p-4">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Ingresos vs Gastos (12 meses)</p>
                      <div className="flex items-end gap-1 h-24 sm:h-32">
                        {[40,65,50,80,60,75,90,55,70,85,60,78].map((h, i) => (
                          <div key={i} className="flex-1 flex flex-col gap-0.5 justify-end h-full">
                            <div className="rounded-t gradient-bg bar-grow" style={{ height: `${h}%` }} />
                            <div className="rounded-t bg-destructive/30 bar-grow" style={{ height: `${h * 0.6}%` }} />
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
                        ].map((c, i) => (
                          <div key={c.name} className={`flex items-center justify-between rounded-md bg-secondary/50 px-2.5 py-2 text-[11px] sm:text-xs transition-colors hover:bg-secondary anim-d${i+1}`}>
                            <div className="flex items-center gap-2">
                              <div className={`h-1.5 w-1.5 rounded-full ${c.status === "Activa" ? "bg-emerald-500" : "bg-amber-500"}`} style={c.status === "Activa" ? {boxShadow:"0 0 6px rgba(34,197,94,0.6)"} : {}} />
                              <span className="font-medium text-foreground">{c.name}</span>
                            </div>
                            <div className="flex items-center gap-3 text-muted-foreground">
                              <span>{c.spend}</span><span>CTR {c.ctr}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Stats bar */}
        <section className="border-t border-border bg-secondary/30 py-10">
          <div className="container mx-auto px-4">
            <p className="text-center text-sm font-medium uppercase tracking-widest text-muted-foreground animate-fade-in-up">Diseñado para empresas mexicanas</p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-8 sm:gap-16">
              {[
                { value: "5", label: "Categorías de métricas" },
                { value: "3+", label: "Integraciones" },
                { value: "IA", label: "con Claude" },
              ].map((s, i) => (
                <div key={s.label} className={`text-center anim-d${i+1} card-hover rounded-xl px-6 py-3`}>
                  <p className="text-3xl font-bold gradient-text">{s.value}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="relative border-t border-border py-24">
          <div className="container mx-auto px-4">
            <div className="text-center animate-fade-in-up">
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
                  color: "bg-primary/10 text-primary",
                  delay: "anim-d1",
                },
                {
                  icon: Brain,
                  title: "Reportes con IA",
                  description: "Recibe análisis mensuales generados por inteligencia artificial con insights accionables y recomendaciones.",
                  color: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400",
                  delay: "anim-d2",
                },
                {
                  icon: Globe,
                  title: "Web + Mobile",
                  description: "Dashboards personalizables disponibles en web y app nativa. Tus KPIs siempre contigo.",
                  color: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400",
                  delay: "anim-d3",
                },
              ].map((feature) => (
                <div
                  key={feature.title}
                  className={`group rounded-2xl border border-border bg-card p-6 transition-all hover:shadow-xl hover:shadow-purple-500/10 hover:-translate-y-1 hover:border-primary/30 sm:p-8 card-hover ${feature.delay}`}
                >
                  <div className={`inline-flex rounded-xl ${feature.color} p-3 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}>
                    <feature.icon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-foreground">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="border-t border-border py-24 bg-secondary/30">
          <div className="container mx-auto px-4">
            <div className="text-center animate-fade-in-up">
              <h2 className="text-3xl font-bold text-foreground sm:text-4xl">
                Cómo <span className="gradient-text">Funciona</span>
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-muted-foreground">Tres pasos para tener el control total de tu empresa.</p>
            </div>

            <div className="relative mt-16 flex flex-col items-center gap-12 lg:flex-row lg:justify-center lg:gap-0">
              <div className="hidden lg:block absolute top-10 left-1/2 -translate-x-1/2 w-2/3 h-0.5 bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
              {[
                { step: "1", title: "Conecta", description: "Integra tu ERP, CRM y plataformas publicitarias en minutos", delay: "anim-d1" },
                { step: "2", title: "Visualiza", description: "Todas tus métricas en un dashboard centralizado y configurable", delay: "anim-d2" },
                { step: "3", title: "Decide", description: "Recibe reportes con IA y toma decisiones basadas en datos", delay: "anim-d3" },
              ].map((item) => (
                <div key={item.step} className={`relative z-10 flex flex-col items-center text-center lg:flex-1 lg:px-8 ${item.delay}`}>
                  <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-primary bg-card text-2xl font-bold text-primary shadow-lg shadow-purple-500/10 transition-all hover:shadow-xl hover:shadow-purple-500/25 hover:scale-110 neon-pulse">
                    {item.step}
                  </div>
                  <h3 className="mt-4 text-xl font-semibold text-foreground">{item.title}</h3>
                  <p className="mt-2 max-w-xs text-sm text-muted-foreground">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Stats grid */}
        <section className="border-t border-border py-24">
          <div className="container mx-auto px-4">
            <div className="text-center animate-fade-in-up">
              <h2 className="text-3xl font-bold text-foreground sm:text-4xl">
                Construido para <span className="gradient-text">tu operación</span>
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-muted-foreground">Capacidades reales del producto, sin números inflados.</p>
            </div>

            <div className="mt-16 grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { stat: "5 Categorías", description: "Finanzas, Ventas, Ops, RH, Marketing", delay: "anim-d1" },
                { stat: "3 Integraciones", description: "Meta Ads, QuickBooks, HubSpot", delay: "anim-d2" },
                { stat: "IA Integrada", description: "Reportes automáticos con Claude", delay: "anim-d3" },
                { stat: "CSV + Manual", description: "Importa datos como quieras", delay: "anim-d4" },
              ].map((item) => (
                <div key={item.stat} className={`rounded-2xl border border-border bg-card p-6 text-center card-hover ${item.delay}`}>
                  <p className="text-2xl font-bold gradient-text">{item.stat}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-border py-24">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-3xl rounded-2xl border border-primary/20 bg-card p-8 text-center shadow-xl shadow-purple-500/10 card-hover animate-fade-in-up" style={{background:"linear-gradient(135deg,rgba(99,102,241,0.04),rgba(139,92,246,0.08))"}}>
              <div className="mx-auto mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl gradient-bg shadow-lg shadow-purple-500/30 animate-float-logo icon-pop">
                <Shield className="h-8 w-8 text-white" />
              </div>
              <h2 className="mt-4 text-3xl font-bold text-foreground">Conecta. Visualiza. Decide.</h2>
              <p className="mt-3 text-muted-foreground">Únete a los empresarios que ya toman decisiones basadas en datos reales.</p>
              <Link
                href="/register"
                className="group mt-8 inline-flex items-center gap-2 rounded-xl gradient-bg px-8 py-3.5 text-lg font-medium text-white transition-all hover:opacity-90 hover:shadow-xl hover:shadow-purple-500/30 hover:-translate-y-0.5 pulse-glow"
              >
                Comenzar Ahora
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1.5" />
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
