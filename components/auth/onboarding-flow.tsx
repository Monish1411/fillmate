"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { toast } from "sonner";
import { ArrowRight, Building2, Check, DoorClosed, Minus, Plus } from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { BottleGauge } from "@/components/app/bottle-gauge";
import { apiFetch, ApiClientError } from "@/lib/http/client";
import { cn } from "@/lib/utils/cn";

export interface HostelOption {
  id: string;
  name: string;
  code: string;
  city: string | null;
  timezone: string;
}

const STEPS = ["welcome", "hostel", "room", "bottles", "ready"] as const;

/** Guided setup: hostel -> room -> daily bottle target -> done. */
export function OnboardingFlow({
  hostels,
  initialHostelId,
  initialRoomNumber,
}: {
  hostels: HostelOption[];
  initialHostelId: string | null;
  initialRoomNumber: string | null;
}) {
  const router = useRouter();
  const [index, setIndex] = React.useState(0);
  const [hostelId, setHostelId] = React.useState(initialHostelId ?? "");
  const [roomNumber, setRoomNumber] = React.useState(initialRoomNumber ?? "");
  const [target, setTarget] = React.useState(4);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const step = STEPS[index]!;

  async function submitHostel() {
    if (!hostelId) {
      setError("Pick your hostel to continue.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await apiFetch("/api/onboarding", {
        method: "POST",
        json: { step: "hostel", hostelId },
      });
      setIndex((i) => i + 1);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function submitRoom() {
    if (roomNumber.trim().length === 0) {
      setError("Enter your room number.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await apiFetch("/api/onboarding", {
        method: "POST",
        json: { step: "room", roomNumber: roomNumber.trim(), bottleTarget: target },
      });
      setIndex((i) => i + 1);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function finish() {
    setLoading(true);
    try {
      await apiFetch("/api/onboarding", { method: "POST", json: { step: "ready" } });
      toast.success("You&rsquo;re all set");
      router.push("/app");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="mb-7 flex items-center gap-2">
        <Logo />
        <span className="text-[15px] font-semibold tracking-[-0.02em]">FillMate</span>
      </div>

      <div className="mb-6 flex items-center gap-1.5" aria-hidden>
        {STEPS.map((s, i) => (
          <span
            key={s}
            className={cn(
              "h-1 rounded-full transition-all duration-300",
              i <= index ? "w-6 bg-aqua" : "w-3 bg-border",
            )}
          />
        ))}
      </div>

      <motion.div
        key={step}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      >
        {step === "welcome" ? (
          <section className="space-y-4">
            <h1 className="text-[26px] font-semibold tracking-[-0.03em] text-ink">
              Welcome to FillMate
            </h1>
            <p className="text-[14.5px] leading-relaxed text-ink-secondary">
              Two quick questions and you&rsquo;re set. We need your hostel and
              room so your refill only shows up where it belongs.
            </p>
            <ul className="space-y-2 pt-1">
              {[
                "Record a refill with one photo",
                "AI checks it and shows its confidence",
                "Your room sees it instantly",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-[13.5px] text-ink-secondary">
                  <Check className="mt-0.5 size-4 shrink-0 text-aqua" />
                  {item}
                </li>
              ))}
            </ul>
            <Button size="lg" className="w-full" onClick={() => setIndex(1)}>
              Get started
              <ArrowRight className="size-4" />
            </Button>
          </section>
        ) : null}

        {step === "hostel" ? (
          <section className="space-y-4">
            <StepHeading
              Icon={Building2}
              title="Which hostel are you in?"
              description="Pick from the list. If yours isn't here, ask your warden to create it."
            />
            <div className="space-y-2">
              {hostels.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-[13px] text-ink-muted">
                  No hostels yet. Ask your hostel admin to create one.
                </p>
              ) : (
                hostels.map((hostel) => (
                  <button
                    key={hostel.id}
                    type="button"
                    onClick={() => setHostelId(hostel.id)}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-lg border px-3.5 py-3 text-left transition-colors",
                      hostelId === hostel.id
                        ? "border-aqua-border bg-aqua-soft"
                        : "border-border bg-surface hover:border-border-strong",
                    )}
                  >
                    <span>
                      <span className="block text-[14px] font-medium text-ink">
                        {hostel.name}
                      </span>
                      <span className="block text-[12px] text-ink-muted">
                        {hostel.city ?? "Unknown city"} · {hostel.code}
                      </span>
                    </span>
                    {hostelId === hostel.id ? (
                      <Check className="size-4 text-aqua" />
                    ) : null}
                  </button>
                ))
              )}
            </div>
            <Button
              size="lg"
              className="w-full"
              onClick={() => void submitHostel()}
              loading={loading}
              disabled={hostels.length === 0}
            >
              Continue
            </Button>
          </section>
        ) : null}

        {step === "room" ? (
          <section className="space-y-4">
            <StepHeading
              Icon={DoorClosed}
              title="What&rsquo;s your room number?"
              description="If it doesn&rsquo;t exist yet we&rsquo;ll create it and give you an invite link."
            />
            <Field label="Room number" htmlFor="room" error={error}>
              <Input
                id="room"
                inputMode="text"
                autoCapitalize="characters"
                placeholder="304"
                value={roomNumber}
                onChange={(e) => setRoomNumber(e.target.value)}
              />
            </Field>
            <Button size="lg" className="w-full" onClick={() => void submitRoom()} loading={loading}>
              Continue
            </Button>
          </section>
        ) : null}

        {step === "bottles" ? (
          <section className="space-y-5">
            <StepHeading
              Icon={DoorClosed}
              title="How many bottles does your room use?"
              description="This is the daily target used to decide when the room is all set."
            />
            <div className="flex items-center justify-center gap-6 py-2">
              <Button
                variant="secondary"
                size="icon"
                className="size-11 rounded-full"
                onClick={() => setTarget((t) => Math.max(1, t - 1))}
                disabled={target <= 1}
                aria-label="One fewer bottle"
              >
                <Minus className="size-4" />
              </Button>
              <span className="tabular w-24 text-center text-5xl font-semibold tracking-[-0.03em]">
                {target}
              </span>
              <Button
                variant="secondary"
                size="icon"
                className="size-11 rounded-full"
                onClick={() => setTarget((t) => Math.min(20, t + 1))}
                disabled={target >= 20}
                aria-label="One more bottle"
              >
                <Plus className="size-4" />
              </Button>
            </div>
            <BottleGauge
              filled={target}
              target={target}
              status="full"
              size="sm"
              className="justify-center"
            />
            <Button size="lg" className="w-full" onClick={() => void submitRoom()}>
              Save and continue
            </Button>
          </section>
        ) : null}

        {step === "ready" ? (
          <section className="space-y-4 text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-success-soft">
              <Check className="size-7 text-success" strokeWidth={2.5} />
            </div>
            <h1 className="text-[24px] font-semibold tracking-[-0.03em] text-ink">
              You&rsquo;re ready
            </h1>
            <p className="text-[14.5px] text-ink-secondary">Let&rsquo;s keep the bottles full.</p>
            <Button size="lg" className="w-full" onClick={() => void finish()} loading={loading}>
              Open FillMate
              <ArrowRight className="size-4" />
            </Button>
          </section>
        ) : null}
      </motion.div>

      {error && step !== "room" ? (
        <p role="alert" className="mt-4 rounded-md border border-danger-border bg-danger-soft px-3 py-2 text-[12.5px] text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function StepHeading({
  Icon,
  title,
  description,
}: {
  Icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-2">
      <span className="flex size-9 items-center justify-center rounded-lg border border-border bg-surface text-ink-secondary shadow-e1">
        <Icon className="size-4" />
      </span>
      <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.025em] text-ink">
        {title}
      </h1>
      <p className="text-[13.5px] leading-relaxed text-ink-muted">{description}</p>
    </div>
  );
}