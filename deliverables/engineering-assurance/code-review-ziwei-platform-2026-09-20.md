# 紫微星垣（ziwei-interactive-chart-engine）全面工程审查报告

**日期**：2026-09-20
**工作流**：工作流 1（综合代码审查）＋ 架构／测试／文档／依赖 扩展维度
**参与成员**：科迪（代码审查师）、阿奇（系统架构师）、泰莎（测试专家）、多库（技术文档师）、雷克斯（SRE 工程师）
**主理人**：甄宇航（工程督导）
**项目**：`ziwei-interactive-chart-engine` v0.1.0（Next.js 16 App Router / React 19 / TypeScript 5.9 / Prisma 6 / PostgreSQL）
**审查范围**：`src/` 196 文件、`src/app/api/**` 88 路由、`tests/` 79 测试文件、`e2e/` 13 spec、`docs/` ~70 md、`prisma/schema.prisma` 30 模型
**方式**：静态代码审查 + 本地只读实测（未读取 `.env.local` 内容，未连接生产库）

---

## 📌 TL;DR（执行摘要）

- **整体结论**：🔴 **不通过（No-Go）**。系统功能面完整、代码组织有工程意识，但存在 **3 条可直接导致资金损失或后台接管的 fail-open 安全路径**，以及 **2 项数据层结构性缺陷**。
- **严重度分布**：🔴严重 **5** 项 / 🟠高 **15** 项 / 🟡中 **18** 项 / 🟢低 **6** 项（合计 44 项）
- **阻塞 / 非阻塞**：**5 项阻塞**（阻塞上线），其余非阻塞但需排期。
- **关键反转**：同日早先一份《上线前全量检查报告》给出「0 Critical、无远程可利用高危漏洞」并判「条件 Go」。本团队复核后**判定该结论不成立**——该报告检查了验签**算法**本身，却未检查**密钥来源的回退模式**与 **provider 可选性**；该报告另有 4 项结论被实测证伪（详见 §6）。
- **最刺眼的一项**：**可观测性函数已定义但从未被调用**（`formatStructuredLog` / `evaluateOperationalAlerts`）。这意味着上述 3 条 P0 路径若已被利用，**当前系统无法发现**，MTTD ≈ ∞。

---

## 🎯 核心结论卡片

| 项目 | 内容 |
|------|------|
| **整体评级** | 🔴 **不通过** |
| **Go / No-Go** | 🔴 **No-Go**（5 项阻塞未解前不得放量） |
| **严重度分布** | 🔴 5 / 🟠 15 / 🟡 18 / 🟢 6 |
| **阻塞项数量** | **5** |
| **关键行动项** | **18 条**（P0 × 6、P1 × 7、P2 × 5） |
| **生产就绪度** | 低—中。属「交付期驱动的原型」，功能面远超架构成熟度 |
| **最大结构性风险** | 数据层**双轨存储**（文件 store 与 PostgreSQL 双写且无事务，同步读仍走文件 store） |
| **最大可利用风险** | 运维后台**默认管理员令牌** + **支付 webhook 伪造**（两条均为 SEV1） |
| **测试现状** | 全量 **79 文件 / 330 用例全部通过**（实测 EXIT=0，421s）——但通过率高**不等于**防护力足（见 §5） |
| **建议下一步** | 先做 3 项「分钟级」止损（见事故响应报告），再解 5 项阻塞，然后重做 Go/No-Go |

---

## 关于证据等级与来源的说明（请先读）

本报告对每条结论标注证据等级，避免"看似已核实"的表述：

| 标记 | 含义 |
|------|------|
| **【实测】** | 主理人**第一手**执行命令或逐行读原文确认，附 `文件:行` |
| **【联审】** | 团队成员静态核查得出（附行号），主理人未逐条重跑 |
| **【待复核】** | 尚未验证，**不作为结论使用**，列入待办 |
| **【推断】** | 基于代码的合理推断，需运行环境或生产数据确认 |

> **一处流程瑕疵（对读者透明）**：科迪（代码审查师）的任务已完成，但其结构化结论正文**两次均未送达主理人**（仅收到完成通知），补发请求亦未收到回复。为不让报告停留在"未署名即未验证"的状态，**本报告所有 🔴 阻塞项及关键 P1 项均由主理人第一手重测/读原文坐实**（附行号），不依赖科迪的结论正文；其负责的维度中无法由主理人独立验证的部分已标注【待复核】，不进入结论。

---

## 1. 统一问题清单（按严重度排序）

> **来源**指该问题的原始产出者。严重度经主理人统一裁量，成员分歧处已显式标注。

### 🔴 P0 严重（5 项 · 阻塞）

