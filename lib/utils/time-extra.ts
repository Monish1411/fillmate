/**
 * Timezone helpers - compatibility path.
 *
 * These helpers originally lived in a separate `time-extra` module. They were
 * consolidated into `./time` so there is exactly one place that owns timezone
 * formatting, but this module path is kept as a thin re-export barrel.
 *
 * Two reasons it stays:
 *
 *  1. Import paths that still point at `@/lib/utils/time-extra` keep working.
 *  2. Editors that still hold an open (or hot-exit restored) model for this
 *     path resolve against a real, valid module instead of a phantom one.
 *
 * New code should import from `@/lib/utils/time` directly.
 */
export * from "./time";
