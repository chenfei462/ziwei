# Trae CN 黑客松最终提交控制台

更新时间：2026-07-07

用途：把紫微星垣的投稿材料、截图证据、验证命令、投资人叙事和用户必须补齐的真实外链收敛到一张总表。提交前只看这份文档，就能判断是否已经从“本地 Demo”变成“评委和企业家能打开、能验证、能转发、愿意继续聊”的项目。

## 一句话定位

紫微星垣把高门槛紫微斗数转成可解释、可脱敏分享、可连续打卡的 AI 观察卡，用免费生成获客，用社交分享扩散，用私密报告和会员权益转化。

## 投稿表单可直接粘贴

| 字段 | 建议内容 |
| --- | --- |
| 作品名称 | 紫微星垣 |
| 推荐标题 | 紫微星垣：把传统紫微斗数做成可解释、可脱敏分享、可持续观察的 AI 观察卡 |
| 一句话简介 | 输入必要出生资料后生成星垣观察卡，展示规则来源、现代转译、隐私脱敏分享和 7 日观察挑战。 |
| 适合赛道 | 生活娱乐 / 造点新花样；也可叙述为传统文化 AI、古籍知识活化、非遗创新创意开发。 |
| 核心闭环 | 免费建卡 -> 结构化解读 -> AI 转译过程 -> 脱敏分享 -> 好友二次生成 -> 7 日观察 -> 私密报告/会员转化。 |
| 投资人看点 | 已具备获客、传播、留存、转化、隐私边界、沙箱支付和工程验证的产品雏形；下一步需要真实流量验证指标。 |
| 明确边界 | 不是命运预测，不提供医疗、投资、法律、婚恋成败或灾祸判断；内容用于传统文化体验、娱乐和自我观察。 |

## 当前本地可证明证据

| 证据 | 状态 | 位置 |
| --- | --- | --- |
| 截图资产包 | 已生成，10 张 | `output/trae-assets/manifest.json` |
| 首页首屏 | 已生成 | `output/trae-assets/01-home-hero-desktop.png` |
| 建卡表单与隐私提示 | 已生成 | `output/trae-assets/02-create-form-privacy-demo.png` |
| 观察卡结果页 | 已生成 | `output/trae-assets/03-chart-overview-desktop.png` |
| AI 转译过程 | 已生成 | `output/trae-assets/04-ai-trace-desktop.png` |
| 今日星垣卡 / 7 日挑战 | 已生成 | `output/trae-assets/05-daily-stargarden-challenge.png`、`output/trae-assets/06-seven-day-challenge-mobile.png` |
| 脱敏分享移动页 | 已生成，已目检中文隐私说明 | `output/trae-assets/05-share-privacy-mobile.png` |
| 报告解锁页 | 已生成，已清理英文标题和内部枚举 | `output/trae-assets/07-report-unlock-desktop.png` |
| 投资人增长闭环图 | 已生成 | `output/trae-assets/08-investor-loop-slide.png` |
| 移动端首页 | 已生成 | `output/trae-assets/09-home-mobile.png` |
| 投资人一页纸 | 已写 | `docs/trae-submission/investor-one-pager.md` |
| 8 页 mini deck 文稿 | 已写 | `docs/trae-submission/investor-mini-deck.md` |
| HTML deck | 已写 | `docs/trae-submission/investor-deck.html` |
| 3 分钟路演脚本 | 已写 | `docs/trae-submission/demo-script.md` |
| 评委 Q&A | 已写 | `docs/trae-submission/judging-qna.md` |

## 必须由用户补齐的真实外部证据

这些不能用本地生成物替代。缺其中任意一项，投资人仍可能把项目当成本地作品。

| 优先级 | 必填项 | 填入位置 | 验收标准 |
| --- | --- | --- | --- |
| P0 | 公开可访问体验链接 | `docs/trae-submission/assets-checklist.md` | 手机和桌面都能打开首页、建卡、分享页。 |
| P0 | 代码仓库链接 | `docs/trae-submission/assets-checklist.md` | README、运行方式、截图资产和提交材料可见。 |
| P0 | 社区作品帖链接 | `docs/trae-submission/assets-checklist.md` | 能被评委/投资人转发，正文带截图、视频和体验链接。 |
| P0 | 15-30 秒演示视频链接 | `docs/trae-submission/assets-checklist.md` | 画面覆盖“建卡 -> AI 转译 -> 脱敏分享 -> 7 日观察”。 |
| P0 | Trae / Codex 关键 Session ID | `docs/trae-submission/process-log.md` | 至少 3 条：产品定位、公开主流程、截图/投稿材料。 |
| P0 | 验证命令截图或录屏 | `docs/trae-submission/assets-checklist.md` | 体现 `npm run typecheck`、关键测试、截图生成脚本。 |
| P1 | 1-2 条真实用户反馈 | 新增到社区帖或 investor one-pager | 反馈必须回答“看得懂吗、愿意分享吗、愿意点报告吗”。 |
| P1 | 真实体验链接二维码 | `docs/trae-submission/assets-checklist.md` | 可放在 deck 末页或演示视频结尾。 |

