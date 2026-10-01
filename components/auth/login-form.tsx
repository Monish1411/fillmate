"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { apiFetch, ApiClientError } from "@/lib/http/client";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [fields, setFields] = React.useState<Record<string, string>>({});
  const [loading, setLoading] = React.useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setFields({});
    try {
      const result = await apiFetch<{ needsOnboarding: boolean }>("/api/auth/login", {
        method: "POST",
        json: { email, password },
      });
      toast.success("Welcome back");
      router.push(result.needsOnboarding ? "/onboarding" : "/app");
      router.refresh();
    } catch (err) {
      const apiError = err instanceof ApiClientError ? err : null;
      setError(apiError?.message ?? "We couldn't sign you in. Please try again.");
      if (apiError?.fields) setFields(apiError.fields);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-ink">
          Sign in to FillMate
        </h1>
        <p className="text-[13.5px] text-ink-muted">Pick up where your room left off.</p>
      </div>

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

      <Field label="Password" htmlFor="password" error={fields.password}>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          placeholder="Your password"
          value={password}
          invalid={Boolean(fields.password)}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </Field>

      {error ? (
        <p role="alert" className="rounded-md border border-danger-border bg-danger-soft px-3 py-2 text-[12.5px] text-danger">
          {error}
        </p>
      ) : null}

      <Button type="submit" size="lg" className="w-full" loading={loading} loadingText="Signing in...">
        Sign in
        <ArrowRight className="size-4" />
      </Button>

      <p className="text-center text-[13px] text-ink-muted">
        New here?{" "}
        <Link href="/signup" className="font-medium text-ink underline-offset-4 hover:underline">
          Create an account
        </Link>
      </p>
    </form>
  );
}