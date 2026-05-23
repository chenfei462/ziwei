# 紫微斗数互动项目：阶段交付物索引

本目录保存紫微斗数互动项目 Web MVP 的阶段性交付物、数据文件、核心代码和验证命令。

## 交付物

### 阶段 0：立项与校准

- `docs/phase0/需求文档-v0.1.md`：产品定位、MVP 范围、核心流程、专业/娱乐模式边界。
- `docs/phase0/规则口径说明-v0.1.md`：排盘规则默认口径、可配置项、暂不支持项。
- `docs/phase0/API草案冻结版-v0.1.md`：阶段 1 排盘引擎需要对齐的 API 输入输出意图。
- `docs/phase0/阶段0评审清单-v0.1.md`：10 天执行节奏、验收清单、阶段出口。
- `data/phase0/sample-charts-v0.1.csv`：首批 30 个样例盘种子数据，等待紫微顾问填写预期排盘结果。
- `data/phase0/sample-charts-v0.1.README.md`：样例盘字段说明与顾问验收方式。
- `data/phase0/classical-knowledge-base-v0.1.json`：原典知识库 v0.1 骨架。

### 阶段 1：排盘引擎

- `src/`：TypeScript/Node.js 排盘核心库、API handler、计算追踪和解释占位响应。
- `tests/`：排盘核心、API 合同和 100 个测试盘交付物的自动化测试。
- `data/phase1/rule-table-v0.1.json`：规则表 v0.1。
- `data/phase1/test-charts-v0.1.csv`：100 个测试盘种子数据。
- `docs/phase1/阶段1实施说明-v0.1.md`：运行命令、交付物和正确性边界。
- `docs/phase1/阶段2对接说明-v0.1.md`：阶段 2 交互原型读取字段与交互映射。

### 阶段 2：交互原型

- `src/app`：Next.js App Router 页面与 API route wrapper。
- `src/components/phase2`：建档表单、2D 星盘、宫位卡、手势控制、手势日志、层级切换组件。
- `src/phase2`：星盘视图模型、交互状态机和手势动作映射。
- `docs/phase2/UI规范-v0.1.md`：十二宫布局、关系高亮、星曜层级、手势反馈和隐私规则。
- `docs/phase2/演示脚本-v0.1.md`：3 分钟演示流程。

### 阶段 3：解读引擎

- `src/phase3`：规则加载、条件匹配、置信等级、安全审查和解读结果组装。
- `data/phase3/interpretation-rules-v0.1.json`：六宫规则表与文案 v0.1。
- `data/phase3/copy-templates-v0.1.json`：专业/娱乐模式模板与安全提示。
- `src/components/phase2/PalaceCard.tsx`：正式解读卡、模式切换和规则溯源展开。
- `docs/phase3/阶段3实施说明-v0.1.md`：API 输出、前端更新和正确性边界。
- `docs/phase3/规则与文案审查清单-v0.1.md`：顾问抽检、内容安全和阶段出口清单。

### 阶段 4：MVP 封闭测试

- `src/phase4`：封测反馈脱敏、隐私保护、指标汇总和问题分类。
- `src/components/phase4`：封测说明与反馈提交面板。
- `src/app/api/feedback/route.ts`：封测反馈提交与汇总读取接口。
- `data/phase4/feedback-dataset-v0.1.csv`：反馈数据集模板与种子行。
- `docs/phase4/封测任务脚本-v0.1.md`：封测用户任务、观察重点和隐私提示。
- `docs/phase4/反馈报告-v0.1.md`：第 14-16 周反馈复盘模板。
- `docs/phase4/修复清单-v0.1.md`：问题分级、当前修复记录和 Beta 前确认项。

## 运行命令

### 阶段 5：Beta 与商业化

- `src/phase5`：Beta 分享卡、收藏、报告意向和数据看板汇总逻辑。
- `src/components/phase5/BetaGrowthPanel.tsx`：主原型中的分享、收藏、报告意向验证面板。
- `src/app/api/beta/*/route.ts`：分享卡、收藏、报告意向和 Beta 看板接口。
- `data/phase5/beta-dashboard-v0.1.json`：Beta 数据看板指标口径。
- `docs/phase5/Beta实施说明-v0.1.md`：阶段 5 范围、接口、隐私和验收说明。
- `docs/phase5/运营素材包-v0.1.md`：演示脚本、短视频脚本、社群招募文案、FAQ 和合规说明。
- `docs/phase5/商业化验证报告-v0.1.md`：价格测试、上线风险和下一步建议。

### 阶段 6：AR / 大屏沉浸式扩展

- `src/phase6`：沉浸式临时 session、事件脱敏、AR 能力降级和手势映射。
- `src/components/phase6`：大屏展示页、移动控制端和 AR 预览组件。
- `src/app/immersive`：大屏入口、控制端入口和 AR 预览入口。
- `src/app/api/immersive/session/*`：沉浸式 session、事件和 stream API。
- `data/phase6/immersive-metrics-v0.1.json`：大屏/AR 指标口径。
- `docs/phase6/活动演示手册-v0.1.md`：设备、投屏、隐私告知和故障降级流程。
- `docs/phase6/沉浸式体验复盘报告-v0.1.md`：现场演示复盘指标和下一步建议。

### 阶段 7：合盘与流年扩展

- `src/phase7`：合盘、年度主题、月度观察和分享脱敏核心逻辑。
- `src/components/phase7`：合盘对照和年度主题前端面板。
- `src/app/phase7`：阶段 7 演示入口。
- `src/app/api/synastry/create`：合盘 API。
- `src/app/api/timeline/interpret`：年度/月度主题 API。
- `data/phase7`：合盘规则表、流年流月规则表、30 条合盘样例和 30 条流年/月度样例。
- `docs/phase7`：实施说明和阶段评审报告。

### 阶段 8：报告导出与创作者工作台

- `src/phase8`：报告组合器、内容审查、报告快照和导出预览核心逻辑。
- `src/components/phase8`：创作者工作台前端组件。
- `src/app/phase8`：阶段 8 演示入口。
- `src/app/api/report/*`：报告草稿、报告读取和导出预览 API。
- `data/phase8`：报告模板 v0.1 和创作者素材口径 v0.1。
- `docs/phase8`：实施说明、内容审查报告和商业化衔接说明。

### 阶段 9：支付 / 订单 / 会员权益

- `src/phase9`：订单状态机、checkout session、签名 webhook、权益和商业看板逻辑。
- `src/components/phase9`：商业化 MVP 前端面板。
- `src/app/phase9`：阶段 9 演示入口。
- `src/app/api/order/*`、`src/app/api/checkout/session`、`src/app/api/payment/webhook`：订单与支付 API。
- `src/app/api/entitlement/*`、`src/app/api/member/me`、`src/app/api/commercial/dashboard`：权益和看板 API。
- `data/phase9`：套餐、价格和 provider 口径 v0.1。
- `docs/phase9`：支付订单说明、合规客服文档和商业化验证报告。

```bash
npm install
npm run generate:fixtures
npm test
npm run typecheck
npm run build
npm run dev
npm run test:e2e
```

## 重要限制

样例盘数据目前是「校验种子集」，不是已通过专家审定的自动化断言集。进入 golden tests 前，紫微顾问需要补齐并确认每个样例盘的预期十二宫、主星、四化与大限。阶段 3 和阶段 7 规则表目前是工程 v0.1，能用于联调和抽检；顾问完成逐条审查前，不能宣称专业验收通过。阶段 7 合盘不输出婚恋成败判断，流年/月度不输出具体事件预测。
