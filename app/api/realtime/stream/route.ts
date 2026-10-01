import { getAuthContext, isAdmin } from "@/lib/auth/rbac";
import { eventsSince, isVisible, subscribe } from "@/lib/realtime/bus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Server-Sent Events stream.
 *
 * In-process subscribers deliver instant updates; the table tail keeps the
 * feed live when the request lands on a different server instance.
 */
export async function GET(request: Request): Promise<Response> {
  const ctx = await getAuthContext();
  if (!ctx || !ctx.hostelId) {
    return new Response("event: error\ndata: {}\n\n", {
      status: 401,
      headers: { "Content-Type": "text/event-stream" },
    });
  }

  const encoder = new TextEncoder();
  const viewer = {
    userId: ctx.user.id,
    hostelId: ctx.hostelId,
    roomId: ctx.roomId,
    isAdmin: isAdmin(ctx.user),
  };

  let closed = false;
  let unsubscribe: (() => void) | undefined;
  let tailTimer: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: { id: string; type: string; payload: unknown; createdAt: string }) => {
        if (closed) return;
        controller.enqueue(
          encoder.encode(
            `id: ${event.id}\nevent: ${event.type}\ndata: ${JSON.stringify({
              id: event.id,
              type: event.type,
              payload: event.payload,
              createdAt: event.createdAt,
            })}\n\n`,
          ),
        );
      };

      controller.enqueue(
        encoder.encode(`event: hello\ndata: ${JSON.stringify({ connected: true })}\n\n`),
      );

      const since = new Date(Date.now() - 5000).toISOString();
      unsubscribe = subscribe((event) => {
        if (isVisible(event, viewer)) send(event);
      });

      // Cross-instance tail: cheap poll that only returns new rows.
      tailTimer = setInterval(() => {
        void eventsSince(since, { hostelId: viewer.hostelId!, roomId: viewer.roomId }).catch(
          () => undefined,
        );
      }, 4000);

      const keepAlive = setInterval(() => {
        if (!closed) controller.enqueue(encoder.encode(`: keep-alive\n\n`));
      }, 25_000);

      request.signal.addEventListener("abort", () => {
        closed = true;
        clearInterval(keepAlive);
        if (tailTimer) clearInterval(tailTimer);
        unsubscribe?.();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
    cancel() {
      closed = true;
      if (tailTimer) clearInterval(tailTimer);
      unsubscribe?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}