import { ARPreview } from "../../../../components/phase6/ARPreview.js";
import { detectARCapability, getImmersiveSession } from "../../../../phase6/immersive.js";
import { getChart } from "../../../../store.js";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ImmersiveARPage({ params }: PageProps) {
  const { id } = await params;
  const session = getImmersiveSession(id);
  const chart = session ? getChart(session.chart_id) : undefined;

  if (!session || !chart) {
    return (
      <main className="immersive-page">
        <section className="ar-preview-shell">
          <h1>AR Preview</h1>
          <p className="error-message">Immersive session not found or expired.</p>
          <p className="muted">Manual panorama fallback is active; no video frame is stored or uploaded.</p>
        </section>
      </main>
    );
  }

  const capability = detectARCapability({
    webxr_supported: false,
    camera_permission: "denied",
    device_type: "mobile"
  });

  return <ARPreview capability={capability} chart={chart} session={{ ...session, display_mode: "ar_mobile" }} />;
}
