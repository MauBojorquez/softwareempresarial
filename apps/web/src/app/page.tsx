import Link from "next/link";
import {
  BarChart3, Brain, Zap, ArrowRight, Shield, Globe, Target, Megaphone,
  TrendingUp, DollarSign, Sparkles, Trophy, LineChart, Wallet,
} from "lucide-react";
import {
  MetaLogo, GoogleLogo, HubSpotLogo, QuickBooksLogo, StripeLogo, GoogleSheetsLogo,
} from "@/components/brand-logos";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-background overflow-x-hidden">
      {/* Header */}
      <header className="fixed top-0 z-50 w-full border-b border-border/60 bg-card/70 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg gradient-bg flex items-center justify-center animate-float-logo">
              <span className="text-xs font-bold text-white">S</span>
            </div>
            <span className="text-lg font-bold text-foreground">MetrixPro</span>
          </div>
          <nav className="hidden items-center gap-8 md:flex">
            <Link href="#features" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Funciones</Link>
            <Link href="#showcase" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Ejemplos</Link>
            <Link href="/pricing" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Precios</Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline">Iniciar Sesión</Link>
            <Link href="/register" className="rounded-lg gradient-bg px-4 py-2 text-sm font-medium text-white transition-all hover:opacity-90 hover:shadow-lg hover:shadow-primary/25 pulse-glow">
              Comenzar Gratis
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 pt-16">
        {/* ── Hero ─────────────────────────────────────────────── */}
        <section className="relative overflow-hidden">
          {/* Colorful aurora + floating orbs */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="aurora absolute -top-40 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full opacity-25 blur-3xl" />
            <div className="absolute top-20 -left-20 h-72 w-72 rounded-full bg-violet-500/30 blur-3xl animate-float" />
            <div className="absolute top-40 -right-16 h-72 w-72 rounded-full bg-sky-500/25 blur-3xl animate-float-d1" />
            <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-fuchsia-500/20 blur-3xl animate-float-d2" />
          </div>

          {/* Floating colorful metric chips */}
          <div className="absolute top-28 right-10 hidden xl:block animate-float opacity-0 anim-d4" style={{ animationFillMode: "both" }}>
            <div className="flex items-center gap-2 rounded-2xl border border-emerald-300/30 bg-card/80 px-4 py-3 shadow-xl backdrop-blur-sm">
              <div className="rounded-lg bg-emerald-500/15 p-2"><TrendingUp className="h-4 w-4 text-emerald-500" /></div>
              <div><p className="text-[10px] text-muted-foreground">Ingresos YTD</p><p className="text-sm font-bold text-foreground">$2.4M ↑</p></div>
            </div>
          </div>
          <div className="absolute top-56 right-44 hidden xl:block animate-float-d1 opacity-0 anim-d5" style={{ animationFillMode: "both" }}>
            <div className="flex items-center gap-2 rounded-2xl border border-fuchsia-300/30 bg-card/70 px-4 py-3 shadow-lg backdrop-blur-sm">
              <div className="rounded-lg bg-fuchsia-500/15 p-2"><Megaphone className="h-4 w-4 text-fuchsia-500" /></div>
              <div><p className="text-[10px] text-muted-foreground">ROAS</p><p className="text-sm font-bold text-foreground">4.8x</p></div>
            </div>
          </div>
          <div className="absolute top-80 right-6 hidden xl:block animate-float-d2 opacity-0 anim-d6" style={{ animationFillMode: "both" }}>
            <div className="flex items-center gap-2 rounded-2xl border border-amber-300/30 bg-card/70 px-4 py-3 shadow-lg backdrop-blur-sm">
              <div className="rounded-lg bg-amber-500/15 p-2"><Trophy className="h-4 w-4 text-amber-500" /></div>
              <div><p className="text-[10px] text-muted-foreground">Meta cumplida</p><p className="text-sm font-bold text-foreground">112%</p></div>
            </div>
          </div>

          <div className="container relative mx-auto px-4 py-20 text-center sm:py-28">
            <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm text-primary animate-scale-in">
              <Zap className="h-3.5 w-3.5" /> Potenciado con Inteligencia Artificial
            </div>

            <h1 className="mx-auto max-w-4xl text-4xl font-bold tracking-tight text-foreground sm:text-5xl md:text-7xl animate-fade-in-up anim-d1">
              Todos los números de tu empresa,{" "}
              <span className="relative inline-block">
                <span className="aurora bg-clip-text text-transparent" style={{ WebkitBackgroundClip: "text", backgroundClip: "text" }}>en un solo lugar</span>
              </span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground anim-d2">
              Conecta tu CRM, tus finanzas y tu publicidad. Visualiza todo en tiempo real
              y recibe reportes con IA. Toma mejores decisiones, más rápido.
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row anim-d3">
              <Link href="/register" className="group flex w-full items-center justify-center gap-2 rounded-xl gradient-bg px-8 py-3.5 text-lg font-medium text-white transition-all hover:opacity-90 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5 pulse-glow sm:w-auto">
                Prueba 14 días gratis
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1.5" />
              </Link>
              <Link href="#showcase" className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card/70 px-8 py-3.5 text-lg font-medium text-foreground backdrop-blur-sm transition-all hover:bg-secondary hover:border-primary/30 hover:-translate-y-0.5 sm:w-auto">
                Ver ejemplos
              </Link>
            </div>

            {/* Product preview with colorful charts */}
            <div className="relative mx-auto mt-16 max-w-5xl anim-d4">
              <div className="absolute -inset-1 rounded-3xl aurora opacity-30 blur-2xl" />
              <div className="relative rounded-2xl border border-border bg-card p-2 shadow-2xl">
                <div className="rounded-xl bg-secondary/30 p-4 sm:p-6">
                  <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                      { label: "Ingresos", value: "$2.4M", trend: "+12%", color: "from-emerald-500 to-teal-500", icon: DollarSign },
                      { label: "Ventas", value: "847", trend: "+8%", color: "from-blue-500 to-indigo-500", icon: TrendingUp },
                      { label: "Ads", value: "$45K", trend: "4.8x", color: "from-fuchsia-500 to-pink-500", icon: Megaphone },
                      { label: "Margen", value: "23.5%", trend: "+2%", color: "from-amber-500 to-orange-500", icon: Wallet },
                    ].map((c) => (
                      <div key={c.label} className="rounded-lg border border-border bg-card p-3 text-left card-hover">
                        <div className={`mb-2 inline-flex rounded-lg bg-gradient-to-br ${c.color} p-1.5`}>
                          <c.icon className="h-3.5 w-3.5 text-white" />
                        </div>
                        <p className="text-[10px] text-muted-foreground">{c.label}</p>
                        <p className="text-base font-bold text-foreground sm:text-lg">{c.value}</p>
                        <p className="text-[10px] font-medium text-emerald-500">{c.trend}</p>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-border bg-card p-4">
                      <p className="mb-3 text-xs font-medium text-muted-foreground">Ingresos vs Gastos</p>
                      <div className="flex h-28 items-end gap-1.5 sm:h-32">
                        {[40, 65, 50, 80, 60, 75, 90, 55, 70, 85, 95, 78].map((h, i) => (
                          <div key={i} className="flex h-full flex-1 flex-col justify-end gap-0.5">
                            <div className="rounded-t bg-gradient-to-t from-indigo-500 to-violet-400 bar-grow" style={{ height: `${h}%` }} />
                            <div className="rounded-t bg-rose-400/40 bar-grow" style={{ height: `${h * 0.55}%` }} />
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-lg border border-border bg-card p-4">
                      <p className="mb-3 text-xs font-medium text-muted-foreground">Metas del trimestre</p>
                      <div className="space-y-3">
                        {[
                          { name: "Ingresos", pct: 92, color: "from-emerald-500 to-teal-500" },
                          { name: "Nuevos clientes", pct: 74, color: "from-blue-500 to-indigo-500" },
                          { name: "Reducir costos", pct: 100, color: "from-fuchsia-500 to-pink-500" },
                        ].map((g) => (
                          <div key={g.name}>
                            <div className="mb-1 flex justify-between text-[11px]"><span className="text-muted-foreground">{g.name}</span><span className="font-semibold text-foreground">{g.pct}%</span></div>
                            <div className="h-2.5 overflow-hidden rounded-full bg-secondary">
                              <div className={`h-full rounded-full bg-gradient-to-r ${g.color}`} style={{ width: `${g.pct}%` }} />
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

        {/* ── Integrations strip ───────────────────────────────── */}
        <section className="border-y border-border bg-secondary/30 py-10">
          <div className="container mx-auto px-4">
            <p className="text-center text-xs font-medium uppercase tracking-widest text-muted-foreground">Se conecta con tus herramientas favoritas</p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
              {[
                { name: "Meta Ads", node: <MetaLogo className="h-5 w-5" /> },
                { name: "Google", node: <GoogleLogo className="h-5 w-5" /> },
                { name: "HubSpot", node: <HubSpotLogo className="h-5 w-5" /> },
                { name: "QuickBooks", node: <QuickBooksLogo className="h-5 w-5" /> },
                { name: "Stripe", node: <StripeLogo className="h-5 w-5" /> },
                { name: "Google Sheets", node: <GoogleSheetsLogo className="h-5 w-5" /> },
              ].map((b) => (
                <div key={b.name} className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
                  {b.node}
                  <span className="text-sm font-medium text-foreground">{b.name}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Features (colorful) ──────────────────────────────── */}
        <section id="features" className="relative border-b border-border py-24">
          <div className="container mx-auto px-4">
            <div className="text-center animate-fade-in-up">
              <h2 className="text-3xl font-bold text-foreground sm:text-4xl">
                Todo lo que necesitas para <span className="gradient-text">dirigir tu empresa</span>
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-muted-foreground">Una plataforma unificada que centraliza todas las métricas de tu negocio.</p>
            </div>

            <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { icon: BarChart3, title: "Métricas en Tiempo Real", desc: "Finanzas, ventas, operaciones, RRHH y marketing. Todo sincronizado automáticamente.", grad: "from-blue-500 to-indigo-500", tint: "bg-blue-500/5" },
                { icon: Brain, title: "Reportes con IA", desc: "Análisis mensuales generados con inteligencia artificial e insights accionables.", grad: "from-violet-500 to-fuchsia-500", tint: "bg-violet-500/5" },
                { icon: Megaphone, title: "Marketing que Rinde", desc: "Conecta Meta y Google Ads. Ve tu ROAS, CTR y resultados reales por campaña.", grad: "from-fuchsia-500 to-pink-500", tint: "bg-fuchsia-500/5" },
                { icon: Target, title: "Metas tipo Videojuego", desc: "Define objetivos y sube de nivel conforme los cumples. Progreso gamificado.", grad: "from-emerald-500 to-teal-500", tint: "bg-emerald-500/5" },
                { icon: DollarSign, title: "Finanzas Claras", desc: "Ingresos, gastos, utilidad y margen. KPIs calculados automáticamente.", grad: "from-amber-500 to-orange-500", tint: "bg-amber-500/5" },
                { icon: Globe, title: "Web + Mobile", desc: "Tus dashboards disponibles en cualquier dispositivo. Tus KPIs siempre contigo.", grad: "from-sky-500 to-cyan-500", tint: "bg-sky-500/5" },
              ].map((f, i) => (
                <div key={f.title} className={`group rounded-2xl border border-border ${f.tint} p-6 transition-all hover:-translate-y-1.5 hover:shadow-xl hover:shadow-primary/5 card-hover anim-d${(i % 6) + 1}`}>
                  <div className={`inline-flex rounded-xl bg-gradient-to-br ${f.grad} p-3 shadow-lg transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}>
                    <f.icon className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-foreground">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Showcase: lo que puedes lograr ───────────────────── */}
        <section id="showcase" className="border-b border-border bg-secondary/20 py-24">
          <div className="container mx-auto px-4">
            <div className="text-center animate-fade-in-up">
              <h2 className="text-3xl font-bold text-foreground sm:text-4xl">Mira lo que puedes <span className="gradient-text">lograr</span></h2>
              <p className="mx-auto mt-4 max-w-xl text-muted-foreground">Ejemplos reales de cómo se ve tu información dentro de MetrixPro.</p>
            </div>

            <div className="mt-16 grid gap-6 lg:grid-cols-2">
              {/* Finance example */}
              <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-lg card-hover">
                <div className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-3 text-white">
                  <LineChart className="h-4 w-4" /><span className="text-sm font-semibold">Finanzas en tiempo real</span>
                </div>
                <div className="p-5">
                  <div className="flex items-end justify-between">
                    <div><p className="text-xs text-muted-foreground">Utilidad neta</p><p className="text-3xl font-bold text-foreground">$564,200</p></div>
                    <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600">+18.4%</span>
                  </div>
                  <div className="mt-5 flex h-24 items-end gap-2">
                    {[50, 62, 58, 71, 66, 80, 74, 88, 95].map((h, i) => (
                      <div key={i} className="flex-1 rounded-t bg-gradient-to-t from-emerald-500 to-teal-400" style={{ height: `${h}%` }} />
                    ))}
                  </div>
                </div>
              </div>

              {/* Marketing example */}
              <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-lg card-hover">
                <div className="flex items-center gap-2 bg-gradient-to-r from-fuchsia-500 to-pink-500 px-5 py-3 text-white">
                  <Megaphone className="h-4 w-4" /><span className="text-sm font-semibold">Campañas que rinden</span>
                </div>
                <div className="space-y-3 p-5">
                  {[
                    { name: "Campaña Verano", roas: "5.2x", spend: "$12,400", w: 90 },
                    { name: "Retargeting Web", roas: "4.1x", spend: "$8,700", w: 70 },
                    { name: "Prospección B2B", roas: "3.4x", spend: "$5,200", w: 55 },
                  ].map((c) => (
                    <div key={c.name}>
                      <div className="mb-1 flex justify-between text-xs"><span className="font-medium text-foreground">{c.name}</span><span className="font-semibold text-fuchsia-600">ROAS {c.roas}</span></div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-pink-500" style={{ width: `${c.w}%` }} /></div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Goals example */}
              <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-lg card-hover">
                <div className="flex items-center gap-2 bg-gradient-to-r from-violet-500 to-indigo-500 px-5 py-3 text-white">
                  <Trophy className="h-4 w-4" /><span className="text-sm font-semibold">Metas como videojuego</span>
                </div>
                <div className="grid grid-cols-2 gap-3 p-5">
                  {[
                    { name: "Ingresos", pct: 92, done: false },
                    { name: "Clientes", pct: 100, done: true },
                    { name: "Leads", pct: 64, done: false },
                    { name: "Costos", pct: 100, done: true },
                  ].map((g) => (
                    <div key={g.name} className={`rounded-xl border p-3 ${g.done ? "border-emerald-500/40 bg-emerald-500/5" : "border-border"}`}>
                      <div className="flex items-center justify-between"><span className="text-xs font-medium text-foreground">{g.name}</span>{g.done ? <Trophy className="h-3.5 w-3.5 text-emerald-500" /> : <Target className="h-3.5 w-3.5 text-primary" />}</div>
                      <p className={`mt-1 text-xl font-bold ${g.done ? "text-emerald-600" : "text-foreground"}`}>{g.pct}%</p>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary"><div className={`h-full rounded-full ${g.done ? "bg-emerald-500" : "gradient-bg"}`} style={{ width: `${g.pct}%` }} /></div>
                    </div>
                  ))}
                </div>
              </div>

              {/* AI report example */}
              <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-lg card-hover">
                <div className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-3 text-white">
                  <Sparkles className="h-4 w-4" /><span className="text-sm font-semibold">Reportes con IA</span>
                </div>
                <div className="p-5">
                  <div className="rounded-xl bg-secondary/40 p-4">
                    <div className="mb-2 flex items-center gap-2"><Brain className="h-4 w-4 text-amber-500" /><span className="text-xs font-semibold text-foreground">Resumen ejecutivo · Junio</span></div>
                    <div className="space-y-1.5">
                      <div className="h-2 w-full rounded bg-foreground/10" />
                      <div className="h-2 w-11/12 rounded bg-foreground/10" />
                      <div className="h-2 w-4/5 rounded bg-foreground/10" />
                      <div className="mt-2 h-2 w-2/3 rounded bg-amber-500/30" />
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">&quot;Tus ingresos crecieron 18% pero el costo de adquisición subió. Recomendación: reasignar presupuesto a las 2 campañas con mejor ROAS.&quot;</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Stats ────────────────────────────────────────────── */}
        <section className="border-b border-border py-20">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-2 gap-8 text-center sm:grid-cols-4">
              {[
                { v: "5", l: "Categorías de métricas", c: "from-blue-500 to-indigo-500" },
                { v: "6+", l: "Integraciones", c: "from-violet-500 to-fuchsia-500" },
                { v: "IA", l: "Reportes con Claude", c: "from-amber-500 to-orange-500" },
                { v: "24/7", l: "Datos en tiempo real", c: "from-emerald-500 to-teal-500" },
              ].map((s, i) => (
                <div key={s.l} className={`anim-d${i + 1}`}>
                  <p className={`bg-gradient-to-r ${s.c} bg-clip-text text-4xl font-bold text-transparent sm:text-5xl`}>{s.v}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{s.l}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── How it works ─────────────────────────────────────── */}
        <section className="border-b border-border bg-secondary/20 py-24">
          <div className="container mx-auto px-4">
            <div className="text-center animate-fade-in-up">
              <h2 className="text-3xl font-bold text-foreground sm:text-4xl">Cómo <span className="gradient-text">Funciona</span></h2>
              <p className="mx-auto mt-4 max-w-xl text-muted-foreground">Tres pasos para tener el control total de tu empresa.</p>
            </div>
            <div className="relative mt-16 flex flex-col items-center gap-12 lg:flex-row lg:justify-center lg:gap-0">
              <div className="absolute left-1/2 top-10 hidden h-0.5 w-2/3 -translate-x-1/2 bg-gradient-to-r from-transparent via-primary/40 to-transparent lg:block" />
              {[
                { step: "1", title: "Conecta", desc: "Integra tu CRM, finanzas y publicidad en minutos", grad: "from-blue-500 to-indigo-500" },
                { step: "2", title: "Visualiza", desc: "Todas tus métricas en un dashboard configurable", grad: "from-violet-500 to-fuchsia-500" },
                { step: "3", title: "Decide", desc: "Recibe reportes con IA y decide con datos", grad: "from-emerald-500 to-teal-500" },
              ].map((item, i) => (
                <div key={item.step} className={`relative z-10 flex flex-col items-center text-center lg:flex-1 lg:px-8 anim-d${i + 1}`}>
                  <div className={`flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br ${item.grad} text-2xl font-bold text-white shadow-xl transition-transform hover:scale-110`}>
                    {item.step}
                  </div>
                  <h3 className="mt-4 text-xl font-semibold text-foreground">{item.title}</h3>
                  <p className="mt-2 max-w-xs text-sm text-muted-foreground">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ──────────────────────────────────────────────── */}
        <section className="py-24">
          <div className="container mx-auto px-4">
            <div className="relative mx-auto max-w-4xl overflow-hidden rounded-3xl aurora p-10 text-center text-white shadow-2xl sm:p-16">
              <div className="aurora-shine pointer-events-none absolute inset-0" />
              <div className="relative">
                <div className="mx-auto mb-5 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm animate-float-logo">
                  <Shield className="h-8 w-8 text-white" />
                </div>
                <h2 className="text-3xl font-bold sm:text-4xl">Conecta. Visualiza. Decide.</h2>
                <p className="mx-auto mt-3 max-w-lg text-white/85">Únete a los empresarios que ya toman decisiones basadas en datos reales.</p>
                <Link href="/register" className="group mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-8 py-3.5 text-lg font-semibold text-primary transition-all hover:-translate-y-0.5 hover:shadow-xl">
                  Comenzar Ahora
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1.5" />
                </Link>
                <p className="mt-4 text-xs text-white/70">14 días gratis · Sin tarjeta de crédito</p>
              </div>
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
