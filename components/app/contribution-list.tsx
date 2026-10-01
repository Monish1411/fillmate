import * as React from "react";
import { cn } from "@/lib/utils/cn";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/states";
import { dayKey } from "@/lib/utils/time";
import { pluralize } from "@/lib/utils/format";
import type { MemberContribution } from "@/types/views";

/**
 * Room contribution list.
 *
 * Wording is deliberately neutral: these are activity facts, not a scoreboard
 * of blame. Members can hide their numbers entirely.
 */
export function ContributionList({
  members,
  showLastActive = true,
  className,
}: {
  members: MemberContribution[];
  showLastActive?: boolean;
  className?: string;
}) {
  if (members.length === 0) {
    return (
      <EmptyState
        compact
        title="Invite your roommates"
        description="Share an invite link so everyone can log refills."
        className={className}
      />
    );
  }

  const max = Math.max(...members.map((m) => m.bottles), 1);

  return (
    <ul className={cn("divide-y divide-border-subtle", className)}>
      {members.map((member) => (
        <li key={member.userId} className="flex items-center gap-3 px-4 py-2.5">
          <Avatar name={member.name} src={member.avatarUrl} size="sm" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-[13.5px] font-medium text-ink">
                {member.isMe ? "You" : member.name}
              </p>
              {member.roomRole === "captain" ? (
                <Badge tone="accent" className="px-1.5 py-0 text-[10px]">
                  captain
                </Badge>
              ) : null}
            </div>
            <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-gauge-empty">
              <div
                className={cn(
                  "h-full rounded-full",
                  member.isMe ? "bg-aqua" : "bg-gauge-fill-soft",
                )}
                style={{ width: `${Math.max(4, (member.bottles / max) * 100)}%` }}
              />
            </div>
            {showLastActive && member.lastActivityAt ? (
              <p className="mt-1 text-[11px] text-ink-muted">
                Last active {dayKey(member.lastActivityAt) === dayKey(new Date()) ? "today" : "recently"}
              </p>
            ) : null}
          </div>
          <div className="shrink-0 text-right">
            {member.hidden ? (
              <span className="text-[12px] text-ink-muted">Private</span>
            ) : (
              <>
                <p className="tabular text-[14px] font-semibold text-ink">{member.bottles}</p>
                <p className="text-[11px] text-ink-muted">
                  {member.fills} {pluralize(member.fills, "fill")}
                </p>
              </>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
