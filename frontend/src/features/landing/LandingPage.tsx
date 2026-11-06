import { useState } from 'react'
import { Link } from 'react-router'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight, ArrowUpRight, BarChart3, Boxes, CheckCircle2, ClipboardList, FileBarChart, Flame, FlaskConical,
  Leaf, Mail, MapPin, Menu, Phone, ShoppingCart, Sprout, Thermometer, TrendingUp, Wheat, X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Logo } from '@/components/shared/Logo'
import { api, errorMessage } from '@/lib/api'
import { fmtCompact } from '@/lib/format'
import { useAuth } from '@/stores/auth'
import hero from '@/assets/img/hero.jpg'
import racks from '@/assets/img/racks.jpg'
import pink from '@/assets/img/pink-oyster.jpg'
import bags from '@/assets/img/bags.jpg'
import cluster from '@/assets/img/oyster-cluster.jpg'
import mycelium from '@/assets/img/mycelium.jpg'
import closeup from '@/assets/img/bag-closeup.jpg'

const NAV = [['Home', '#home'], ['Features', '#features'], ['How It Works', '#how'], ['About', '#about'], ['Contact', '#contact']]

const FEATURES = [
  { icon: Sprout, title: 'Farm Production Management', text: 'Plan batches across farms and grow rooms with unique batch codes and full traceability.' },
  { icon: Leaf, title: 'Mushroom Growth Tracking', text: 'Log temperature, humidity, condition and contamination for every batch, every day.' },
  { icon: Wheat, title: 'Harvest Management', text: 'Record multiple flushes, approve submissions and compare actual against expected yield.' },
  { icon: ShoppingCart, title: 'Sales & Revenue Tracking', text: 'Multi-line orders, partial payments, invoices and outstanding balances in one place.' },
  { icon: Boxes, title: 'Inventory Management', text: 'Fresh stock updates itself from approved harvests and sales. Low-stock alerts for supplies.' },
  { icon: BarChart3, title: 'Performance Analytics', text: 'Yield per bag, success rates, cost per kilogram and monthly profit, always up to date.' },
  { icon: Thermometer, title: 'Environmental Monitoring', text: 'Readings outside each variety’s recommended range raise an alert immediately.' },
  { icon: FileBarChart, title: 'Farm Reports', text: 'Production, harvest, sales, financial and inventory reports ready to export.' },
]

const STEPS = [
  { icon: Wheat, title: 'Substrate Preparation', text: 'Mix and hydrate straw, sawdust or compost.' },
  { icon: Flame, title: 'Spawning', text: 'Sterilize, inoculate and seal growing bags.' },
  { icon: FlaskConical, title: 'Incubation', text: 'Mycelium colonises the substrate in the dark.' },
  { icon: Sprout, title: 'Fruiting', text: 'Pins form under light, fresh air and humidity.' },
  { icon: ClipboardList, title: 'Harvesting', text: 'Pick each flush, grade it and send it for approval.' },
  { icon: TrendingUp, title: 'Sales', text: 'Approved stock is sold, invoiced and tracked.' },
]

const BENEFITS = [
  'Know exactly which batches need attention today',
  'Stop guessing yields: compare expected and actual for every flush',
  'Stock that matches reality, updated by harvests and sales',
  'Role-based access for owners, managers, workers and sales teams',
]

// jagged 'torn paper' edge spanning the full 1440 viewBox width
const TORN_PATH = (() => {
  const ys = [18, 24, 12, 21, 8, 18, 10, 21, 8, 17, 11, 23, 13, 21, 9, 19, 12, 23, 14, 20, 8, 17, 12, 20, 10, 17, 14, 18]
  const step = 1440 / (ys.length - 1)
  return `M0 40 ${ys.map((y, i) => `L${(i * step).toFixed(1)} ${y}`).join(' ')} L1440 40 Z`
})()

function Torn({ className = '', flip = false }: { className?: string; flip?: boolean }) {
  return (
    <svg viewBox="0 0 1440 40" preserveAspectRatio="none" className={`block h-6 w-full sm:h-10 ${flip ? 'rotate-180' : ''} ${className}`} aria-hidden>
      <path d={TORN_PATH} fill="currentColor" />
    </svg>
  )
}

