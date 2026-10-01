"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { Camera, ImageUp, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface CapturedPhoto {
  dataUrl: string;
  file: File;
}

/**
 * Camera-first capture surface.
 *
 * On a phone the primary input opens the rear camera directly. The guidance
 * overlay sits around the viewfinder so the student knows what to frame.
 */
export function CameraCapture({
  photo,
  onCapture,
  onRetake,
  disabled,
  required = true,
  error,
}: {
  photo: CapturedPhoto | null;
  onCapture: (photo: CapturedPhoto | null) => void;
  onRetake: () => void;
  disabled?: boolean;
  required?: boolean;
  error?: string | null;
}) {
  const cameraRef = React.useRef<HTMLInputElement>(null);
  const uploadRef = React.useRef<HTMLInputElement>(null);

  const handleFile = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file || file.size > 12 * 1024 * 1024) return;
      const reader = new FileReader();
      reader.onload = () => onCapture({ dataUrl: String(reader.result), file });
      reader.readAsDataURL(file);
    },
    [onCapture],
  );

  return (
    <div className="space-y-3">
      <AnimatePresence mode="wait" initial={false}>
        {photo ? (
          <motion.div
            key="preview"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-3"
          >
            <div className="relative overflow-hidden rounded-lg border border-border bg-surface-sunken">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.dataUrl}
                alt="Photo preview of the filled bottles"
                className="aspect-4/3 w-full object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-linear-to-t from-black/70 to-transparent p-3">
                <p className="text-[12px] font-medium text-white">Use this photo?</p>
                <p className="tabular text-[11px] text-white/75">
                  {(photo.file.size / (1024 * 1024)).toFixed(1)} MB
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="secondary" onClick={onRetake} disabled={disabled}>
                <RefreshCw className="size-4" />
                Retake
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onCapture(null)}
                disabled={disabled}
              >
                <Trash2 className="size-4" />
                Remove
              </Button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="capture"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="space-y-3"
          >
            <CaptureFrame />
            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                type="button"
                size="lg"
                onClick={() => cameraRef.current?.click()}
                disabled={disabled}
              >
                <Camera className="size-4.5" />
                Take photo
              </Button>
              <Button
                type="button"
                size="lg"
                variant="secondary"
                onClick={() => uploadRef.current?.click()}
                disabled={disabled}
              >
                <ImageUp className="size-4.5" />
                Upload photo
              </Button>
            </div>
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={handleFile}
              aria-label="Take a photo of the filled bottles"
            />
            <input
              ref={uploadRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={handleFile}
              aria-label="Upload a photo of the filled bottles"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {error ? (
        <p role="alert" className="text-[12.5px] text-danger">
          {error}
        </p>
      ) : !photo && required ? (
        <p className="text-[12.5px] text-ink-muted">
          One photo is all it takes. Most people finish this in under 15 seconds.
        </p>
      ) : null}
    </div>
  );
}
/** Framing guide shown before capture. */
function CaptureFrame() {
  const hints = ["Cooler visible", "Bottles visible", "Good lighting"];
  return (
    <div className="relative overflow-hidden rounded-lg border border-border bg-ink">
      <div className="grid aspect-4/3 place-items-center bg-grid opacity-25" aria-hidden />
      <div className="absolute inset-0 grid place-items-center p-6">
        <div className="flex w-full flex-col items-center gap-3">
          <FrameGuide />
          <div className="text-center">
            <p className="text-[13px] font-medium text-white">
              Capture the bottles and cooler in the same frame
            </p>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-white/70">
              {hints.map((hint) => (
                <span key={hint} className="inline-flex items-center gap-1">
                  <span className="size-1.5 rounded-full bg-aqua" aria-hidden />
                  {hint}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FrameGuide() {
  return (
    <svg viewBox="0 0 120 80" className="h-24 w-auto text-aqua" fill="none" aria-hidden>
      <path
        d="M2 12V4a2 2 0 0 1 2-2h8M108 2h8a2 2 0 0 1 2 2v8M118 68v8a2 2 0 0 1-2 2h-8M12 78H4a2 2 0 0 1-2-2v-8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <g opacity="0.7">
        <path
          d="M40 56V30a4 4 0 0 1 1.6-3.2l2.4-1.8V22h12v3l2.4 1.8A4 4 0 0 1 60 30v26a6 6 0 0 1-6 6h-8a6 6 0 0 1-6-6Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path
          d="M72 56V32a4 4 0 0 1 1.6-3.2l2.2-1.7V24h11v3.1l2.2 1.7A4 4 0 0 1 90 32v24a6 6 0 0 1-6 6h-6a6 6 0 0 1-6-6Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </g>
      <rect x="86" y="12" width="20" height="26" rx="3" stroke="currentColor" strokeWidth="1.6" opacity="0.5" />
      <path d="M92 12V9h8v3" stroke="currentColor" strokeWidth="1.6" opacity="0.5" />
    </svg>
  );
}