| # | 类别 | 位置 | 问题描述 | 证据 | 建议修复 | 来源 |
|---|------|------|---------|------|---------|------|
| **P0-1** | 安全 | `phase10/launchOps.ts:144,1277`；`api.ts:830`；`app/internal/layout.tsx:26`；`app/api/ops/analytics/events/route.ts:18` | **运维后台默认管理员令牌**。`launchOps.ts:144` 定义 `const defaultOpsToken = "phase10_admin_token";`，四处判等均为 `token !== (process.env.PHASE10_ADMIN_TOKEN \|\| default) \|\| !allowedRoles.includes(role)`，**无 `NODE_ENV=production` 保护**。且角色取自客户端可控的 `x-admin-role` 头（多数默认 `support_agent`，`internal/phases/phase10/page.tsx:67` 默认 **`ops_admin`**），actor 亦可伪造 → **审计无法追责**。持默认令牌即可退款、重发权益、读敏感记录与全部订单用户 | **【实测】** 见左列行号（Grep 全仓 `phase10_admin_token` / `x-admin-role`，命中 50+ 处） | 强制环境变量、**删除默认值**；缺配置即启动失败；改服务端会话 + RBAC；actor/role 由服务端确定 | 主理人【实测】/ 雷克斯【联审】/ 阿奇【联审】 |
| **P0-2** | 安全 / 资金 | `phase9/commerce.ts:37-38,951,984,826`；`app/api/payment/webhook/route.ts:50` | **支付 webhook 可伪造（默认路径即中招）**。`:37-38` 定义公开常量 `phase9_sandbox_webhook_secret` / `mock_payment_webhook_secret`；`:984` 为 `STRIPE_WEBHOOK_SECRET \|\| sandboxWebhookSecret`、`:951` 同理；`route.ts:50` 的 provider 由 `?provider=` 或 `x-payment-provider` **客户端自选、默认 `stripe_checkout`**；`:826` 直接用适配器密钥算 HMAC。故当 `STRIPE_WEBHOOK_SECRET` 未配置时，**密钥即源码公开常量，攻击者可自行算出合法签名**，伪造 `checkout.session.completed` → 订单置 `fulfilled` 并发放 entitlement | **【实测】** 见左列行号（逐行读原文确认） | 缺密钥直接 503；**移除全部默认常量**；provider 强白名单、禁止客户端自选；校验 `provider_mode` | 主理人【实测】/ 雷克斯【联审】 |
| **P0-2b** | 安全（同源，精确区分） | `phase9/commerce.ts:806,838-866` | **同一模块内三条 provider 路径的安全等级并不一致**：`wechat_pay_reserved` 为 **fail-closed**（`:862-865` 无 `WECHAT_PAY_PLATFORM_CERT` 即抛错，另校验平台证书序列号与 5 分钟时效）；`alipay_reserved` 走 RSA2。**只有 `stripe_checkout` / `mock_checkout` 回退到公开常量**——而 `stripe_checkout` 恰是**默认 provider**。这一点必须写清，避免"支付验签整体不可信"的过度结论 | **【实测】** 见左列行号 | 统一为 fail-closed；补齐 Stripe 的真实验签密钥与时效校验 | 主理人【实测】 |
| **P0-3** | 安全 | `auth.ts:271-281,315-320,332-335` | **会话身份 fail-open**。`getSessionSecret()` 在 `SESSION_SECRET` 缺失或 <24 字符时返回 `undefined`，`readSessionCookieValue` 随即 `return sanitizeIdentity(value)` —— **直接采信未签名 cookie**；`signSessionCookieValue` 同样回退未签名值。客户端自设 `zv_member_id` 即可冒充任意用户读取命盘、报告与订单 | **【实测】** 逐行读 `src/auth.ts` 原文确认 | 无密钥必须 **fail-closed**（拒绝该 cookie 身份 + 启动期报错），禁止未签名回退 | 主理人【实测】/ 雷克斯【联审】 |
| **P0-4** | 数据 / 扩展性 | `store.ts:909-988`；`productRepository.ts:1609-1628`；`prisma/migrations/` | **双轨存储**：写入同时落 Prisma 与文件 store，但**同步读路径全部走文件 store**，异步写 `void ...Async` 无错误处理、无事务。同时 `prisma/migrations/` **仅 1 个迁移对 30 个模型**，`migrate dev` 基线不可用 → PostgreSQL 非真源且 schema 无法安全演进 | **【联审】** 阿奇给出行号；迁移目录实测 1 个【实测】 | 定单一真源并分阶段切换；补 baseline 迁移与迁移流程 | 阿奇 |
| **P0-5** | 数据 / 合规 | `prisma/schema.prisma` 全文 | **30 个模型零 `@relation`、零外键、无 `onDelete` 级联**，全部用裸字符串 `member_id`/`order_id` 关联 → 孤儿记录风险；**用户隐私删除需手工级联，遗漏即违反删除承诺**（个保法合规面） | **【实测】** Grep `@relation\|onDelete\|references` → **零命中** | 核心交易链（order→entitlement→report、chart→birthProfile→owner）补关系与删除语义；或显式记录「无关系」决策并加补偿作业 | 阿奇 |

> **本报告不再把 P0-5 标为成员评🔴/🟡的分歧项**：科迪未回传结论正文，其评级无从采信。主理人取🔴，理由不是技术复杂度，而是它使**隐私删除承诺无法被机械保证**，属合规风险而非纯技术债。

### 🟠 P1 高（15 项）

