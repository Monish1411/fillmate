import "server-only";
import { env } from "@/lib/env";
import type { AIProvider } from "./provider";
import { GeminiProvider, LocalHeuristicProvider, OpenAIProvider } from "./providers";

/**
 * Provider registry.
 *
 * Adding a vision vendor means adding one class in `providers.ts` and one
 * line here. No business logic anywhere else references a specific vendor.
 */

const registry = new Map<string, AIProvider>();

function make(kind: string): AIProvider {
  switch (kind) {
    case "openai":
      return new OpenAIProvider();
    case "gemini":
      return new GeminiProvider();
    default:
      return new LocalHeuristicProvider();
  }
}

/** Resolve the active provider. Falls back to the local analyser. */
export function getProvider(): AIProvider {
  const key = env.aiProvider;
  const cached = registry.get(key);
  if (cached) return cached;
  const provider = make(key);
  registry.set(key, provider);
  return provider;
}

/** Whether real vision analysis is available on this deployment. */
export function isLiveVerification(): boolean {
  return env.aiEnabled && getProvider().isRealVision;
}

export function providerStatus(): {
  id: string;
  model: string;
  live: boolean;
  label: string;
} {
  const provider = getProvider();
  return {
    id: provider.id,
    model: provider.model,
    live: isLiveVerification(),
    label: provider.isRealVision
      ? provider.model
      : "Local checks only — connect an AI provider for photo verification",
  };
}

export * from "./provider";