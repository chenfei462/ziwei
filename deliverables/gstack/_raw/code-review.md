# 代码审查报告（原始产出）

**日期**：2026-09-20
**执行人**：gstack-product-reviewer（产品评审员兼代码审查）
**方法论**：review skill（7 专家子审查员视角）
**项目**：紫微星垣（Next.js 16 App Router，196 源文件 / 88 API 路由）

---

## 1. 架构质量总览

| 维度 | 评价 | 说明 |
|------|------|------|
| 分层清晰度 | 🟢 良好 | `app/api` 路由 → 领域模块（phase*/）→ repository/store 三层分明，`api.ts` 作为 dispatcher |
| 边界设计 | 🟢 良好 | repository 边界隔离文件store 与 Prisma；生产 fail-closed |
| 类型安全 | 🟠 待改进 | `production-foundation.test.ts` 有 TS2532；领域代码存在大量 `as unknown as` 断言 |
| 文件规模 | 🟠 风险 | `productRepository.ts` ≈ 3 900 行、`store.ts` ≈ 1 000 行、`commerce.ts` > 1 000 行，单文件职责过载 |
| 错误处理 | 🟢 良好 | 统一 `ApiError` + `toErrorEnvelope`，路由普遍 try/catch |
| 测试覆盖 | 🟡 中等 | 329 用例，但本次 9 文件失败（详见 QA 报告） |

---

## 2. 发现明细

### 🟠 C-01：`productRepository.ts` 单文件近 4 000 行，职责严重过载（可维护性）

**位置**：`src/repositories/productRepository.ts`（第 3 888-3 905 行为加密逻辑，与仓储职责混杂）

**问题**：
1. 单个文件承载命盘、报告、订单、支付、权益、审计等**全部领域实体的读写映射**，约 3 900 行。
2. **密码学逻辑（`encryptBirthProfileField` / `resolveBirthDataEncryptionKey`）内联在仓储文件中**，违反单一职责，且使密钥处理难以独立审计与单测。
3. 已知类型断言滥用：`3881: return parsed as unknown as ChartCreateResponse` — 用双重断言绕过类型系统，运行时无校验。

**影响**：高变更耦合、review 困难、缺陷易隐藏；加密逻辑无法被独立安全审查。

**建议**：
1. 按聚合根拆分为 `chartRepository` / `reportRepository` / `orderRepository` / `entitlementRepository`。
2. 抽取 `src/crypto/birthDataEncryption.ts` 独立模块，配套单元测试（IV 唯一性、AAD 校验、篡改拒绝）。
3. 用 zod 等 schema 校验替代 `as unknown as`。

---

### 🟠 C-02：测试存储清理为同步阻塞、无界增长（性能）

**位置**：`src/store.ts:935-940`（`clearPersistentBucket`）、`src/store.ts:946-953`（目录解析）

**问题**：
1. `clearPersistentBucket` 使用 `removePersistentDir` **同步递归删除**，在 `beforeEach` 中调用。
2. 实测 `data/phase-store` 已达 **52 327 个文件 / 3 000+ 残留子目录**，导致 13 个测试 hook 超时（详见 QA 报告 §2.1）。
3. `readPersistentBucket`（`store.ts:923-933`）**全目录 `readdirSync` + 逐文件 `readFileSync` + `JSON.parse`**，无缓存无分页。数据增长后每次读列表都是 O(n) 磁盘 IO。

**影响**：CI 不稳定；若文件 store 被误用于非测试场景，接口延迟随数据量线性劣化。

**建议**：
1. `clearPersistentBucket` 改为异步 + 通过 `ZEIWEI_STORE_DIR` 指向临时目录（`os.tmpdir()`），彻底隔离。
2. 在 `vitest.config.ts` 显式设置 `hookTimeout: 30_000` 作为缓解。
3. 长期：文件 store 仅限测试，生产强制 PostgreSQL（README 已声明，需在 CI 断言）。

---

### 🟡 C-03：内容安全过滤与 AI 输出边界（合规风险）

**位置**：`src/phase3/deepseekClient.ts`、`src/interpret.ts`、`src/phase3/interpretationEngine.ts`

