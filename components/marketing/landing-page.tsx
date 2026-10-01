import Link from "next/link";
import {
  ArrowRight,
  Camera,
  Check,
  Clock,
  Lock,
  ShieldCheck,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BottleGauge } from "@/components/app/bottle-gauge";
import { Avatar } from "@/components/ui/avatar";
import { VerificationBadge } from "@/components/ui/badge";
import { getAuthContext } from "@/lib/auth/rbac";

export const dynamic = "force-dynamic";

const STEPS = [
  { Icon: Check, title: "Fill the bottles", body: "Whoever refills takes one photo. Ten seconds, phone in hand." },
  { Icon: Camera, title: "Capture proof", body: "Bottles and cooler in the same frame. Optional location adds confidence." },
  { Icon: ShieldCheck, title: "AI verifies it", body: "A vision model checks the photo. Uncertain cases go to a human, never a penalty." },
  { Icon: Clock, title: "Everyone stays informed", body: "A live feed means nobody has to ask who filled them." },
];

const FEATURES = [
  { title: "Photo verification", body: "A vision model looks for the cooler, the bottles and a filling context \u2014 and says plainly when it isn't sure." },
  { title: "Real-time activity", body: "Refills appear instantly for everyone in the room. No refresh, no screenshots." },
  { title: "Room accountability", body: "A daily bottle target and a neutral status: full, refill needed, or nothing logged yet." },
  { title: "Smart reminders", body: "It's your turn today. One gentle nudge, never a group-chat ambush." },
  { title: "Refill rotation", body: "Automatic round-robin. Skip, swap or volunteer \u2014 everyone sees the same schedule." },
  { title: "Hostel analytics", body: "Participation, verification rates and flagged activity for the people who run the place." },
];

const FEED = [
  { time: "8:42 PM", name: "Monish", bottles: 3 },
  { time: "7:18 PM", name: "Aditya", bottles: 2 },
  { time: "5:04 PM", name: "Khush", bottles: 4 },
];

