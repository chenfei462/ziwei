import { getShareLandingSnapshot } from "../../../phase13/growth.js";
import type { ShareLandingResponse } from "../../../types.js";

export const dynamic = "force-dynamic";

type ShareLandingPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ShareLandingPage({ params }: ShareLandingPageProps) {
  const { id } = await params;
  let response: ShareLandingResponse | undefined;
  try {
    response = getShareLandingSnapshot(id);
  } catch {
    response = undefined;
  }

  return (
    <main className="phase13-page">
      <section className="workspace-header">
        <div>
          <p className="eyebrow">Phase 13 Share Landing</p>
          <h1>Share Landing</h1>
        </div>
        <div className="status-strip" aria-label="Share privacy">
          <span>privacy_redaction_required</span>
          <span>no_video_frame</span>
        </div>
      </section>
      <section className="phase13-layout">
        {response ? (
          <article className="phase13-panel">
            <p className="phase13-kicker">{response.snapshot.version}</p>
            <h2>{response.snapshot.title}</h2>
            <p className="muted">{response.snapshot.summary}</p>
            <div className="phase13-chip-row">
              {response.snapshot.keywords.map((keyword) => (
                <span key={keyword}>{keyword}</span>
              ))}
              {response.snapshot.safety_flags.map((flag) => (
                <span key={flag}>{flag}</span>
              ))}
            </div>
            <p className="muted">{response.snapshot.privacy_note}</p>
          </article>
        ) : (
          <article className="phase13-panel">
            <h2>Share snapshot unavailable</h2>
            <p className="muted">This share card is missing or expired. Sensitive birth data is not shown on landing pages.</p>
          </article>
        )}
        <aside className="phase13-panel">
          <h2>Community Safe Share</h2>
          <p className="muted">
            Shared cards are cultural entertainment snapshots for light observation. They do not include full birth date, birth time,
            location detail, camera frames, or concrete event predictions.
          </p>
        </aside>
      </section>
    </main>
  );
}
