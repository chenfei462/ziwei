export default function OfflinePage() {
  return (
    <main className="public-page">
      <section className="workspace-header">
        <div>
          <p className="eyebrow">离线状态</p>
          <h1>网络暂不可用</h1>
        </div>
        <div className="status-strip" aria-label="Offline privacy">
          <span>no_sensitive_birth_data</span>
          <span>no_camera_frame</span>
        </div>
      </section>
      <section className="public-list-panel">
        <article>
          <h2>已保存移动端外壳</h2>
          <p className="muted">
            当前无法连接网络。请恢复连接后重新打开紫微星垣；缓存页面不会展示完整出生日期、出生时间、地点或影像帧。
          </p>
        </article>
      </section>
    </main>
  );
}