| # | 类别 | 位置 | 问题描述 | 建议修复 | 来源 |
|---|------|------|---------|---------|------|
| **P1-1** | 安全 | `auth.ts:126-131` | **IDOR fail-open，影响 8 个读取入口**：`assertCanReadChart` 首行 `if (!owner) return;` —— **owner 记录缺失或查询异常时放行**。实测全部调用点：`app/chart/[id]/page.tsx:45`、`app/chart/[id]/daily/page.tsx:44`、`api/interpret/route.ts:12`、`api/chart/[id]/route.ts:11`、`api/daily/theme/route.ts:11`、`api/report/draft/route.ts:11`、`reportAccess.ts:48,86`、`phase3/followUp.ts:54,118`（同步/异步两套并存）。**注意：本报告不主张存在"已知可绕过的 IDOR 攻击路径"**——是 fail-open 设计缺陷在 owner 缺失这一状态下打开缺口 | owner 缺失应抛 403；不得把「取不到」等同于「允许」 | 主理人【实测】Grep 全量调用点 |
| **P1-2** | 安全 / 资金 | `phase9/commerce.ts:385-420` | `markPartialRefund` 疑似**无累计退款上限**、且**退款后不回收权益** → 可反复部分退款 | 校验 Σrefunded ≤ amount 且幂等；退款联动权益回收 | 科迪【联审·中置信】 |
| **P1-3** | 正确性 | `phase9/commerce.ts:606-653` | **订单无状态机**：`applyPaymentEvent` 无条件覆写订单状态。`:631-639` 的 `canceled` 会把已 `fulfilled` 订单改写为 `cancelled`（且**不回收已发放的权益**）；`:641-649` 的 `failed` 同理。乱序/晚到事件即可破坏资金与权益一致性 | 引入终态与单调状态迁移；权益回收纳入状态机 | 主理人【实测】/ 雷克斯【联审】 |
| **P1-4** | 安全 | `apiSecurity.ts:43-51,126-131` | **Origin 缺失即放行**（CSRF 面）；**限流键匿名共享**（如 `anonymous:path`），未按 IP/身份分桶 → 单点可打满全局桶，亦可轮换未签名 header 绕过限流 | 敏感操作缺 Origin 应拒绝；改 IP+身份复合键；短信接口独立配额 | 雷克斯【联审】 |
| **P1-5** | 安全 / 成本 | `accountAuth.ts:34-72` | **短信发送无 per-phone 冷却与图形校验**，可跨 visitor 身份轰炸同一号码（成本滥用 + 账号爆破） | 号码级冷却 + 行为/图形校验 | 雷克斯【联审】 |
| **P1-6** | 性能 | `store.ts:909-1025` | **请求路径同步文件 IO**（`writeFileSync`/`renameSync` + `Atomics.wait` 忙等）**阻塞事件循环**；内存 Map 无界增长，`list`/`count` 走 `readdirSync` 全量 parse | 异步 IO 或改真源；加 TTL 与分页 | 阿奇【联审】 |
| **P1-7** | 扩展性 | `reporting.ts:234-258` | `ReportGenerationJob` 标记 `queued` 却**在请求内同步执行**，无 worker、无重试 → 长时 AI 任务阻塞请求 | 真异步队列 + worker + 重试策略 | 阿奇【联审】 |
| **P1-8** | 扩展性 | `ops/immersive/**`、限流桶、图表缓存 | 状态全在**进程内 Map** → 多实例失效、需粘性会话；`.../stream` 的「SSE」实为 **JSON 快照而非 event-stream** | 会话/限流/缓存外置 Redis（顺带修正 SSE 语义） | 阿奇【联审】 |
| **P1-9** | 安全 / 一致性 | `ops/**`（**实测 44 条 route.ts**）；`api-security.test.ts:181-185` | **写入期防护大面积缺失（本项为本次新增的实测发现）**：44 条 ops 路由中**仅 11 条调用 `readProtectedJson`**（即经过 `assertWriteRequestAllowed` 的 Origin 校验 + 限流），**其余 33 条绕过该防护**。抽查最高风险的资金写接口 `ops/order/[id]/refund/route.ts:12`，确认其使用裸 `await request.json()`、**既无 Origin 校验也无限流**，token 取自客户端 `x-admin-token` 头、角色取自 `x-admin-role` 头（默认 `support_agent`）。另：鉴权判定逻辑被**重复实现 4 处**（`launchOps.ts:1277`、`api.ts:830`、`app/internal/layout.tsx:26`、`ops/analytics/events/route.ts:18`）→ **改一处漏三处的漂移风险**；且大量路由把 `admin_role` 写入 query 参数再委派 → 角色信息落入访问日志。测试侧 `api-security.test.ts:181-185` 的**豁免名单**把 `ops/*`、`payment/webhook` 排除在结构扫描外 → 新增未鉴权 ops 写路由**不会报警** | 抽取**单一守卫函数**消除 4 处重复；ops 写路由**统一接入 Origin 校验与限流**；禁止 token/role 走 query；移除测试豁免名单 | 主理人【实测】Grep `readProtectedJson`（11/44）+ 读 refund 原文；泰莎【联审】豁免名单 |
| **P1-10** | 交付 | 仓库根 | **无 CI/CD、无 Dockerfile、无 IaC、无 `engines`、无环境分层**（唯一 `.env.local`）；且 **全仓仅 1 个 commit** → 发布不可重复、无法 bisect 回归、无法按提交精准回滚、无变更责任人可追溯 | 建 CI 流水线 + 镜像 + 环境分层 + 真实提交历史与 release tag | 阿奇/泰莎/雷克斯【联审】；commit 数【实测】 |
| **P1-11** | 可观测 | `observability.ts:95,112` | **`formatStructuredLog` / `evaluateOperationalAlerts` 仅被定义、从不被调用** → 无日志 emit、无告警推送、无 5xx/验签失败/登录失败/限流触发率指标。**事件发现完全依赖用户被动投诉** | 推 `OBS_LOG_SINK`；定时 `evaluateOperationalAlerts` 并 POST 告警 webhook；补最小告警集 | 雷克斯【联审】 |
| **P1-12** | 测试 | `vitest.config.ts:6`；`tests/comprehensive-ziwei-test.ts` | **综合引擎测试文件命名不符 `include` 的 `*.test.ts`，整份从未被执行**（静默漏跑），实测全量 79 文件中不含它 | 改名 `comprehensive-ziwei.test.ts` 或扩 `include` | 泰莎【联审+实测】 |
| **P1-13** | 测试 / 门禁 | `package.json:13` | `verify:public` 作为发布门禁**只跑 6 个单测 + 1 个 e2e（desktop）**，退款/对账/privacy/AI/小程序/渠道全部不在门禁内 | 门禁改跑全量 `npm test` + ≥5 e2e spec（desktop+mobile） | 泰莎【联审】 |
| **P1-14** | 文档 | 仓库根 `.env.example` | **`.env.example` 不存在**（实测 `Test-Path` = False），全仓无任何文档提及它，但 `.gitignore` 显式放行 `!.env.example` → 环境变量清单「承诺了但从未创建」。这直接放大 P0-1/P0-2/P0-3 的触发概率 | 由 README 生成占位模板（不含密钥）；**与启动期强校验配套** | 多库【实测】/ 雷克斯 |
| **P1-15** | 文档 | `deliverables/gstack/pre-launch-check-ziwei-2026-09-20.md` | 该报告 **4 项结论经实测被证伪**（详见 §6），却仍以「上线前检查报告」身份作为 Go/No-Go 依据 → 决策依据失真 | 首行加 `> ⚠️ SUPERSEDED` 横幅或降级 archive；**门禁只认复跑结果** | 多库【实测】/ 主理人 |

