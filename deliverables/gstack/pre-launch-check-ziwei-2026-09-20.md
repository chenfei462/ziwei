> ⚠️ SUPERSEDED — This report is retained for historical traceability only. Its Go/No-Go conclusions were invalidated by the engineering assurance review dated 2026-09-20. Release decisions must use fresh verification from the current commit.

# 紫微星垣 · 上线前全量检查报告

**日期**：2026-09-20
**场景**：上线前检查（代码审查 + 安全审计 + QA 测试）
**参与成员**：产品评审员（代码审查）+ 安全官（OWASP/STRIDE 审计）+ 质量门神（QA 测试与发布验证）
**项目**：`ziwei-interactive-chart-engine` v0.1.0（Next.js 16 App Router / React 19 / TypeScript 5.9 / Prisma 6 / PostgreSQL）

---

## 📌 TL;DR（执行摘要）

- **整体结论**：🟡 **有条件通过（条件 Go）** — 架构与安全底座扎实，无可直接远程利用的严重漏洞，但存在 **2 项上线阻塞**。
- **阻塞项数量**：**2 项**（typecheck 硬失败；测试基础设施导致 9 个测试文件失败、回归信号不可信）
- **安全**：0 Critical / 2 High / 4 Medium — 支付验签、身份签名、出生资料加密实现质量高。
- **下一步**：修复 2 项阻塞 + 轮换已泄露 API Key 后重跑全量验证；F-01/F-02 建议首次放量前修复。

---

## 🎯 核心结论卡片

| 项目 | 内容 |
|------|------|
| **Go / No-Go** | 🟡 **条件 Go**（修复 2 项阻塞后可 Go） |
| **严重度分布** | 🔴 2 / 🟠 4 / 🟡 7 / 🟢 3 |
| **关键行动项** | 9 条（P0 × 4、P1 × 3、P2 × 2） |
| **建议负责人** | 工程负责人（阻塞项）+ 安全负责人（密钥轮换、限流）|
| **测试通过率** | 95.4%（314/329 通过，9 个文件失败） |
| **安全问题** | 0 Critical，无远程可利用高危漏洞 |

---

## 1. 各成员核心结论

### 🔍 产品评审员（代码审查）

- **核心判断**：**架构分层清晰、资金与状态机逻辑严谨，未发现逻辑正确性缺陷或数据一致性漏洞**。退款金额校验（`commerce.ts:393`）、生产支付门禁、webhook 三 provider 验签均实现正确。
- **关键建议**：主要债务在**可维护性**——`productRepository.ts` 单文件近 3 900 行且内联了密码学逻辑（`encryptBirthProfileField`），建议拆分聚合并抽取 `src/crypto/` 独立模块；`clearPersistentBucket` 为同步递归删除且数据无界增长，构成性能缺陷。

### 🛡️ 安全官（OWASP + STRIDE）

- **核心判断**：**核心安全架构实现质量高于同类项目平均水平**——生产环境仅信任签名 cookie、HMAC + `timingSafeEqual` 常量时间比较、微信 RSA-SHA256 + 平台证书序列号 + 5 分钟时间窗、出生资料 AES-256-GCM 随机 IV + AAD + authTag，全部 fail-closed。**0 个 Critical、无直接可远程利用漏洞**。
- **关键建议**：2 项 High 需重视——① `apiSecurity.ts:125` 限流键采信**未签名的客户端 header**（`x-visitor-id`/`x-member-id`），可被轮换绕过限流，叠加 Android 短信接口存在轰炸/爆破风险；② 加密密钥派生仅单轮 SHA-256（无 KDF 加盐），且存在公开固定的 fallback 测试密钥。另有 `.env.local` 明文 DeepSeek Key 需**立即轮换**。

### ✅ 质量门神（QA 测试与发布）

- **核心判断**：**测试通过率 95.4%，但 `npm run typecheck` 硬失败，且 9 个测试文件整体失败使回归信号不可信**。
- **关键建议**：13 个失败用例的**共同根因是 `data/phase-store` 目录已累积 52 327 个 JSON 文件**（含 3 000+ 个 `test-<pid>` 残留），`beforeEach` 同步递归清理超过 vitest 默认 10 秒 `hookTimeout`。唯一真实断言失败（`production-foundation.test.ts:201`）经核实是**测试断言过时**——升级接口已正确拒绝客户端自选 `member_id`，属安全加固后的预期行为，非产品缺陷。

---

## 2. 综合审查发现（按严重度排序）

