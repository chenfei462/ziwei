Page({
  data: {
    webUrl: ""
  },
  onLoad(query) {
    const app = getApp();
    const params = new URLSearchParams({
      channel: query.channel || "mini_program",
      campaign: query.campaign || "mini_program_review",
      share_id: query.share_id || "",
      visitor_id: query.visitor_id || ""
    });
    this.setData({
      webUrl: `${app.globalData.webBaseUrl}/phase15?${params.toString()}`
    });
  },
  onShareAppMessage() {
    return {
      title: "Zi Wei Stargarden",
      path: "/pages/index/index?channel=mini_program&campaign=organic_share"
    };
  }
});
