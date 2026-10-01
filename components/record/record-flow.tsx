"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BottleGauge } from "@/components/app/bottle-gauge";
import { CameraCapture, type CapturedPhoto } from "./camera-capture";
import { ResultStep } from "./result-step";
import { LocationRow } from "./location-row";
import { useRecordRefillDialog } from "./record-dialog-provider";
import { useLocation } from "@/hooks/use-location";
import { apiFetch, ApiClientError } from "@/lib/http/client";
import type { CreateActivityResponse } from "@/types/api";

type Step = "count" | "photo" | "result";

/**
 * The refill recording flow.
 *
 * Three steps, one screen each: count, capture, result. A single submit keeps
 * the whole interaction under 15 seconds on a good connection.
 */
export function RecordRefillDialog() {
  const { isOpen, close, fullScreen } = useRecordRefillDialog();
  const router = useRouter();

  const [step, setStep] = React.useState<Step>("count");
  const [count, setCount] = React.useState(3);
  const [photo, setPhoto] = React.useState<CapturedPhoto | null>(null);
  const [note, setNote] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<CreateActivityResponse | null>(null);

  const { permission, position, request, unavailableReason } = useLocation();

  const reset = React.useCallback(() => {
    setStep("count");
    setCount(3);
    setPhoto(null);
    setNote("");
    setError(null);
    setResult(null);
    setSubmitting(false);
  }, []);

  React.useEffect(() => {
    if (!isOpen) {
      const timer = setTimeout(reset, 250);
      return () => clearTimeout(timer);
    }
  }, [isOpen, reset]);

  const submit = React.useCallback(async () => {
    setSubmitting(true);
    setError(null);
    try {
      const payload = await apiFetch<CreateActivityResponse>("/api/activities", {
        method: "POST",
        json: {
          bottleCount: count,
          imageBase64: photo?.dataUrl,
          note: note.trim() || undefined,
          location: position
            ? {
                latitude: position.latitude,
                longitude: position.longitude,
                accuracy: position.accuracy,
              }
            : null,
          clientTimestamp: new Date().toISOString(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      });
      setResult(payload);
      setStep("result");
      toast.success(
        payload.verification.verified
          ? "Refill recorded and verified"
          : "Refill recorded",
      );
      router.refresh();
    } catch (err) {
      const message =
        err instanceof ApiClientError ? err.message : "We couldn't save your refill.";
      setError(message);
      toast.error("Couldn't save activity", { description: message });
    } finally {
      setSubmitting(false);
    }
  }, [count, photo, note, position, router]);
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !submitting && close()}>
      <DialogContent
        className={cn(
          "p-0",
          fullScreen &&
            "inset-0 left-0 top-0 h-dvh max-h-dvh w-full max-w-none translate-x-0 translate-y-0 rounded-none border-0 sm:inset-x-4 sm:top-1/2 sm:h-auto sm:max-h-[calc(100dvh-3rem)] sm:-translate-y-1/2 sm:rounded-xl sm:border",
        )}
        showClose={!submitting}
      >
        {step === "result" && result ? (
          <ResultStep result={result} onClose={close} />
        ) : (
          <>
            <DialogHeader className="pr-10">
              <div className="flex items-center gap-2">
                {step === "photo" ? (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setStep("count")}
                    aria-label="Back to bottle count"
                    disabled={submitting}
                  >
                    <ArrowLeft className="size-4" />
                  </Button>
                ) : null}
                <div className="min-w-0 flex-1">
                  <DialogTitle>
                    {step === "count" ? "How many bottles?" : "Add proof"}
                  </DialogTitle>
                  <DialogDescription className="sr-only">
                    {step === "count"
                      ? "Choose how many bottles you filled"
                      : "Take a photo of the bottles and the cooler"}
                  </DialogDescription>
                </div>
                <StepDots step={step} />
              </div>
            </DialogHeader>

            <div className="px-5 pb-5">
              <AnimatePresence mode="wait" initial={false}>
                {step === "count" ? (
                  <CountStep
                    count={count}
                    setCount={setCount}
                    note={note}
                    setNote={setNote}
                    onNext={() => setStep("photo")}
                  />
                ) : (
                  <PhotoStep
                    photo={photo}
                    setPhoto={setPhoto}
                    submitting={submitting}
                    error={error}
                    onSubmit={() => void submit()}
                    location={
                      <LocationRow
                        permission={permission}
                        unavailableReason={unavailableReason}
                        onRequest={request}
                        disabled={submitting}
                      />
                    }
                  />
                )}
              </AnimatePresence>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function StepDots({ step }: { step: Step }) {
  return (
    <div className="flex items-center gap-1" aria-hidden>
      {(["count", "photo"] as const).map((s, i) => (
        <span
          key={s}
          className={cn(
            "h-1 rounded-full transition-all duration-200",
            (step === "photo" ? 1 : 0) >= i ? "w-4 bg-aqua" : "w-2 bg-border-strong",
          )}
        />
      ))}
    </div>
  );
}
function CountStep({
  count,
  setCount,
  note,
  setNote,
  onNext,
}: {
  count: number;
  setCount: React.Dispatch<React.SetStateAction<number>>;
  note: string;
  setNote: React.Dispatch<React.SetStateAction<string>>;
  onNext: () => void;
}) {
  return (
    <motion.div
      key="count"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.2 }}
      className="space-y-5"
    >
      <div className="flex items-center justify-center gap-6 py-2">
        <Button
          variant="secondary"
          size="icon"
          className="size-11 rounded-full"
          onClick={() => setCount((value) => Math.max(1, value - 1))}
          disabled={count <= 1}
          aria-label="One fewer bottle"
        >
          <Minus className="size-4" />
        </Button>
        <div className="flex w-28 flex-col items-center gap-2">
          <span
            className="tabular text-5xl font-semibold leading-none tracking-[-0.03em]"
            aria-live="polite"
          >
            {count}
          </span>
          <span className="text-[12px] text-ink-muted">
            {count === 1 ? "bottle" : "bottles"}
          </span>
        </div>
        <Button
          variant="secondary"
          size="icon"
          className="size-11 rounded-full"
          onClick={() => setCount((value) => Math.min(10, value + 1))}
          disabled={count >= 10}
          aria-label="One more bottle"
        >
          <Plus className="size-4" />
        </Button>
      </div>

      <BottleGauge
        filled={count}
        target={Math.max(count, 4)}
        status={count >= 4 ? "full" : "needs_refill"}
        size="sm"
        className="justify-center opacity-80"
      />

      <div className="flex flex-wrap justify-center gap-1.5">
        {[1, 2, 3, 4, 6, 8].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setCount(n)}
            className={cn(
              "tabular min-w-9 rounded-md border px-2 py-1 text-[13px] font-medium transition-colors",
              count === n
                ? "border-aqua-border bg-aqua-soft text-aqua"
                : "border-border bg-surface text-ink-muted hover:border-border-strong hover:text-ink",
            )}
          >
            {n}
          </button>
        ))}
      </div>

      <Field label="Note" optional htmlFor="refill-note">
        <Input
          id="refill-note"
          value={note}
          maxLength={280}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Anything your roommates should know?"
        />
      </Field>

      <Button size="xl" className="w-full" onClick={onNext}>
        Next: add a photo
      </Button>
    </motion.div>
  );
}
function PhotoStep({
  photo,
  setPhoto,
  submitting,
  error,
  onSubmit,
  location,
}: {
  photo: CapturedPhoto | null;
  setPhoto: (photo: CapturedPhoto | null) => void;
  submitting: boolean;
  error: string | null;
  onSubmit: () => void;
  location: React.ReactNode;
}) {
  return (
    <motion.div
      key="photo"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.2 }}
      className="space-y-4"
    >
      <CameraCapture
        photo={photo}
        onCapture={setPhoto}
        onRetake={() => setPhoto(null)}
        disabled={submitting}
        error={error}
      />
      {location}
      <Button
        size="xl"
        className="w-full"
        onClick={onSubmit}
        loading={submitting}
        loadingText="Verifying..."
        disabled={!photo}
      >
        Submit refill
      </Button>
      <p className="text-center text-[11.5px] text-ink-muted">
        Time is stamped on the server, so the record stays accurate even if your
        phone clock drifts.
      </p>
    </motion.div>
  );
}