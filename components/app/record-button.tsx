"use client";

import { Droplets } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRecordRefillDialog } from "@/components/record/record-dialog-provider";

/** Client-side entry point to the recording flow. */
export function RecordButton({
  variant = "primary",
  size = "lg",
  className,
  label = "I filled the bottles",
  fullScreenOnMobile = false,
}: {
  variant?: "primary" | "secondary" | "outline";
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  label?: string;
  fullScreenOnMobile?: boolean;
}) {
  const { open } = useRecordRefillDialog();
  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={() => open(fullScreenOnMobile)}
    >
      <Droplets className="size-4" />
      {label}
    </Button>
  );
}