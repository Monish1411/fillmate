"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Bell, LogOut, Shield, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/primitives";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { apiFetch, ApiClientError } from "@/lib/http/client";
import { useSession } from "@/components/session-provider";

interface Props {
  user: {
    fullName: string;
    displayName: string;
    email: string;
    phone: string | null;
    preferences: {
      notifyRefills: boolean;
      notifyRotation: boolean;
      notifyReviews: boolean;
      notifyWeekly: boolean;
      privacyShowContributions: boolean;
      privacyShowActivity: boolean;
      privacyShowName: boolean;
    };
  };
}

export function SettingsView({ user }: Props) {
  const router = useRouter();
  const { refresh } = useSession();

  const [fullName, setFullName] = React.useState(user.fullName);
  const [displayName, setDisplayName] = React.useState(user.displayName);
  const [phone, setPhone] = React.useState(user.phone ?? "");
  const [savingProfile, setSavingProfile] = React.useState(false);
  const [prefs, setPrefs] = React.useState(user.preferences);

  async function saveProfile() {
    setSavingProfile(true);
    try {
      await apiFetch("/api/profile", {
        method: "PATCH",
        json: {
          fullName,
          displayName: displayName || undefined,
          phone: phone || undefined,
        },
      });
      toast.success("Profile updated");
      await refresh();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "We couldn't save your profile.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function updatePref(key: keyof Props["user"]["preferences"], value: boolean) {
    const previous = prefs;
    setPrefs({ ...prefs, [key]: value });
    try {
      await apiFetch("/api/profile", { method: "PATCH", json: { [key]: value } });
      toast.success("Settings updated");
    } catch {
      setPrefs(previous);
      toast.error("We couldn't save that setting.");
    }
  }

  async function signOut() {
    await apiFetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-ink">Settings</h1>
        <p className="mt-1 text-[13.5px] text-ink-muted">
          Your profile, appearance and what your roommates can see.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="size-4 text-ink-muted" />
            Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Field label="Full name" htmlFor="fullName">
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </Field>
          <Field
            label="Display name"
            htmlFor="displayName"
            hint="What your roommates see in the activity feed."
          >
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </Field>
          <Field label="Phone" optional htmlFor="phone">
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </Field>
          <p className="text-[12px] text-ink-muted">Signed in as {user.email}</p>
          <Button onClick={() => void saveProfile()} loading={savingProfile}>
            Save profile
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="size-4 text-ink-muted" />
            Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <ToggleRow
            label="Refill activity"
            hint="When a roommate fills the bottles or the room hits its target."
            checked={prefs.notifyRefills}
            onChange={(v) => void updatePref("notifyRefills", v)}
          />
          <ToggleRow
            label="Rotation turns"
            hint="A nudge on the morning of your turn."
            checked={prefs.notifyRotation}
            onChange={(v) => void updatePref("notifyRotation", v)}
          />
          <ToggleRow
            label="Review decisions"
            hint="When an administrator approves, rejects or asks for a new photo."
            checked={prefs.notifyReviews}
            onChange={(v) => void updatePref("notifyReviews", v)}
          />
          <ToggleRow
            label="Weekly summary"
            hint="One quiet email with your own contribution numbers."
            checked={prefs.notifyWeekly}
            onChange={(v) => void updatePref("notifyWeekly", v)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="size-4 text-ink-muted" />
            Privacy
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <ToggleRow
            label="Show my name"
            hint="Otherwise your entries appear as “A roommate”."
            checked={prefs.privacyShowName}
            onChange={(v) => void updatePref("privacyShowName", v)}
          />
          <ToggleRow
            label="Show my contributions"
            hint="Turn off to keep your bottle counts private. You still see your own."
            checked={prefs.privacyShowContributions}
            onChange={(v) => void updatePref("privacyShowContributions", v)}
          />
          <ToggleRow
            label="Show my activity"
            hint="When off, your refills are counted but not listed."
            checked={prefs.privacyShowActivity}
            onChange={(v) => void updatePref("privacyShowActivity", v)}
          />
          <p className="pt-2 text-[12px] leading-relaxed text-ink-muted">
            Exact GPS coordinates are never shown to anyone. If you share location
            at all, only a distance from the cooler is stored and displayed.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
        </CardHeader>
        <CardContent>
          <ThemeToggle />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-center justify-between gap-3 pt-4">
          <div>
            <p className="text-[14px] font-medium text-ink">Sign out</p>
            <p className="text-[12.5px] text-ink-muted">End this session on this device.</p>
          </div>
          <Button variant="secondary" onClick={() => void signOut()}>
            <LogOut className="size-4" />
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-lg px-1 py-2.5">
      <span className="min-w-0">
        <span className="block text-[13.5px] font-medium text-ink">{label}</span>
        <span className="mt-0.5 block text-[12.5px] text-ink-muted">{hint}</span>
      </span>
      <Switch checked={checked} onCheckedChange={onChange} className="mt-0.5 shrink-0" />
    </label>
  );
}