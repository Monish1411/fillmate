import { fail, ok, route } from "@/lib/http/response";
import { requireAuth } from "@/lib/auth/rbac";
import { onboardingSchema } from "@/lib/validation/schemas";
import {
  completeOnboarding,
  getOnboardingState,
  listSelectableHostels,
  selectHostel,
  selectRoom,
} from "@/lib/services/onboarding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const ctx = await requireAuth();
  const [state, hostels] = await Promise.all([
    getOnboardingState(ctx),
    listSelectableHostels(),
  ]);
  return ok({ state, hostels });
});

export const POST = route(async (request: Request) => {
  const ctx = await requireAuth();
  const body = onboardingSchema.parse(await request.json().catch(() => null));

  switch (body.step) {
    case "hostel": {
      if (!body.hostelId && !body.hostelCode && !body.hostelName) {
        return fail("validation_error", "Pick your hostel from the list.");
      }
      return ok(await selectHostel(ctx, body));
    }
    case "room": {
      if (!body.roomNumber) return fail("validation_error", "Enter your room number.");
      return ok(
        await selectRoom(ctx, {
          roomNumber: body.roomNumber,
          bottleTarget: body.bottleTarget,
          floor: body.floor,
        }),
      );
    }
    case "ready": {
      await completeOnboarding(ctx);
      return ok({ done: true });
    }
    default:
      return fail("validation_error", "Unknown onboarding step.");
  }
});