### 🟡 P2 中（18 项）

| # | 类别 | 位置 | 问题描述 | 建议修复 | 来源 |
|---|------|------|---------|---------|------|
| P2-1 | 安全 | `next.config.ts:11` | CSP `script-src` 含 `'unsafe-inline' 'unsafe-eval'` → 响应头齐全但**强度打折** | 改 nonce/hash 方案，移除 `unsafe-*` | 主理人【实测】 |
| P2-2 | 可维护性 | `schema.prisma:303-375` | `PaymentEvent`/`ProviderStatement`/`Refund` 三处**缩进与字段对齐错乱** | `npx prisma format` 规范化并纳入 CI 校验 | 主理人【实测】 |
| P2-3 | 测试 | `vitest.config.ts` | **未配置 coverage**（无 provider/thresholds，devDeps 无 `@vitest/coverage-*`）→ **覆盖率完全未量化** | 引入 coverage-v8 + 阈值（整体 lines/functions ≥70%，`src/api`、`phase9` ≥80%） | 泰莎【联审】 |
| P2-4 | 测试 | `src/app/api/**` 4 路由 | **零测试触达**：`launch/config`、`ops/entitlements`、`ops/payment-events`、`ops/order/[id]/note`（**写操作**，风险最高） | 各补正向 + 鉴权负向用例 | 泰莎【联审】 |
| P2-5 | 测试 | `tests/` | IDOR 仅点覆盖（order/chart/report/sandbox-confirm 各 1 条），**非 88 路由参数化「他人不可读」矩阵** | 建 owner/stranger/anonymous 三态参数化矩阵 | 泰莎【联审】 |
| P2-6 | 测试 | `playwright.config.ts:16-19`；`scripts/run-e2e.mjs:23` | 已定义 mobile(Pixel 7) project 但门禁**仅跑 `--project=desktop`**；且强制 `ZIWEI_E2E_STORE_TEST_DOUBLE=true`（非真实持久化） | 门禁加 mobile；关键路径跑一次真实 store | 泰莎【联审】 |
| P2-7 | 依赖 | `package.json:21-48` | 依赖**全部 `^` 浮动**、`overrides` 钉版、**未声明 `engines`**（Next 16 需 Node ≥20） | 关键依赖锁版本；补 `engines`；CI 加 `npm ci` + `npm audit` | 主理人【实测】package.json：无 `engines` 字段 |
| P2-8 | 可维护性 | `src/**` | 约 **67–69 个 tsx 仅 1 个 css**（两方计数略有差异），内联样式重复、无 design token | 抽主题变量与共享组件 | 多库/泰莎【联审】 |
| P2-9 | 架构 | `src/phase2..15/**`；`reporting.ts:5 ↔ launchOps.ts:9` | **phaseN 命名把「交付期」概念泄漏进领域模型**；存在 **phase8 ⇄ phase10 循环依赖** | 重命名领域目录（charts/commerce/ops/growth/ai…）并断环 | 阿奇【联审】 |
| P2-10 | 文档 | 仓库根 | 3 份测试报告并存且内容大量逐字重复（均 2026-09-15），**无权威声明** | 保留 1 份权威，其余移 `docs/archive/` | 多库【实测】 |
| P2-11 | 文档 | `README.md` | 缺快速开始 / 前置（Node 版本·PostgreSQL）/ 目录结构 / 分支与提交约定 / 贡献指南 / CHANGELOG 链接 | 补章节，正文只做导航不复制 | 多库【联审】 |
| P2-12 | 文档 | `docs/api/`（不存在） | **88 个路由无系统 API 参考** | 按域生成 `docs/api/`（请求/响应/错误码） | 多库【实测】 |
| P2-13 | 文档 | `docs/adr/`（不存在） | 无架构决策记录 → 关键取舍不可追溯 | 建 ADR 目录 + 模板（阿奇已备 5 条 ADR 提案） | 多库/阿奇 |
| P2-14 | 文档 | `CHANGELOG.md`（不存在） | 无版本变更轨迹 → 发布与回滚无据 | 建 Keep-a-Changelog 格式 | 多库【实测】 |
| P2-15 | 文档 | `docs/runbook/`（不存在） | 无步骤化事故手册；现有 `docs/生产部署与运维手册.md`（169 行）质量尚可但**非步骤化** | 从中抽出 runbook | 多库【实测】 |
| P2-16 | 可维护性 | `src/api.ts`（750 行巨型 if/else）；`src/server.ts` | **`server.ts` 的 `startServer` 全仓无调用 = 死代码**；路由分派为巨型条件链 | 删死代码；路由表化 | 阿奇【联审】 |
| P2-17 | 测试 | `tests/` | **生产身份链路未测**：大量路由经 `x-visitor-id`/`visitor_id` 注入身份，该分支仅在 `nodeEnv !== "production"` 生效 → **测试通过 ≠ 生产身份链路正确** | 补生产签名 cookie 身份用例、断言生产忽略伪造头 | 泰莎【联审】 |
| P2-18 | 集成 | 全局 | 生产真实集成**完全未验证**：DB / 支付 / 短信 / 微信 / AI 全程 mock 或 test-double | 建 staging 环境做真实集成与契约验证 | 泰莎【联审】 |

