import type { RoomStatus } from "@/types/views";

/** Shared, dependency-free presentation helpers for room status. */

export function roomStatusLabel(status: RoomStatus): string {
  switch (status) {
    case "full":
      return "All bottles filled";
    case "needs_refill":
      return "Refill needed";
    case "overdue":
      return "No refill logged today";
    default:
      return "No activity yet";
  }
}

export function roomStatusTone(
  status: RoomStatus,
): "success" | "warning" | "danger" | "neutral" {
  switch (status) {
    case "full":
      return "success";
    case "needs_refill":
      return "warning";
    case "overdue":
      return "danger";
    default:
      return "neutral";
  }
}

export function roomStatusHeadline(status: RoomStatus, filled: number, target: number): string {
  switch (status) {
    case "full":
      return "All bottles filled";
    case "needs_refill":
      return `${Math.max(0, target - filled)} more to reach today\u2019s target`;
    case "overdue":
      return "No refill logged today";
    default:
      return "Nothing logged yet";
  }
}