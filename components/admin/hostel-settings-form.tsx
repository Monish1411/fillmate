"use client";

import * as React from "react";
import { toast } from "sonner";
import { Bot, MapPin, QrCode, Save, Sparkles, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/primitives";
import { Badge } from "@/components/ui/badge";
import { apiFetch, ApiClientError } from "@/lib/http/client";
import type { FeatureFlag } from "@/types/core";

interface Settings {
  ai_verification: boolean;
  location_verification: boolean;
  qr_cooler: boolean;
  leaderboard: boolean;
  rotation: boolean;
  notifications: boolean;
  gamification: boolean;
  analytics: boolean;
  invites: boolean;
  photo_evidence: boolean;
  retentionDays: number;
  aiConfidenceThreshold: number;
}

const FLAGS: Array<{
  key: FeatureFlag;
  label: string;
  hint: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = [
  { key: "photo_evidence", label: "Require a photo", hint: "Students must attach proof to every refill.", Icon: QrCode },
  { key: "ai_verification", label: "AI verification", hint: "Send photos to the vision provider for an automatic verdict.", Icon: Bot },
  { key: "location_verification", label: "Location proximity", hint: "Compare an optional position against the configured cooler.", Icon: MapPin },
  { key: "qr_cooler", label: "Cooler QR codes", hint: "Let students scan a cooler QR before recording a refill.", Icon: QrCode },
  { key: "leaderboard", label: "Contribution board", hint: "Show per-member bottle totals to roommates.", Icon: Trophy },
  { key: "rotation", label: "Refill rotation", hint: "Generate and manage the round-robin schedule.", Icon: Sparkles },
  { key: "notifications", label: "Notifications", hint: "Room activity, rotation turns and review decisions.", Icon: Sparkles },
  { key: "gamification", label: "Milestones", hint: "Factual badges such as first fill and 7-day streak.", Icon: Sparkles },
  { key: "invites", label: "Room invites", hint: "Let members share join links for their room.", Icon: QrCode },
  { key: "analytics", label: "Analytics", hint: "Hostel-wide charts for participation and verification.", Icon: Trophy },
];
export function HostelSettingsForm({
  initial,
  ai,
}: {
  initial: Settings;
  ai: { id: string; model: string; live: boolean; label: string };
}) {
  const [settings, setSettings] = React.useState(initial);
  const [saving, setSaving] = React.useState(false);

  function set<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  async function save() {
    setSaving(true);
    try {
      await apiFetch("/api/admin/settings", { method: "PATCH", json: settings });
      toast.success("Settings updated");
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "We couldn't save those settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>Verification provider</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-0">
          <div>
            <p className="text-[13.5px] font-medium text-ink">{ai.label}</p>
            <p className="mt-0.5 text-[12.5px] text-ink-muted">
              {ai.live
                ? "Photos are analysed server-side. API keys never reach the browser."
                : "No vision provider is connected on this deployment. Refills are stored for manual review instead of being auto-verified."}
            </p>
          </div>
          <Badge tone={ai.live ? "success" : "warning"}>
            {ai.live ? `${ai.id} · ${ai.model}` : "Not connected"}
          </Badge>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Features</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 pt-0">
          {FLAGS.map((flag) => (
            <label
              key={flag.key}
              className="flex cursor-pointer items-start justify-between gap-4 rounded-lg px-1 py-2.5"
            >
              <span className="flex min-w-0 items-start gap-2.5">
                <flag.Icon className="mt-0.5 size-4 shrink-0 text-ink-muted" />
                <span className="min-w-0">
                  <span className="block text-[13.5px] font-medium text-ink">{flag.label}</span>
                  <span className="mt-0.5 block text-[12.5px] text-ink-muted">{flag.hint}</span>
                </span>
              </span>
              <Switch
                checked={settings[flag.key]}
                onCheckedChange={(value) => set(flag.key, value)}
                className="mt-0.5 shrink-0"
              />
            </label>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Data</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <Field
            label="Evidence retention"
            htmlFor="retention"
            hint="Photos older than this are deleted automatically by the nightly job."
          >
            <Input
              id="retention"
              type="number"
              min={1}
              max={365}
              value={settings.retentionDays}
              onChange={(e) => set("retentionDays", Number(e.target.value))}
              className="max-w-32"
            />
          </Field>
          <Field
            label="Confidence threshold"
            htmlFor="threshold"
            hint="Below this, the reviewer routes the activity to a human."
          >
            <Input
              id="threshold"
              type="number"
              step={0.05}
              min={0}
              max={1}
              value={settings.aiConfidenceThreshold}
              onChange={(e) => set("aiConfidenceThreshold", Number(e.target.value))}
              className="max-w-32"
            />
          </Field>
        </CardContent>
      </Card>

      <Button onClick={() => void save()} loading={saving}>
        <Save className="size-4" />
        Save settings
      </Button>
    </div>
  );
}