export default async function LandingPage() {
  const ctx = await getAuthContext();
  const signedIn = Boolean(ctx?.user.onboarded);

  return (
    <div className="min-h-dvh bg-background">
      <MarketingHeader signedIn={signedIn} />
      <main id="main">
        <Hero signedIn={signedIn} />
        <HowItWorks />
        <ProductPreview />
        <Features />
        <Privacy />
        <FinalCta signedIn={signedIn} />
      </main>
      <MarketingFooter />
    </div>
  );
}
function MarketingHeader({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <Logo />
          <span className="text-[15px] font-semibold tracking-[-0.02em]">FillMate</span>
        </Link>
        <nav className="hidden items-center gap-6 md:flex">
          <a href="#how" className="text-[13px] font-medium text-ink-secondary hover:text-ink">
            How it works
          </a>
          <a href="#features" className="text-[13px] font-medium text-ink-secondary hover:text-ink">
            Features
          </a>
          <a href="#preview" className="text-[13px] font-medium text-ink-secondary hover:text-ink">
            Preview
          </a>
          <a href="#privacy" className="text-[13px] font-medium text-ink-secondary hover:text-ink">
            Privacy
          </a>
        </nav>
        <div className="flex items-center gap-2">
          {signedIn ? (
            <Button size="sm" asChild>
              <Link href="/app">Open app</Link>
            </Button>
          ) : (
            <>
              <Button size="sm" variant="ghost" asChild className="hidden sm:inline-flex">
                <Link href="/login">Sign in</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/signup">Get started</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function Hero({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="relative overflow-hidden border-b border-border">
      <div
        className="pointer-events-none absolute inset-0 bg-grid opacity-40"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-aqua-sheen opacity-70"
        aria-hidden
      />
      <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-14 sm:px-6 sm:pb-20 sm:pt-20">
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-14">
          <div>
            <Badge tone="accent" className="mb-5">
              Built for shared hostel water
            </Badge>
            <h1 className="text-balance-tight text-[32px] font-semibold leading-[1.08] tracking-[-0.035em] text-ink sm:text-[44px]">
              Never argue about who filled the bottles.
            </h1>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ink-secondary sm:text-[17px]">
              A simple accountability system for shared hostel water. Take a
              photo, let a vision model check it, and everyone stays informed.
            </p>
            <div className="mt-7 flex flex-col gap-2.5 sm:flex-row">
              <Button size="xl" asChild>
                <Link href={signedIn ? "/app" : "/signup"}>
                  {signedIn ? "Open FillMate" : "Get started"}
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button size="xl" variant="secondary" asChild>
                <Link href="/signup">View demo</Link>
              </Button>
            </div>
            <p className="mt-4 flex items-center gap-1.5 text-[12.5px] text-ink-muted">
              <Lock className="size-3.5" />
              Photos are stripped of location metadata before storage.
            </p>
          </div>

          <HeroCard />
        </div>
      </div>
    </section>
  );
}

function HeroCard() {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-e2">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.05em] text-ink-muted">
            Water status
          </p>
          <p className="mt-0.5 text-[15px] font-semibold text-ink">Room 304 · Hostel A</p>
        </div>
        <Badge tone="warning">Refill needed</Badge>
      </div>

      <div className="mt-4 flex items-end justify-between gap-4">
        <div>
          <p className="flex items-baseline gap-1.5">
            <span className="tabular text-[32px] font-semibold leading-none tracking-[-0.03em]">3</span>
            <span className="text-[14px] text-ink-muted">/ 4</span>
          </p>
          <p className="mt-1 text-[12px] text-ink-muted">75% of today&rsquo;s target</p>
        </div>
        <BottleGauge filled={3} target={4} status="needs_refill" size="md" />
      </div>

      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-gauge-empty">
        <div className="h-full w-3/4 rounded-full bg-gauge-fill" />
      </div>

      <div className="mt-4 rounded-lg border border-border bg-surface-sunken px-3 py-2">
        <p className="text-[11px] uppercase tracking-[0.04em] text-ink-muted">Last refill</p>
        <p className="mt-0.5 text-[13px] font-medium text-ink">Aditya · 7:18 PM</p>
      </div>

      <div className="mt-4 flex gap-2">
        <div className="flex h-11 flex-1 items-center justify-center gap-2 rounded-md bg-brand text-[15px] font-semibold text-[var(--text-on-ink)]">
          I filled the bottles
        </div>
      </div>
    </div>
  );
}
function Section({
  id,
  eyebrow,
  title,
  description,
  children,
}: {
  id?: string;
  eyebrow: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="border-b border-border py-14 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-aqua">
          {eyebrow}
        </p>
        <h2 className="mt-2 max-w-2xl text-balance-tight text-[24px] font-semibold tracking-[-0.03em] text-ink sm:text-[32px]">
          {title}
        </h2>
        {description ? (
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-secondary">
            {description}
          </p>
        ) : null}
        <div className="mt-10">{children}</div>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <Section
      id="how"
      eyebrow="How it works"
      title="Four steps, and the argument is over."
      description="No spreadsheets, no group-chat archaeology. Just a photo and a shared record."
    >
      <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((step, index) => (
          <li key={step.title} className="rounded-xl border border-border bg-surface p-5 shadow-e1">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-md border border-aqua-border bg-aqua-soft text-aqua">
                <step.Icon className="size-3.5" />
              </span>
              <span className="tabular text-[11px] font-semibold text-ink-muted">
                0{index + 1}
              </span>
            </div>
            <p className="mt-3 text-[14px] font-semibold text-ink">{step.title}</p>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">{step.body}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}

function ProductPreview() {
  return (
    <Section
      id="preview"
      eyebrow="Product preview"
      title="The feed everyone actually looks at."
      description="Real components from the app \u2014 not stock photography."
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <div className="rounded-2xl border border-border bg-surface p-4 shadow-e2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">
            Today
          </p>
          <ul className="mt-3 divide-y divide-border-subtle">
            {FEED.map((row) => (
              <li key={row.time} className="flex items-center gap-3 py-2.5">
                <Avatar name={row.name} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] text-ink">
                    <span className="font-medium">{row.name}</span> filled{" "}
                    <span className="tabular font-medium">{row.bottles}</span>
                  </p>
                  <p className="tabular text-[11.5px] text-ink-muted">{row.time}</p>
                </div>
                <VerificationBadge status="verified" />
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-4 shadow-e2 sm:p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">
            Room 304 contributions
          </p>
          <div className="mt-3 space-y-2.5">
            {[
              { name: "Monish", bottles: 24 },
              { name: "Aditya", bottles: 21 },
              { name: "Khush", bottles: 18 },
              { name: "Krish", bottles: 14 },
            ].map((row) => (
              <div key={row.name} className="flex items-center gap-3">
                <span className="w-16 shrink-0 truncate text-[13px] text-ink-secondary">
                  {row.name}
                </span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gauge-empty">
                  <div
                    className="h-full rounded-full bg-gauge-fill-soft"
                    style={{ width: `${(row.bottles / 24) * 100}%` }}
                  />
                </div>
                <span className="tabular w-12 shrink-0 text-right text-[13px] font-medium text-ink">
                  {row.bottles}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[12px] text-ink-muted">
            Activity facts, not a blame chart. Members can hide their numbers.
          </p>
        </div>
      </div>
    </Section>
  );
}

function Features() {
  return (
    <Section
      id="features"
      eyebrow="Features"
      title="Everything a hostel needs, nothing it doesn't."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature) => (
          <div
            key={feature.title}
            className="rounded-xl border border-border bg-surface p-5 shadow-e1"
          >
            <p className="text-[14px] font-semibold text-ink">{feature.title}</p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">{feature.body}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}
function Privacy() {
  const points = [
    {
      title: "Photos only",
      body: "We collect the evidence photo you choose to submit \u2014 nothing else from your camera roll.",
    },
    {
      title: "Metadata stripped",
      body: "GPS and EXIF data is removed before the image is stored. Your exact location is never exposed.",
    },
    {
      title: "Location is optional",
      body: "If you share a position, we store only a distance from the cooler and show an approximation.",
    },
    {
      title: "Your call",
      body: "Hide your name, your activity or your contribution totals whenever you want.",
    },
    {
      title: "Retention limits",
      body: "Admins configure how long evidence is kept. Expired images are deleted automatically.",
    },
    {
      title: "Honest AI",
      body: "Low-confidence results are never presented as verified. They go to a human, clearly labelled.",
    },
  ];

  return (
    <section id="privacy" className="border-b border-border py-14 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-aqua">Privacy</p>
        <h2 className="mt-2 max-w-2xl text-balance-tight text-[24px] font-semibold tracking-[-0.03em] text-ink sm:text-[32px]">
          Only what accountability needs. Nothing more.
        </h2>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-secondary">
          FillMate exists so a shared chore stops being a source of conflict. It
          is not a surveillance tool, and it never rewards or punishes anyone.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {points.map((point) => (
            <div key={point.title} className="rounded-xl border border-border bg-surface p-5">
              <p className="text-[14px] font-semibold text-ink">{point.title}</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">{point.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="relative overflow-hidden border-b border-border">
      <div className="pointer-events-none absolute inset-0 bg-aqua-sheen opacity-60" aria-hidden />
      <div className="relative mx-auto max-w-6xl px-4 py-16 text-center sm:px-6 sm:py-20">
        <h2 className="text-balance-tight text-[26px] font-semibold tracking-[-0.03em] text-ink sm:text-[36px]">
          Let&rsquo;s keep the bottles full.
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-[15px] leading-relaxed text-ink-secondary">
          Someone has to fill it. Now everyone knows who, and when.
        </p>
        <div className="mt-7 flex flex-col justify-center gap-2.5 sm:flex-row">
          <Button size="xl" asChild>
            <Link href={signedIn ? "/app" : "/signup"}>
              {signedIn ? "Open FillMate" : "Get started"}
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button size="xl" variant="secondary" asChild>
            <Link href="/signup">View demo</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

function MarketingFooter() {
  return (
    <footer className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <Logo size={20} />
          <span className="text-[14px] font-semibold tracking-[-0.02em]">FillMate</span>
        </div>
        <p className="text-[12.5px] text-ink-muted">
          Accountability without conflict. Built for shared hostel water.
        </p>
      </div>
    </footer>
  );
}