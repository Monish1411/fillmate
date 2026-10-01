"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { apiFetch, ApiClientError } from "@/lib/http/client";
import { cn } from "@/lib/utils/cn";

function strengthOf(password: string): { score: 0 | 1 | 2 | 3 | 4; label: string } {
  if (password.length < 8) return { score: 0, label: "Use at least 8 characters" };
  let score = 1;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password) && /[^\w\s]/.test(password)) score++;
  const labels = [
    "Use at least 8 characters",
    "Add a mix of letters, numbers or symbols",
    "Fair \u2014 a little longer would help",
    "Good password",
    "Strong password",
  ];
  return { score: score as 0 | 1 | 2 | 3 | 4, label: labels[score]! };
}

export function SignupForm() {
  const router = useRouter();
  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [fields, setFields] = React.useState<Record<string, string>>({});
  const [loading, setLoading] = React.useState(false);

  const strength = strengthOf(password);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (password.length < 8) {
      setFields({ password: "Use at least 8 characters" });
      return;
    }
    setLoading(true);
    setError(null);
    setFields({});
    try {
      await apiFetch("/api/auth/signup", {
        method: "POST",
        json: {
          fullName,
          email,
          password,
          phone: phone || undefined,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      });
      toast.success("Welcome to FillMate");
      router.push("/onboarding");
      router.refresh();
    } catch (err) {
      const apiError = err instanceof ApiClientError ? err : null;
      setError(apiError?.message ?? "We couldn't create your account.");
      if (apiError?.fields) setFields(apiError.fields);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-ink">
          Create your account
        </h1>
        <p className="text-[13.5px] text-ink-muted">
          Takes a minute. Next we&rsquo;ll match you to your hostel and room.
        </p>
      </div>

      <Field label="Full name" htmlFor="name" error={fields.fullName}>
        <Input
          id="name"
          autoComplete="name"
          placeholder="Monish Undhad"
          value={fullName}
          invalid={Boolean(fields.fullName)}
          onChange={(e) => setFullName(e.target.value)}
          required
        />
      </Field>

      <Field label="Email" htmlFor="email" error={fields.email}>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@hostel.edu"
          value={email}
          invalid={Boolean(fields.email)}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </Field>

      <Field label="Phone" optional htmlFor="phone" error={fields.phone}>
        <Input
          id="phone"
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          placeholder="+91 98765 43210"
          value={phone}
          invalid={Boolean(fields.phone)}
          onChange={(e) => setPhone(e.target.value)}
        />
      </Field>

      <Field label="Password" htmlFor="password" error={fields.password}>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          value={password}
          invalid={Boolean(fields.password)}
          onChange={(e) => setPassword(e.target.value)}
          required
          aria-describedby="password-strength"
        />
        {password.length > 0 ? (
          <div id="password-strength" className="flex items-center gap-2 pt-1">
            <div className="flex h-1 flex-1 gap-0.5">
              {[1, 2, 3, 4].map((i) => (
                <span
                  key={i}
                  className={cn(
                    "h-1 flex-1 rounded-full transition-colors",
                    i <= strength.score
                      ? strength.score <= 1
                        ? "bg-danger"
                        : strength.score === 2
                          ? "bg-warning"
                          : "bg-success"
                      : "bg-border",
                  )}
                />
              ))}
            </div>
            <span className="text-[11.5px] text-ink-muted">{strength.label}</span>
          </div>
        ) : null}
      </Field>

      {error ? (
        <p role="alert" className="rounded-md border border-danger-border bg-danger-soft px-3 py-2 text-[12.5px] text-danger">
          {error}
        </p>
      ) : null}

      <Button type="submit" size="lg" className="w-full" loading={loading} loadingText="Creating...">
        Create account
        <ArrowRight className="size-4" />
      </Button>

      <p className="text-center text-[13px] text-ink-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-ink underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}