import { MobileController } from "../../../../components/phase6/MobileController.js";
import { getImmersiveSession } from "../../../../phase6/immersive.js";
import type { ImmersiveSession } from "../../../../types.js";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ImmersiveControlPage({ params }: PageProps) {
  const { id } = await params;
  const session = getImmersiveSession(id) ?? createDetachedSession(id);

  return <MobileController session={session} />;
}

function createDetachedSession(sessionId: string): ImmersiveSession {
  const now = new Date();
  return {
    session_id: sessionId,
    short_code: sessionId.replace(/[^a-z0-9]/gi, "").slice(-6).toUpperCase().padEnd(6, "0"),
    chart_id: "detached_stage_chart",
    display_mode: "stage_screen",
    created_at: now.toISOString(),
    expires_at: new Date(now.getTime() + 45 * 60_000).toISOString(),
    active_layer: "main",
    active_major_period_index: 0,
    interpretation_mode: "professional",
    is_panorama: false,
    event_count: 0,
    privacy: {
      hides_full_birth_date: true,
      hides_birth_time: true,
      hides_location_detail: true,
      stores_video_frame: false
    },
    calibration: {
      camera_permission: "not_requested",
      light_quality: "unknown",
      ar_supported: false,
      fallback_mode: "manual_panorama",
      no_video_frame: true
    }
  };
}