### 🟢 P3 低（6 项）

| # | 类别 | 位置 | 问题描述 | 建议修复 | 来源 |
|---|------|------|---------|---------|------|
| P3-1 | 安全 | `.env.local` | 早先报告称其含明文 DeepSeek Key；实测 **0 字节**，且 **git 无跟踪、无历史提交**（`git log --all -- .env.local` 为空）→ **无泄漏证据**，风险降级 | 仍建议轮换第三方 Key 作为廉价保险 | 主理人【实测】/ 多库【实测】 |
| P3-2 | 变更管理 | git 仓库 | **全仓仅 1 个 commit**（`git rev-list --count HEAD` = 1）→ 无法 bisect、无法精准回滚、无责任人可追溯 | 建立真实提交历史 + release tag + 部署配置快照 | 主理人【实测】/ 雷克斯 |
| P3-3 | 合规 | 仓库根 | 无 `LICENSE`、无 `SECURITY`（商业化产品缺合规件） | 补齐 | 多库【实测】 |
| P3-4 | 交付 | 根 / `deliverables/` / `output/` / `docs/` | 交付物四处散落，**无统一索引** | 建 `docs/README.md` 索引并约定权威树 | 多库 |
| P3-5 | 可维护性 | 全库 md | 无 frontmatter（owner / updated_at / status）→ 无法判断文档新鲜度 | 加 frontmatter 与 lint | 多库 |
| P3-6 | 边界 | `mini-program/app.js:3` | 小程序为 web-view 外壳调主站，**无业务重复**，仅 base URL 硬编码 | 配置化 base URL | 阿奇【联审】 |

---

## 2. 关键模块与依赖组件评估

### 2.1 关键模块风险热力

| 模块 | 职责 | 风险评级 | 核心问题 |
|------|------|---------|---------|
| `src/auth.ts` | 身份解析、会话签名、命盘权限 | 🔴 高 | fail-open × 2（cookie 验签、owner 校验） |
| `src/phase10/launchOps.ts` + `src/api.ts` | 运维后台鉴权与 20+ ops 接口 | 🔴 高 | 默认管理员令牌、角色客户端自报 |
| `src/phase9/commerce.ts` | 支付、退款、履约、权益 | 🔴 高 | stripe/mock 验签密钥回退公开常量、无订单状态机 |
| `src/store.ts` | 文件型持久化 | 🔴 高 | 同步 IO 阻塞、无界增长、双轨真源 |
| `src/repositories/productRepository.ts` | 生产仓储（≈3900 行） | 🟠 中高 | 职责过载、密码学内联 |
| `src/apiSecurity.ts` | Origin 校验与限流 | 🟠 中高 | Origin 缺失放行、限流键可绕过 |
| `src/observability.ts` | 日志、指标、告警 | 🟠 中高 | **函数从不被调用**（名存实亡） |
| 排盘引擎（`iztro` 封装）/ `src/interpret.ts` | 命盘计算与解读 | 🟢 低 | 本次未发现正确性缺陷 |
| 出生资料加密（`productRepository.ts:3888-3905`） | AES-256-GCM | 🟢 低 | **实现正确**（见 §6 澄清） |

### 2.2 依赖与供应链

- 依赖**版本策略薄弱**：全部 `^` 浮动区间 + `overrides` 强制钉版（postcss / nanoid / baseline-browser-mapping / deepmerge-ts），存在安装漂移与"隐式降级"风险。**【实测】** `package.json` 无 `engines` 字段。
- **`npm audit` 结果：【待复核】**（沙箱环境未执行）。**本报告不给出依赖漏洞数量结论**——先前的"1 low"未经本团队验证，故不采信。
- 因无 CI，`npm audit` **从未被自动执行**。

---

## 3. 架构影响评估

**总评**：功能面广（88 API + 31 页面 + 30 模型），但架构债集中在**数据层**，属"交付期驱动的原型"。

1. **双轨存储是头号结构性问题**（P0-4）：写路径双写、读路径走文件 store，导致 PostgreSQL 数据不可信、静默漂移且无事务边界。这是所有"数据不一致"类问题的共同上游。
2. **无迁移治理**：30 模型 / 1 迁移，schema 一旦演进即面临高风险操作。
3. **无集中守卫层**：不存在 `middleware.ts`，鉴权/限流/审计/可观测分散在 88 个路由各自实现，且已有约 10 个路由绕过统一分派 → 一致性无法机械保证。
4. **有状态单进程假设**：多实例即失效（限流、immersive 会话、缓存），SSE 语义亦不成立。
5. **交付工程化缺位**：无 CI/镜像/环境分层，叠加"仅 1 个 commit"，使发布既不可重复也不可回滚。

