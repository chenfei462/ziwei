Page({
  data: {
    webUrl: ""
  },
  onLoad(query) {
    const app = getApp();
    const channel = normalizeAttribution(query.channel) || "mini_program";
    const campaign = normalizeAttribution(query.campaign) || "mini_program_review";
    const shareId = normalizeAttribution(query.share_id);
    const params = new URLSearchParams({
      channel,
      campaign
    });
    const fallbackPath = app.globalData.fallbackPath === "/chart/new" ? "/chart/new" : app.globalData.fallbackPath;
    const landingPath = shareId ? `/share/${shareId}` : fallbackPath;
    if (!shareId) params.set("share_id", "");
    this.setData({
      webUrl: `${app.globalData.webBaseUrl}${landingPath}?${params.toString()}`
    });
  },
  onShareAppMessage() {
    return {
      title: "Zi Wei Stargarden",
      path: "/pages/index/index?channel=mini_program&campaign=organic_share"
    };
  }
});

function normalizeAttribution(value) {
  const normalized = String(value || "").trim().slice(0, 64);
  return /^[a-zA-Z0-9_-]+$/.test(normalized) ? normalized : "";
}