export function LandingPage() {
  const user = useAuth((s) => s.user)
  const [open, setOpen] = useState(false)
  const stats = useQuery({
    queryKey: ['public-stats'],
    queryFn: async () => (await api.get('/public/stats')).data.data as { farms: number; batches: number; harvested_kg: number; varieties: number },
  })
  const [sending, setSending] = useState(false)

  const ctaHref = user ? '/app' : '/register'

  return (
    <div className="min-h-svh bg-[#F8FAF7] text-[#202B25]">
      {/* ------------------------------------------------ nav */}
      <header className="sticky top-0 z-40 border-b border-black/5 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6">
          <Link to="/"><Logo /></Link>
          <nav className="ml-auto hidden items-center gap-7 text-sm font-medium text-[#4A564F] lg:flex">
            {NAV.map(([l, h]) => <a key={h} href={h} className="hover:text-forest">{l}</a>)}
          </nav>
          <div className="ml-auto hidden items-center gap-2 lg:ml-4 lg:flex">
            <Button asChild variant="ghost" className="text-[#202B25] hover:bg-black/5"><Link to={user ? '/app' : '/login'}>{user ? 'Dashboard' : 'Login'}</Link></Button>
            <Button asChild className="h-9 bg-[#202B25] px-4 text-white hover:bg-[#202B25]/90"><Link to={ctaHref}>Get Started</Link></Button>
          </div>
          <button className="ml-auto rounded-md p-2 lg:hidden" onClick={() => setOpen(!open)} aria-label="Menu">{open ? <X /> : <Menu />}</button>
        </div>
        {open && (
          <div className="border-t bg-white px-4 py-3 lg:hidden">
            {NAV.map(([l, h]) => <a key={h} href={h} onClick={() => setOpen(false)} className="block py-2 text-sm font-medium">{l}</a>)}
            <div className="mt-2 flex gap-2">
              <Button asChild variant="outline" className="flex-1"><Link to="/login">Login</Link></Button>
              <Button asChild className="flex-1 bg-forest text-white"><Link to={ctaHref}>Get Started</Link></Button>
            </div>
          </div>
        )}
      </header>

      {/* ------------------------------------------------ hero */}
      <section id="home" className="relative overflow-hidden bg-forest text-white">
        <Torn className="absolute top-0 left-0 z-10 text-white" flip />
        <img src={hero} alt="Grower inspecting oyster mushroom bags on shelves in a grow room" className="absolute inset-0 h-full w-full object-cover object-[70%_center]" />
        <div className="absolute inset-0 bg-gradient-to-r from-forest via-forest/90 to-forest/20" />
        <div className="relative mx-auto grid min-h-[560px] max-w-7xl items-center px-4 py-24 sm:px-6 lg:min-h-[640px]">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="max-w-2xl">
            <p className="eyebrow text-beige">Mushroom farm management</p>
            <h1 className="mt-5 text-4xl leading-[1.08] font-bold tracking-tight sm:text-6xl">
              Grow Smarter.<br />Harvest Better.<br /><span className="text-beige">Manage Your Mushroom Farm.</span>
            </h1>
            <p className="mt-6 max-w-lg text-base leading-relaxed text-white/80">
              One place to run every batch from substrate to sale: track growth, approve harvests, keep stock accurate and
              see what each kilogram earns.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild className="h-11 rounded-md bg-cta px-6 text-sm font-semibold text-white hover:bg-cta-hover">
                <Link to={ctaHref}>Get Started <ArrowUpRight /></Link>
              </Button>
              <Button asChild variant="outline" className="h-11 rounded-md border-white/40 bg-transparent px-6 text-white hover:bg-white/10 hover:text-white">
                <a href="#features">Explore Features</a>
              </Button>
            </div>
          </motion.div>
          <div className="absolute right-6 bottom-12 hidden items-center gap-3 rounded-full bg-white/10 py-1.5 pr-4 pl-1.5 backdrop-blur md:flex">
            <div className="flex -space-x-3">
              {[cluster, pink, closeup].map((s, i) => <img key={i} src={s} alt="" className="size-10 rounded-full border-2 border-white object-cover" />)}
            </div>
            <span className="text-xs text-white/90">Oyster · Button · Shiitake · King Oyster</span>
          </div>
        </div>
        <Torn className="absolute bottom-0 left-0 text-[#F8FAF7]" />
      </section>

      {/* ------------------------------------------------ about */}
      <section id="about" className="relative overflow-hidden py-20 sm:py-28">
        <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-2">
          <div className="relative mx-auto w-full max-w-md lg:max-w-none">
            <img src={racks} alt="Racks of colonised mushroom growing bags" className="aspect-[4/5] w-4/5 rounded-sm object-cover shadow-xl" />
            <img src={pink} alt="Pink oyster mushrooms fruiting" className="absolute right-0 -bottom-8 aspect-square w-1/2 rounded-sm border-8 border-[#F8FAF7] object-cover shadow-xl" />
            <div className="absolute top-1/2 -left-2 flex items-center gap-3 rounded-lg bg-white px-4 py-3 shadow-lg sm:-left-8">
              <span className="grid size-9 place-items-center rounded-full bg-fresh text-white"><Phone className="size-4" /></span>
              <div><p className="text-[11px] text-[#7B897F]">Talk to us</p><p className="text-sm font-semibold">+250 789 534 004</p></div>
            </div>
          </div>
          <div>
            <p className="eyebrow text-fresh">Built for growers</p>
            <h2 className="mt-3 text-3xl leading-tight font-bold tracking-tight sm:text-4xl">From spawn to sale, every batch on the record.</h2>
            <p className="mt-5 font-semibold">Designed with working mushroom farms, not generic agriculture.</p>
            <p className="mt-3 leading-relaxed text-[#5E6B63]">
              MycoFarm understands flushes, incubation windows, contamination and short shelf lives. Workers record what they see,
              managers approve what's harvested, and owners see production, sales and costs come together without spreadsheets.
            </p>
            <ul className="mt-6 space-y-2.5">
              {BENEFITS.map((b) => <li key={b} className="flex gap-2.5 text-sm"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-fresh" />{b}</li>)}
            </ul>
            <Button asChild className="mt-8 h-11 rounded-md bg-[#202B25] px-6 text-white hover:bg-[#202B25]/90"><Link to={ctaHref}>Start managing <ArrowUpRight /></Link></Button>
          </div>
        </div>
        <p className="watermark pointer-events-none absolute right-0 bottom-0 left-0 text-center text-[13vw] sm:text-[10vw]">MUSHROOMS</p>
      </section>

      {/* ------------------------------------------------ features */}
      <section id="features" className="relative bg-forest pt-16 pb-24 text-white">
        <Torn className="absolute -top-px left-0 text-[#F8FAF7]" flip />
        <div className="mx-auto max-w-7xl px-4 pt-10 sm:px-6">
          <div className="grid gap-6 lg:grid-cols-2 lg:items-end">
            <div>
              <p className="eyebrow text-beige">Platform features</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Everything a mushroom farm runs on.</h2>
            </div>
            <p className="text-white/75 lg:pb-1">Eight connected modules share one database, so a harvest approval updates stock, and a sale updates revenue, without anyone re-typing it.</p>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f, i) => (
              <motion.div key={f.title} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.05 }}
                className="group rounded-sm bg-white p-6 text-[#202B25] transition-transform hover:-translate-y-1">
                <span className="grid size-11 place-items-center rounded-full bg-[#E7F0E8] text-forest transition-colors group-hover:bg-cta group-hover:text-white"><f.icon className="size-5" /></span>
                <h3 className="mt-5 font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#5E6B63]">{f.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
        <Torn className="absolute bottom-0 left-0 text-[#F8FAF7]" />
      </section>

      {/* ------------------------------------------------ how it works */}
      <section id="how" className="py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="eyebrow text-fresh">How it works</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">The full production lifecycle, tracked.</h2>
            <p className="mt-4 text-[#5E6B63]">Each batch moves through these stages. Every transition is recorded with who made it, when, and why.</p>
          </div>
          <div className="relative mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-6 lg:gap-4">
            <div className="absolute top-7 right-[8%] left-[8%] hidden border-t-2 border-dashed border-fresh/50 lg:block" />
            {STEPS.map((s, i) => (
              <div key={s.title} className="relative text-center">
                <span className="relative mx-auto grid size-14 place-items-center rounded-full border-4 border-[#F8FAF7] bg-forest text-white shadow-md">
                  <s.icon className="size-6" />
                  <span className="absolute -top-1 -right-1 grid size-5 place-items-center rounded-full bg-cta text-[10px] font-bold">{i + 1}</span>
                </span>
                <h3 className="mt-4 text-sm font-semibold">{s.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-[#5E6B63]">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ stats band */}
      <section className="relative overflow-hidden">
        <img src={bags} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-forest/90" />
        <div className="relative mx-auto grid max-w-7xl gap-8 px-4 py-16 text-white sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
          {[
            ['Farms managed', stats.data?.farms],
            ['Production batches tracked', stats.data?.batches],
            ['Kilograms harvested', stats.data?.harvested_kg],
            ['Mushroom varieties', stats.data?.varieties],
          ].map(([l, v]) => (
            <div key={l as string} className="border-l-2 border-cta pl-5">
              <p className="text-4xl font-bold tabular-nums">{v === undefined ? '—' : fmtCompact(v as number)}</p>
              <p className="mt-1 text-sm text-white/70">{l}</p>
            </div>
          ))}
        </div>
        <p className="relative pb-4 text-center text-[11px] text-white/50">Live figures from this installation’s database.</p>
      </section>

      {/* ------------------------------------------------ cta + contact */}
      <section id="contact" className="py-20 sm:py-28">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <p className="eyebrow text-fresh">Get in touch</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight">Have a farm to set up? Let’s talk.</h2>
            <p className="mt-4 text-[#5E6B63]">Tell us how many rooms and varieties you run and we’ll help you get your first batches on the system.</p>
            <div className="mt-8 space-y-4 text-sm">
              <p className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-full bg-[#E7F0E8] text-forest"><MapPin className="size-4" /></span>KG 7 Ave, Kigali, Rwanda</p>
              <p className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-full bg-[#E7F0E8] text-forest"><Phone className="size-4" /></span>+250 789 534 004</p>
              <p className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-full bg-[#E7F0E8] text-forest"><Mail className="size-4" /></span>hello@mycofarm.rw</p>
            </div>
            <img src={mycelium} alt="Close-up of mycelium colonising substrate" className="mt-8 hidden aspect-video w-full rounded-sm object-cover lg:block" />
          </div>
          <form
            className="rounded-sm border border-black/5 bg-white p-6 shadow-sm sm:p-8 lg:col-span-3"
            onSubmit={async (e) => {
              e.preventDefault()
              const fd = new FormData(e.currentTarget)
              setSending(true)
              try {
                const r = await api.post('/public/contact', Object.fromEntries(fd))
                toast.success(r.data.message); (e.target as HTMLFormElement).reset()
              } catch (err) { toast.error(errorMessage(err)) } finally { setSending(false) }
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm font-medium">Name<Input name="name" required className="h-11 bg-white" /></label>
              <label className="grid gap-1.5 text-sm font-medium">Email<Input name="email" type="email" required className="h-11 bg-white" /></label>
              <label className="grid gap-1.5 text-sm font-medium sm:col-span-2">Message<Textarea name="message" required rows={6} className="bg-white" placeholder="Tell us about your farm…" /></label>
            </div>
            <Button disabled={sending} className="mt-5 h-11 rounded-md bg-cta px-6 text-white hover:bg-cta-hover">{sending ? 'Sending…' : 'Send message'} <ArrowRight /></Button>
          </form>
        </div>
      </section>

      {/* ------------------------------------------------ footer */}
      <footer className="relative bg-[#16301F] text-white/80">
        <Torn className="absolute -top-px left-0 text-[#F8FAF7]" flip />
        <div className="mx-auto grid max-w-7xl gap-10 px-4 pt-20 pb-10 sm:px-6 md:grid-cols-4">
          <div className="md:col-span-2">
            <Logo light />
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/60">Production, harvest, inventory and sales management for mushroom farms of every size.</p>
          </div>
          <div>
            <p className="eyebrow text-[10px] text-beige">Explore</p>
            <ul className="mt-4 space-y-2 text-sm">{NAV.map(([l, h]) => <li key={h}><a href={h} className="hover:text-white">{l}</a></li>)}</ul>
          </div>
          <div>
            <p className="eyebrow text-[10px] text-beige">Contact</p>
            <ul className="mt-4 space-y-2 text-sm"><li>hello@mycofarm.rw</li><li>+250 789 534 004</li><li>Kigali, Rwanda</li></ul>
          </div>
        </div>
        <div className="border-t border-white/10 py-5 text-center text-xs text-white/40">
          © {new Date().getFullYear()} MycoFarm.
        </div>
      </footer>
    </div>
  )
}