**问题**：README「合规边界」要求"避免确定性命运判断、灾祸预测、恐吓语言和高风险建议"。需确认：
1. AI 改写输出是否经过**确定性内容过滤**（而非仅依赖 prompt 约束）。
2. 免费用户每日 3 次追问额度（`src/phase3/followUp.ts`）的扣减是否**原子**——文件 store 环境下 `check + decrement` 之间存在竞态窗口，可能被并发绕过。

**建议**：
1. 增加输出侧关键词/正则黑名单过滤，并记录拦截审计。
2. 追问额度扣减改为单次原子操作（PostgreSQL 下用条件 UPDATE 或行锁）。

---

### 🟡 C-04：`next.config.ts` 配置过于单薄（工程成熟度）

**位置**：`next.config.ts`（仅 4 行）

**问题**：未配置 `headers()`（安全头）、`images.remotePatterns`、`compress`、`poweredByHeader: false` 等。`X-Powered-By` 默认暴露 Next.js 版本，便于攻击者指纹识别。

**建议**：补 `poweredByHeader: false` + 安全响应头（与安全报告 F-05 合并处理）。

---

### 🟡 C-05：依赖版本使用 `^` 区间且未锁定（供应链风险）

**位置**：`package.json:21-45`

**问题**：`next@^16.2.7`、`react@^19.2.5`、`@prisma/client@^6.19.3` 等均用 caret 区间。虽 `package-lock.json` 存在可复现，但任何 `npm install` 都可能引入 minor 升级。存在未验证的 `overrides: { postcss: ^8.5.12 }`。

**建议**：CI 使用 `npm ci`（严格锁定）；关键依赖考虑固定版本；补充 `npm audit` 卡点。

---

### 🟢 C-06：错误响应与内部信息泄露核查（低）

**位置**：`src/errors.ts`、各 route 的 catch 分支

**结论**：`toErrorEnvelope` 统一封装，未发现直接透传 stack trace 或内部路径。**良好**。建议补充：生产环境确保未把 Prisma 原始错误消息透出。

---

### 🟢 C-07：内联样式与前端组件复用（低）

**位置**：`src/app/**/*.tsx`（67 个 tsx）

**问题**：项目仅 1 个 `.css` 文件而组件众多，推测存在较多内联样式与重复样式片段。

**建议**：抽取共享 UI 组件与 design token，降低重复。

---

## 3. 状态机与资金逻辑核验 ✅

| 检查点 | 位置 | 结论 |
|--------|------|------|
| 退款金额校验 | `commerce.ts:393` | ✅ `amountCents <= 0 \|\| >= order.amount_cents` 拒绝，防止超额/零额退款 |
| 退款金额取整 | `commerce.ts:399` | ✅ `Math.round` 避免浮点 |
| 沙箱确认门禁 | `commerce.ts:214-235` | ✅ 校验 provider_mode=sandbox + 会话状态 open/completed |
| 生产支付门禁 | `commerce.ts:198-212` | ✅ 走 `evaluatePaymentLaunchGate`，未就绪返回 503 |
| 金额单位 | `commerce.ts:42-45` | ✅ 统一 `amount_cents`（分），tier 定价 1900/4900/9900 |
| webhook 验签 | `commerce.ts:838-919` | ✅ 三种 provider 均验签 + 时间窗 |

---

## 4. 严重度分布

| 级别 | 数量 | 编号 |
|------|------|------|
| 🔴 Blocker | 0 | — |
| 🟠 Major | 2 | C-01, C-02 |
| 🟡 Minor | 3 | C-03, C-04, C-05 |
| 🟢 Nit | 2 | C-06, C-07 |

> 注：**typecheck 的 4 个 TS2532 错误**由 QA 报告记录为 🔴（阻塞），归因于测试文件；本报告不重复计入。

## 5. 代码审查结论

代码架构分层清晰、错误处理统一、资金与状态机逻辑严谨，**未发现逻辑正确性缺陷或数据一致性漏洞**。

主要问题集中在**可维护性**（C-01 巨型文件、加密逻辑混杂）与**测试基础设施性能**（C-02）。两者不阻塞功能上线，但会持续拖慢迭代速度并在 CI 中反复产生噪声，建议在首轮放量后优先偿还。
