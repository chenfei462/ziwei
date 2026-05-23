export default function OfflinePage() {
  return (
    <main className="phase13-page">
      <section className="workspace-header">
        <div>
          <p className="eyebrow">PWA Offline</p>
          <h1>Offline Fallback</h1>
        </div>
        <div className="status-strip" aria-label="Offline privacy">
          <span>no_sensitive_birth_data</span>
          <span>no_camera_frame</span>
        </div>
      </section>
      <section className="phase13-layout">
        <article className="phase13-panel">
          <h2>Saved mobile shell</h2>
          <p className="muted">
            Network access is unavailable. Reopen the mobile Stargarden when the connection returns; cached pages do not expose full birth
            date, birth time, location detail, or camera frames.
          </p>
        </article>
      </section>
    </main>
  );
}