## 30 秒视频脚本

1. 0-4 秒：首页，一句话出现“传统文化 AI 观察卡 / 星垣观察卡”。
2. 4-9 秒：点击“创建我的观察卡”，使用演示资料生成。
3. 9-15 秒：展示结果页的“规则来源、现代解释、安全过滤、隐私不展示”。
4. 15-21 秒：展示脱敏分享页，强调隐藏完整生日、出生时间、精确地点和真实身份。
5. 21-26 秒：展示 7 日星垣挑战和今日打卡。
6. 26-30 秒：展示报告摘要和“沙箱验证，正式收款需商户配置”的商业化入口。

推荐旁白：

> 我用 Trae/Codex 做了紫微星垣，把高门槛紫微斗数转成一张可解释、可脱敏分享、可连续观察的 AI 观察卡。它不是命运预测，而是传统文化、自我观察和轻量情绪价值体验。现在已经跑通免费建卡、AI 转译、脱敏分享、7 日观察和报告转化雏形，下一步要用真实流量验证分享、留存和付费意向。

## 3 分钟路演结构

| 时间 | 内容 | 证据 |
| --- | --- | --- |
| 0:00-0:20 | 问题：传统术语难懂、泛 AI 不可信、公开分享有隐私风险。 | 首页首屏截图 |
| 0:20-0:55 | 方案：星垣观察卡，把规则 trace 转成现代语言，并默认脱敏。 | 结果页 + AI 转译截图 |
| 0:55-1:35 | Demo：建卡、结果、分享、7 日挑战。 | 4 张核心截图或实时演示 |
| 1:35-2:05 | 增长闭环：免费生成、社交传播、连续观察、报告转化。 | `08-investor-loop-slide.png` |
| 2:05-2:35 | 工程可信度：测试、typecheck、隐私边界、沙箱支付和生产化 readiness。 | 验证命令截图 |
| 2:35-3:00 | 资源诉求：需要种子流量、内容安全评估、支付/登录配置和真实用户反馈。 | 用户补齐证据表 |

## 投资人提问时的回答边界

| 问题 | 建议回答 |
| --- | --- |
| 现在有真实收入吗？ | 当前是沙箱支付和权益闭环验证，不伪装成真实收款；真实收款需要微信/支付宝商户配置。 |
| AI 是否会乱说？ | 页面展示规则来源、现代解释、置信度和安全过滤；模型不可用时回退本地规则模板。 |
| 为什么能传播？ | 脱敏分享页隐藏完整出生资料，适合朋友圈/社群传播，并把好友带回二次生成。 |
| 为什么能留存？ | 7 日观察挑战把一次性兴趣变成连续记录，而不是只给一次性结论。 |
| 你现在最缺什么？ | 公开体验链接、真实流量、用户反馈、视频传播素材、内容安全评测和支付/登录生产配置。 |

## 不要在现场夸大的内容

- 不要说已经有真实付费，除非已经接入生产商户并有真实订单。
- 不要把演示指标说成真实用户指标；所有转化率假设都要标注“待验证”。
- 不要说项目能预测命运；统一说“传统文化 AI 观察卡 / 自我观察 / 娱乐体验”。
- 不要展示完整出生日期、出生时间、精确地点或真实身份。
- 不要把 `star_zi_wei`、`standard_49`、`trace` 等内部字段放进投稿截图。

## 提交前最后 60 分钟检查

1. 重新跑 `node scripts/capture-trae-assets.mjs`，确认 `output/trae-assets/manifest.json` 有 10 张图。
2. 打开 `05-share-privacy-mobile.png`，确认中文隐私说明可见。
3. 打开 `05-daily-stargarden-challenge.png`，确认没有内部 key。
4. 打开 `07-report-unlock-desktop.png`，确认没有英文标题和内部枚举。
5. 跑 `npm run typecheck`。
6. 跑 `npm test -- tests/public-mvp.test.ts --maxWorkers=1 --no-file-parallelism`。
7. 把体验链接、仓库链接、社区帖链接、视频链接、Session ID 补到 `assets-checklist.md` 和 `process-log.md`。
8. 发布社区帖后，把链接回填到本文件和资产清单。

## 当前结论

本地产品闭环、投资材料和截图证据已经接近可投稿状态；真正阻碍“被企业家认可并愿意继续聊投资”的，不是再加功能，而是补齐可公开访问、可复现、可转发、可证明由 Trae/Codex 迭代完成的真实外部证据。
