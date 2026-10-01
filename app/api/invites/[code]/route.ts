import { ok, route } from "@/lib/http/response";
import { previewInvite } from "@/lib/repositories/invites";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public invite preview - safe to render for signed-out visitors. */
export const GET = route(
  async (_request: Request, context: { params: Promise<{ code: string }> }) => {
    const { code } = await context.params;
    const preview = await previewInvite(code);
    return ok(preview, { status: preview.valid ? 200 : 404 });
  },
);