**阿奇提出的 5 条 ADR 提案**（建议进入 `docs/adr/`）：
- **ADR-1 单一数据源**：Postgres 为唯一写源，文件 store 降级为 dev/test double（权衡：需回填 + 双读过渡窗口）。
- **ADR-2 显式关系模型**：核心交易链加 `@relation` + 删除级联；若不改造，则显式记录决策并加补偿作业。
- **ADR-3 集中守卫层**：Next middleware + 统一 route 包装收口 Origin/限流/ops 鉴权/审计，**移除默认 admin token**。
- **ADR-4 领域化目录**：`phaseN` 重命名为领域目录，借机打破 phase8 ⇄ phase10 环依赖。
- **ADR-5 异步化与有状态外置**：报告生成入真队列 + worker；immersive/限流/会话移 Redis。

### 被推翻的假设（体现复核独立性）

| 原假设（来自任务书／既有报告） | 复核结论 | 证据 |
|---------------------|---------|------|
| "存在双 API 层重复实现" | **不成立**：88 个 `route.ts` 中约 77 个只是薄适配器，委派给同一个 `handleApiRequest`，非重复实现 | 阿奇【联审】 |
| "`server.ts` 是第二入口" | **部分不成立**：`startServer` 全仓无调用，属**死代码** | 阿奇【联审】 |
| "加密密钥派生为单轮 SHA-256、存在公开固定 fallback 密钥" | **证伪**：`productRepository.ts:3891,3904` 实为 `createCipheriv("aes-256-gcm", …)` + `scryptSync(configuredKey, salt, 32, {N: 16_384, r: 8, p: 1})`，随机 salt(16B) + 随机 IV(12B) + AAD + authTag；密钥未就绪即 `throw`，**无固定 fallback** | **主理人【实测】** 逐行读原文 |
| "存在 SQL 注入面" | **证伪**：全 `src/` 无 `$queryRaw` / `$executeRaw`，全部走 Prisma 参数化 | **主理人【实测】** Grep 零命中 |
| "`mini-program` 存在业务逻辑重复" | **不成立**：web-view 外壳，仅 base URL 硬编码 | 阿奇【联审】 |

---

## 4. 性能瓶颈

| # | 位置 | 瓶颈 | 影响 |
|---|------|------|------|
| 1 | `store.ts:909-1025` | 请求路径同步文件 IO + `Atomics.wait` 忙等 | 阻塞事件循环，吞吐上限低 |
| 2 | `store.ts` | 内存 Map 无界增长；`list`/`count` 全量 `readdirSync` + `JSON.parse` | 内存与延迟随数据量线性劣化 |
| 3 | `reporting.ts:234-258` | `ReportGenerationJob` 在请求内同步执行 | 长时 AI 任务占满请求线程 |
| 4 | `immersive`/限流/缓存 | 进程内 Map | 多实例失效，无法水平扩容 |
| 5 | `@mediapipe/tasks-vision` | AR 能力为大型客户端依赖 | 首屏 bundle 压力（**未量化**，建议动态导入） |

---

## 5. 测试覆盖评估

**实测基线（泰莎，高置信）**：`npx vitest run` → **79 文件 / 330 用例全部通过，EXIT=0，421s**。关键子集（api-security / commerce-identity-boundary / checkout-sandbox-confirm / privacy-deletion）15 用例通过。`hookTimeout` 已设 30s，测试 store 已隔离至 `tmpdir()/ziwei-phase-store/test-<pid>`（`store.ts:947-951`）→ **历史"文件累积导致 hook 超时"问题当前不复现**。

**结论：套件健康，但保护力不足。** 330 个用例全绿却漏掉 3 条 P0，原因有四：

1. **整份测试从未执行**（P1-12）：`tests/comprehensive-ziwei-test.ts` 因命名不匹配 `include` 而静默漏跑——最典型的"绿色幻觉"。
2. **门禁过窄**（P1-13）：`verify:public` 只跑 6 个文件，运维写路径（退款/对账/权益补发/删除审批）完全不在门禁内。
3. **结构扫描有豁免名单**（P1-9）：`api-security.test.ts:181-185` 豁免了 `ops/*` 与 `payment/webhook`，恰好是最需要保护的两个区域 → 新增未鉴权 ops 写路由不会报警。
4. **测试只在快乐路径运行**：fail-open 分支（密钥缺失/过短）缺乏负向断言，故 **CI 永远不会发现 fail-open 回归**。

**覆盖率：完全未量化**（未配置 coverage provider/thresholds）——本报告不对覆盖率给任何数字。

### 覆盖缺口矩阵

| 类别 | 状态 |
|------|------|
| 完全零触达路由（4 条） | `launch/config`、`ops/entitlements`、`ops/payment-events`、`ops/order/[id]/note`（写，风险最高） |
| 入口层无直测（运维后台类） | `ops/ai-generations`、`ops/content-reviews` 等——业务逻辑有测，但 route 层**入口鉴权（header vs query）未直测** |
| 高覆盖（对照，做得好的） | privacy 删除（负向 + subject 绑定 + 二次确认，**强**）、支付 webhook 重放幂等、IDOR（order/chart/report） |
| 高风险弱项 | 支付**并发**（同 session 同时 confirm）、**乱序 webhook**、**退款回调重复**——均无并发类测试 |

### 测试策略建议

- **分层**：单测（纯函数/引擎口径）→ 集成（route 层含鉴权负向）→ 契约（支付/短信 provider）→ E2E（desktop + mobile 关键路径）。当前"引擎+组件"层较厚，**route 鉴权层与并发层最薄**。
- **目标**：整体 lines/functions ≥70%；`src/api`、`phase9` ≥80%；**所有 fail-closed 分支必须有负向断言**。

---

## 6. 对既有报告的复核结论（重要）

同日早先的《紫微星垣 · 上线前全量检查报告》（`deliverables/gstack/pre-launch-check-ziwei-2026-09-20.md`，判「条件 Go」）经本团队逐条复核，**4 项结论被实测证伪、1 项含误判**：