| # | 严重度 | 类别 | 位置 | 问题描述 | 建议 | 来源 |
|---|--------|------|------|---------|------|------|
| 1 | 🔴 | QA/CI | `tests/comprehensive-ziwei-test.ts:552,554,571,572` | **typecheck 硬失败**：4 处 TS2532 `Object is possibly 'undefined'`，阻塞 `verify:public` 与 CI 首道门禁 | 补空值断言或 `.at()` 后校验 | 质量门神 |
| 2 | 🔴 | QA/CI | `data/phase-store/`（52 327 文件）+ `src/store.ts:935` | **9 个测试文件失败**（13 用例 `Hook timed out 10000ms`）：同步递归清理海量文件超时 | 清理残留 + 隔离临时目录 + 设 `hookTimeout:30_000` | 质量门神 |
| 3 | 🟠 | 安全 | `src/apiSecurity.ts:125-130` | **限流键采信未签名的 `x-visitor-id`/`x-member-id`**，攻击者可轮换 header 绕过限流（`Origin` 缺失时还直接放行） | 改用服务端可信标识分桶；短信接口独立配额 | 安全官 |
| 4 | 🟠 | 安全 | `src/repositories/productRepository.ts:3903` | **加密密钥派生无 KDF**：单轮 SHA-256，弱口令可离线爆破；fallback 为公开固定字符串 | 改 `scryptSync` + salt 随密文存储；移除 fallback | 安全官 |
| 5 | 🟠 | 代码质量 | `src/repositories/productRepository.ts`（≈3 900 行） | **单文件职责过载**，密码学逻辑内联于仓储层，`as unknown as` 双重断言绕过类型 | 按聚合根拆分；抽取 `src/crypto/` 模块 | 产品评审员 |
| 6 | 🟠 | 代码质量 | `src/store.ts:923-933, 935-940` | **同步阻塞 + 无界增长**：`readdirSync`+逐文件 `JSON.parse`；`clearPersistentBucket` 同步递归删除 | 改异步/临时目录；长期生产强制 PostgreSQL | 产品评审员 |
| 7 | 🟡 | 安全 | `.env.local:1` | **明文 DeepSeek API Key**（`sk-6efd29...`）；`.gitignore` 已忽略但密钥已落盘 | **立即吊销并轮换**；核查 git 历史 | 安全官 |
| 8 | 🟡 | 安全 | `src/auth.ts:16-17` 相关 ops 接口 | 敏感操作仅校验 `second_confirmed` 布尔值，缺服务端状态绑定 | 引入二次会话确认或绑定 `ticket_id` | 安全官 |
| 9 | 🟡 | 安全 | `next.config.ts`（4 行） | **缺安全响应头**（HSTS/CSP/X-Frame-Options/nosniff/Referrer-Policy），`X-Powered-By` 暴露 | 补 `headers()` 或由网关补齐 | 安全官 |
| 10 | 🟡 | 合规 | `src/phase3/deepseekClient.ts`、`followUp.ts` | AI 输出合规过滤与追问额度扣减**原子性**未验证（文件 store 存在竞态窗口） | 增加输出侧确定性过滤；额度改原子扣减 | 产品评审员 |
| 11 | 🟡 | 供应链 | `package.json:21-45` | 依赖全部 `^` 区间；未执行 `npm audit`；含 `overrides` | CI 用 `npm ci`；增加 `npm audit` 卡点 | 产品评审员+安全官 |
| 12 | 🟡 | 测试 | `tests/production-foundation.test.ts:201` | **断言过时**：期望服务端采纳客户端 `member_id`，但服务端已正确拒绝（安全加固） | 更新断言以匹配安全加固行为 | 质量门神 |
| 13 | 🟡 | 测试 | `tests/` vs `e2e/` | **覆盖缺口**：越权拒绝（IDOR）未系统覆盖 88 路由；支付并发幂等、退款回调、Redis 限流路径缺测 | 补 IDOR 参数化测试 + 并发用例 | 质量门神 |
| 14 | 🟢 | 兼容性 | `playwright.config.ts` | E2E **仅 desktop project**，无移动端 viewport | 增 mobile project | 质量门神 |
| 15 | 🟢 | 兼容性 | `package.json` | **未声明 `engines`**；Next 16 需 Node ≥ 20 | 补 `engines` + CI 版本校验 | 质量门神 |
| 16 | 🟢 | 代码质量 | `src/app/**/*.tsx` | 67 个 tsx 仅 1 个 `.css`，疑存内联样式重复 | 抽 design token 与共享组件 | 产品评审员 |

---

## 3. 阻塞项清单（Blockers，必须修复才能 Go）

| # | 阻塞项 | 判定依据 | 修复动作 | 验收标准 |
|---|--------|---------|---------|---------|
| B-1 | `npm run typecheck` 失败 | 4 处 TS2532，`verify:public` 第一道门禁直接失败 | 修 `tests/comprehensive-ziwei-test.ts:552/554/571/572` 空值处理 | `npm run typecheck` 零错误退出 |
| B-2 | 全量测试不可信 | 9 文件失败 / 13 用例 hook 超时，掩盖真实回归 | 清理 `data/phase-store` 残留；测试 store 指向 `os.tmpdir()`；设 `hookTimeout`；更新过时断言 | `npm test` 100% 通过（329/329） |

**附加建议阻塞（安全，建议同批处理）**：轮换 `.env.local` 中的 DeepSeek API Key（F-06）。

---

## 4. 上线就绪配置检查