| 既有报告结论 | 复核结果 | 证据 |
|-------------|---------|------|
| ①「`next.config.ts`（4 行）缺安全响应头」 | **证伪** | 当前已完整配置 CSP / HSTS / nosniff / X-Frame-Options / Referrer-Policy / Permissions-Policy + `poweredByHeader:false`（`next.config.ts:6-19`）**【实测】** |
| ②「`npm run typecheck` 硬失败，4 处 TS2532（P0 阻塞）」 | **证伪** | 主理人实测 `npm run typecheck` → **EXIT=0，零错误**；相关断言现均用可选链 `?.` **【实测】** |
| ③「`data/phase-store` 累积 52,327 个 JSON 文件（P0 阻塞）」 | **证伪** | 实测该目录**不存在**，`data/` 递归仅 29 文件 **【实测】** |
| ④「`.env.local:1` 有明文 DeepSeek Key，需立即轮换」 | **证伪（风险降级）** | 实测该文件 **0 字节**；`git ls-files` 无 `.env*` 被跟踪、`git log --all -- .env.local` 为空 → **无泄漏证据** **【实测】** |
| ⑤「加密密钥派生为单轮 SHA-256 + 固定 fallback 密钥」 | **证伪（属误判）** | 实为 `scryptSync(N=16_384)` + 无 fallback + 未配密钥即抛错（`productRepository.ts:3891-3905`）**【实测】** |

**该报告同时漏掉了本次的 3 条 P0**：它检查了验签**算法**本身（并正确判定微信 RSA / 阿里 RSA2 / Stripe HMAC 的实现无误），却未检查**密钥来源的回退模式**（`env || 固定常量`）与 **provider 可选性**，因此得出「支付验签实现质量高、0 Critical」的结论，进而判「条件 Go」——**该判定不成立**。

**根因**：报告未标注 commit SHA 与执行命令，且未在代码变更后重跑，导致"结论与代码脱钩"。这正是 P1-15 与多库「权威来源约定」要解决的问题：**结论型报告必须绑定 commit SHA + 执行命令 + 时间戳，冲突时以代码与复跑为准。**

---

## ✅ 行动清单（按优先级排序）

### P0 — 立即（24 小时内，与事故响应联动）

| # | 行动 | 负责角色 | 紧急度 | 预期完成 |
|---|------|---------|--------|---------|
| 1 | **运维后台**：删除 `phase10_admin_token` 默认值（`launchOps.ts:144`）；无 `PHASE10_ADMIN_TOKEN` 时启动即失败；禁止 query 传 token；role/actor 由服务端确定而非 `x-admin-role` 头；开启 MFA | 后端/安全 | **P0** | 立即 |
| 2 | **支付**：移除 webhook 全部默认密钥常量（`commerce.ts:37-38,951,984`），缺密钥直接 503；provider 强白名单、禁止客户端自选（`webhook/route.ts:50`）；补订单状态机与乱序/幂等守卫（`commerce.ts:606-653`） | 后端/安全 | **P0** | 立即 |
| 3 | **会话**：`SESSION_SECRET` 缺失或 <24 字符时 fail-closed（拒绝 cookie 身份 + 启动报错），移除未签名回退（`auth.ts:271-281,315-335`） | 后端/安全 | **P0** | 立即 |
| 4 | **IDOR**：`assertCanReadChart` 的 `!owner` 分支改抛 403（`auth.ts:126-131`）；核实退款累计上限与权益回收 | 后端 | **P0** | 立即 |
| 5 | **止损配套**：网关层临时封禁 `/api/ops/*` 与 `/payment/webhook` 外网直连；排查 `audit_logs`/`ops_actions` 异常 actor | SRE | **P0** | 立即 |
| 6 | **轮换** DeepSeek 等第三方 Key（廉价保险，虽无泄漏证据） | 安全 | **P0** | 立即 |

### P1 — 首轮放量前

| # | 行动 | 负责角色 | 紧急度 | 预期完成 |
|---|------|---------|--------|---------|
| 7 | 接线可观测：`formatStructuredLog` → `OBS_LOG_SINK`；定时 `evaluateOperationalAlerts` → 告警 webhook；补 6 条最小告警（ops 鉴权失败、webhook 验签失败、provider 分布异常、entitlement_gap>0、5xx>2%、登录失败激增） | SRE/后端 | P1 | 首轮放量前 |
| 8 | 修复漏跑测试文件命名并确认其出现在输出 | QA | P1 | 首轮放量前 |
| 9 | `verify:public` 门禁改跑全量 `npm test` + ≥5 e2e spec（desktop+mobile） | QA/工程 | P1 | 首轮放量前 |
| 10 | 移除 `api-security.test.ts` 对 `ops/*`/`payment/webhook` 的豁免，改「ops 写路由必须引用 admin 鉴权」结构断言 | QA/安全 | P1 | 首轮放量前 |
| 11 | 补 fail-closed 负向用例：密钥缺失/过短、伪造 webhook、provider 自选、未授权 ops 访问 | QA/安全 | P1 | 首轮放量前 |
| 12 | 建 CI 流水线（`npm ci` + typecheck + 全量测试 + `npm audit` + `prisma validate`）与 Dockerfile；补 `engines` | 工程 | P1 | 首轮放量前 |
| 13 | 创建 `.env.example`（占位、不含密钥）并建立启动期环境变量强校验 | 工程/文档 | P1 | 首轮放量前 |

### P2 — 放量后首迭代