| 配置 | 用途 | 缺失后果 |
|------|------|---------|
| `DATABASE_URL` | PostgreSQL 生产主库 | 🔴 repository 失败关闭，产品不可用 |
| `ZIWEI_BIRTH_DATA_ENCRYPTION_KEY` | 出生资料 AES-256-GCM | 🔴 不得开放生产建盘 |
| `PHASE10_ADMIN_TOKEN` + MFA | 后台门禁 | 🔴 后台失去保护 |
| `SESSION_SECRET`（≥24 字符） | 会话 cookie 签名 | 🟠 cookie 不签名 |
| `ZIWEI_RATE_LIMIT_REDIS_REQUIRED` + URL/TOKEN | 生产限流 | 🟠 写接口失败关闭 |
| `OBS_*`（LOG_SINK/METRICS/ALERT_WEBHOOK） | 可观测 | 🟠 不得上线 |
| `SMS_PROVIDER=http_sms` + 网关密钥 | 短信登录 | 🟠 `mock_sms` 禁止生产 |
| `WECHAT_PAY_*` / `ALIPAY_*` | 真实支付 | 🟡 仅沙箱可用 |
| `ZIWEI_EXPORT_STORAGE_*` | 导出对象存储 | 🟡 导出不可用 |

> 所有 readiness 均通过 `/api/launch/config` 暴露，**上线前应逐一核对为 ready**。

---

## 5. 回滚预案

| 层级 | 回滚手段 | 触发条件 |
|------|---------|---------|
| 支付 | `PHASE10_PAYMENT_ROLLBACK=true` 强制回退 sandbox | 支付成功率异常 / 验签失败告警激增 |
| 支付放量 | `PHASE10_PAYMENT_ROLLOUT_PERCENT` 调回 0 | 资金异常 |
| 结算 | `ZIWEI_ENABLE_SANDBOX_CHECKOUT_CONFIRM` 保持生产关闭 | 权益误发 |
| 渠道 | `ZIWEI_DISABLED_CHANNELS` 暂停问题渠道 | 渠道风控 |
| 数据 | `DATABASE_URL` 主库回切 + Prisma migrate 回滚 | 数据损坏 |
| 部署 | 保留上一版本产物（`next build` 输出）可秒级回切 | 5xx 激增 |

---

## ✅ 行动清单

| # | 行动 | 负责方 | 紧急度 | 期望完成 |
|---|------|--------|--------|---------|
| 1 | 修复 `tests/comprehensive-ziwei-test.ts` 4 处 TS2532，恢复 typecheck 通过 | 前端/工程 | **P0** | 放行前 |
| 2 | 清理 `data/phase-store` 残留（3 000+ 目录），测试 store 隔离至临时目录 + 配置 `hookTimeout` | 工程 | **P0** | 放行前 |
| 3 | 更新 `production-foundation.test.ts:201` 过时断言，重跑 `npm test` 至 329/329 | 工程 | **P0** | 放行前 |
| 4 | **吊销并轮换** `.env.local` 中 DeepSeek API Key，核查 git 历史无泄漏 | 安全/工程 | **P0** | 立即 |
| 5 | 限流键改用服务端可信标识分桶；短信/登录接口增加独立配额 | 安全 | P1 | 首轮放量前 |
| 6 | 加密密钥派生改 `scryptSync` + 随机 salt；移除固定 fallback | 安全 | P1 | 首轮放量前 |
| 7 | `next.config.ts` 补安全响应头 + `poweredByHeader:false` | 工程 | P1 | 首轮放量前 |
| 8 | 拆分 `productRepository.ts`，抽取 `src/crypto/birthDataEncryption.ts` 并补单测 | 工程 | P2 | 放量后首迭代 |
| 9 | 补 IDOR 参数化越权测试矩阵 + 支付并发幂等/退款回调测试；CI 增 `npm ci` + `npm audit` | QA/工程 | P2 | 放量后首迭代 |

---

## ⚠️ 待完善 / 已知局限

- 本次**未执行 `npm run build` 与 `npm run test:e2e`**：typecheck 失败构成前置阻塞，构建与 E2E 应在 B-1/B-2 修复后补跑。
- **未执行 `npm audit`**：依赖漏洞面（A06）尚未量化，建议 CI 补充。
- 真实支付、短信、微信真机、小程序真机联调**均未在本环境验证**（属外部依赖）。
- 限流绕过风险（F-01）的实际可利用性依赖生产是否配置 Redis 强制开关；已配置 `ZIWEI_RATE_LIMIT_REDIS_REQUIRED=true` 时影响仍存在（键仍来自伪造 header）。
- 本报告基于静态代码审查与本地测试执行，**不等同于渗透测试**。

---

## 📚 成员产出索引

- 产品评审员（代码审查）原始产出：`deliverables/gstack/_raw/code-review.md`
- 安全官（OWASP+STRIDE 审计）原始产出：`deliverables/gstack/_raw/security-audit.md`
- 质量门神（QA 测试与发布）原始产出：`deliverables/gstack/_raw/qa-test.md`

---

> 本报告由软件工坊 AI 协作生成，关键决策请由工程负责人复核。