| # | 行动 | 负责角色 | 紧急度 | 预期完成 |
|---|------|---------|--------|---------|
| 14 | 定单一数据源（ADR-1）：文件 store 降级为 dev/test double，补 baseline 迁移（ADR-2） | 架构/后端 | P2 | 放量后首迭代 |
| 15 | 引入 coverage provider + 阈值；建 IDOR 参数化矩阵与支付并发/乱序用例 | QA | P2 | 放量后首迭代 |
| 16 | CSP 去 `unsafe-inline`/`unsafe-eval`（改 nonce/hash） | 工程 | P2 | 放量后首迭代 |
| 17 | 拆分 `productRepository.ts`（≈3900 行）与 `api.ts` 巨型分派；删除 `server.ts` 死代码 | 工程 | P2 | 放量后首迭代 |
| 18 | 文档治理：给既有报告加 `SUPERSEDED` 横幅并降级 archive；建 `docs/{adr,api,runbook,architecture,release}` 与 CHANGELOG；补 README | 文档/工程 | P2 | 放量后首迭代 |

---

## ⚠️ 待完善 / 已知局限

1. **未连接生产环境**：本次为静态审查 + 本地只读实测。生产实际环境变量（`SESSION_SECRET`/`PHASE10_ADMIN_TOKEN`/webhook 密钥是否已配置）**未能读取**（遵从密钥保护禁令）。**P0-1/P0-2/P0-3 的可利用性取决于运行时配置**；雷克斯已按"默认视为已触发"处理（详见事故响应报告），**生产侧以证据反证已配置即可降级**。
2. **科迪的结论正文未送达**：其任务已完成但结构化产出两次均未送达，**本报告未采信任何未署名的科迪结论**；所有 🔴 项与关键 P1 项（IDOR 调用点、ops 防护覆盖）已由主理人独立实证。仍标注【待复核】的条目：**P1-2 退款累计上限**、**`npm audit` 依赖漏洞面**（本报告不给出依赖漏洞数量结论）。
3. **覆盖率未量化**：未配置 coverage provider，本报告**不含任何覆盖率百分比**。
4. **未执行 `npm run build` 与全量 E2E**：本轮聚焦代码与测试逻辑。
5. **真实集成未验证**：DB / 支付 / 短信 / 微信 / AI 全程 mock。
6. **循环依赖与守卫覆盖**为静态推断，未用工具做依赖图复核。
7. **`docs/` 70+ 文档仅抽样 4 份比对**，未逐份核查矛盾。
8. **本次不等同于渗透测试**：未做真实攻击验证，P0 结论基于代码路径可证性。
9. **未修改任何源文件**：全部成员均为只读审查，本报告不含代码改动。

---

## 📚 数据来源 & 成员产出索引

| 成员 | 负责维度 | 关键产出 |
|------|---------|---------|
| **阿奇**（系统架构师） | 分层 / 模块边界 / 数据架构 / 扩展性 / 交付工程化 | 13 项架构问题（3 项🔴 集中于数据层）；5 条 ADR 提案；推翻"双 API 层""server.ts 第二入口" |
| **泰莎**（测试专家） | 覆盖 / 门禁 / 稳定性 / 策略 | 全量实测 **79 文件/330 用例全绿**；10 项测试问题；覆盖缺口矩阵；8 条补齐计划 |
| **多库**（技术文档师） | 文档债 / 权威来源 / Postmortem 模板 | 15 项文档债；5 条权威来源约定；建议目录结构；Postmortem 模板；实测证伪 gstack 4 项结论 |
| **雷克斯**（SRE 工程师） | 事件分诊 / 止损 / 根因 / 可运维性 | 9 个事件候选与 SEV 定级（含 C-8）；5 Why 根因链；恢复 4 阶段；Go/No-Go 与回滚方案；可观测性缺口 |
| **科迪**（代码审查师） | 安全 / 正确性 / 性能 / 依赖 | ⚠️ **任务已完成但结论正文两次均未送达主理人**；其负责的维度已由主理人第一手复核替代（见下行），其余无法独立验证的部分标注【待复核】 |
| **主理人**（甄宇航） | 编排 / 第一手实证 / 汇编 | 实测 `typecheck` EXIT=0；实测 `data/phase-store` 不存在；实测 git 跟踪与 commit 数（=1）；实测 `scryptSync`/`aes-256-gcm`/无 raw SQL；实测默认令牌 4 处判等；实测验签回退常量与 provider 自选；实测订单无状态机；实测 schema 零关系；**Grep 全量 `assertCanReadChart` 调用点（8 入口）**；**Grep `readProtectedJson` 得 11/44 ops 路由覆盖**；统一严重度裁量 |

**关键实测命令与产物**：
- `npm run typecheck` → `output/_typecheck.txt`（**EXIT=0**）
- `npx vitest run --reporter=dot` → `output/_tessa_full2.txt`（79 文件 / 330 用例 / EXIT=0 / 421s）
- `git rev-parse` / `git ls-files | grep env` / `git log --all -- .env.local` / `git rev-list --count HEAD` → `output/_gitcheck.txt`
- Grep 证据：`phase10_admin_token`（含 `launchOps.ts:144,1277`、`api.ts:830`、`layout.tsx:26`）、`WEBHOOK_SECRET`（含 `commerce.ts:37-38,951,984`）、`@relation|onDelete`（schema 零命中）、`$queryRaw|scryptSync|createCipheriv`
- 各成员中间产物：`output/_archi*.txt`、`output/_tessa*.txt`、`output/_docu*.txt`、`output/_rex*.txt`

> 配套交付：事故响应全流程见同目录 `incident-security-triage-ziwei-2026-09-20.md`

---

> 本报告由工程保障团队 AI 协作生成，关键决策请由人类工程负责人复核。
