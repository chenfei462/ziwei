# QA 测试与发布就绪报告（原始产出）

**日期**：2026-09-20
**执行人**：gstack-qa-lead（质量门神）
**项目**：紫微星垣（ziwei-interactive-chart-engine v0.1.0）

---

## 1. 测试执行摘要

| 命令 | 结果 | 通过率 | 备注 |
|------|------|--------|------|
| `npm run typecheck` | ❌ **失败** | — | 4 个 TS2532 错误，全部位于 `tests/comprehensive-ziwei-test.ts` |
| `npm test` (vitest) | ⚠️ **部分失败** | 95.4% | 329 tests: 314 passed / 15 failed；79 files: 70 passed / 9 failed |
| `npm run build` | 未执行 | — | 因 typecheck 失败，构建应同步阻塞 |
| `npm run test:e2e` | 未执行 | — | 依赖生产构建产物，前置阻塞 |

### 1.1 typecheck 失败详情

```
tests/comprehensive-ziwei-test.ts(552,45): error TS2532: Object is possibly 'undefined'.
tests/comprehensive-ziwei-test.ts(554,45): error TS2532: Object is possibly 'undefined'.
tests/comprehensive-ziwei-test.ts(571,34): error TS2532: Object is possibly 'undefined'.
tests/comprehensive-ziwei-test.ts(572,34): error TS2532: Object is possibly 'undefined'.
```

**影响**：`npm run typecheck` 是 `verify:public` 与 CI 的第一道门禁，直接失败 → 上线流水线无法通过。

### 1.2 vitest 失败分布

**9 个失败测试文件**：
1. `tests/chart-page-access.test.tsx` — Hook timed out (10s)
2. `tests/checkout-sandbox-confirm-route.test.ts` — Hook timed out (10s)
3. `tests/commerce-provider.test.ts` — Hook timed out (10s)，4 个用例失败
4. `tests/phase10-launch-ops.test.ts` — Hook timed out (10s)，2 个用例失败
5. `tests/phase13-growth.test.ts` — Hook timed out (10s)
6. `tests/phase15-mini-program.test.ts` — Hook timed out (10s)
7. `tests/production-foundation.test.ts` — Hook timed out + **1 个真实断言失败**
8. （其余 2 个同类 hook 超时）

**15 个失败用例中，13 个为 `Hook timed out in 10000ms`，1 个为真实断言失败。**

---

## 2. 根因分析

### 2.1 P0 根因：测试存储目录膨胀导致 beforeEach 超时

**证据链**：

1. `vitest.config.ts:10` 仅配置 `testTimeout: 15_000`，**未配置 `hookTimeout`** → hook 使用 vitest 默认 **10 000ms**。
2. 失败测试的 `beforeEach` 调用 `clearChartsForTests()` 等清理函数。
3. `src/store.ts:111-116` `clearChartsForTests()` → 调用 `clearPersistentBucket("charts")`。
4. `src/store.ts:935-940` `clearPersistentBucket()` → `removePersistentDir(bucketDir)` **同步递归删除**整个目录。
5. `src/store.ts:946-953` `resolvePersistentStoreDirForRuntime()` 在 `NODE_ENV=test` 时使用 `data/phase-store/test-<pid>`；但非测试环境下指向 `data/phase-store` 根。
6. **实测数据**：`data/phase-store` 目录已累积 **52 327 个 JSON 文件**，其中：
   - `charts` = 2 295
   - `product-events` = 1 879
   - `reports` = 920
   - `share-landings` = 840
   - `content-review-records` = 832
   - 另有 **3 000+ 个 `test-<pid>` 残留子目录**（历次测试运行未清理）

**结论**：每次 `beforeEach` 需要同步遍历并删除海量文件，在 Windows NTFS 上远超 10 秒 → `Hook timed out`。

**注意**：这是**测试环境基础设施缺陷**，非生产代码缺陷。但会导致 CI 无法通过、回归信号失效，**构成上线阻塞项**。

### 2.2 唯一的真实断言失败：测试断言过时（非产品缺陷）

```
FAIL tests/production-foundation.test.ts > upgrades anonymous visitor into a persisted user and migrates chart ownership
AssertionError: expected 'member_61922b47c69ef57406' to be 'member_upgrade'
  at tests/production-foundation.test.ts:201:36
```

**分析**：该用例请求体提交 `member_id: "member_upgrade"`，期望服务端采纳该值。但 `src/app/api/account/upgrade/route.ts:16-17` 已**刻意忽略客户端提交的 member_id**，改为服务端派生：

```ts
const { identity, shouldSetVisitorCookie } = getOrCreateRequestIdentity(request);
const memberId = identity.memberId ?? createMemberId(identity.visitorId);
```

**定性**：这是**安全加固后的预期行为**——服务端拒绝客户端自选身份，防止越权与身份伪造。**测试断言未同步更新**，属测试代码缺陷，**不是生产缺陷**。修复方式为更新断言。

---

## 3. 功能域 → 测试覆盖矩阵

| 功能域 | 关键页面/API | 测试文件 | 覆盖度 | 缺口 |
|--------|-------------|---------|--------|------|
| 命盘计算引擎 | `/api/chart/create` | phase1-engine, phase1-api-and-fixtures | 🟢 良好 | — |
| 命盘视图/交互 | `/chart/[id]`, phase2 | phase2-viewmodel, phase2-interaction, phase2-camera-* | 🟢 良好 | — |
| 规则与解读 | `/api/interpret` | phase3-interpretation, phase3-rules, phase3-deepseek | 🟢 良好 | DeepSeek 真实调用未覆盖 |
| AI 追问 | `/api/ai/follow-up` | ai-followup | 🟡 中等 | 额度并发扣减未覆盖 |
| 报告生成/访问 | `/report/[id]`, `/api/report/*` | phase8-reporting, report-page-access, report-purchase-action | 🟢 良好 | 导出预览对象存储路径 |
| **支付与权益** | `/api/payment/webhook`, checkout | phase9-commerce, commerce-provider, commerce-identity-boundary, checkout-sandbox-confirm-route | 🟡 **中等（本次失败）** | **webhook 验签用例当前跑不起来** |
| 账号与登录 | `/account`, `/api/account/*` | account-components, account-readiness, account-repository | 🟢 良好 | 真实短信网关未覆盖 |
| 隐私与删除 | `/api/privacy/delete-request` | privacy-deletion | 🟢 良好 | — |
| 分享 | `/share/[id]`, `/api/share/*` | wechat-share, wechat-share-route | 🟡 中等 | 分享快照脱敏边界 |
| 运营后台 | `/internal/ops`, `/api/ops/*` | ops-* (8 个文件) | 🟢 良好 | 敏感 reveal 审计 |
| 渠道与增长 | `/api/channel/*`, growth | phase13-growth, phase14-channels | 🟡 中等（1 个失败） | — |
| 小程序 | `mini-program/`, `/api/mini-program/*` | phase15-mini-program, phase15-routes | 🟡 中等（1 个失败） | 微信真机联调 |
| 合规页面 | `/legal/*` | compliance-pages | 🟢 良好 | — |
| 可观测性 | `src/observability.ts` | observability | 🟢 良好 | 真实 webhook 投递 |

**覆盖缺口（高风险）**：
1. **越权拒绝（IDOR）**：仅 `commerce-identity-boundary` 部分覆盖，未系统覆盖全部 88 个路由。
2. **并发幂等**：支付事件重放、权益重复发放缺并发测试。
3. **退款全链路**：provider refund envelope 已测，但真实退款回调缺覆盖。
4. **限流**：仅有 `api-security.test.ts`，未覆盖 Redis 生产路径。

---

## 4. 上线就绪 checklist

| 配置项 | 用途 | readiness 暴露点 | 缺失风险 |
|--------|------|-----------------|---------|
| `DATABASE_URL` | PostgreSQL 生产主库 | `/api/launch/config` | 🔴 缺失则 repository 失败关闭，产品不可用 |
| `ZIWEI_BIRTH_DATA_ENCRYPTION_KEY` | 出生资料 AES-256-GCM | `config.birth_data_encryption` | 🔴 缺失则不得开放建盘 |
| `SESSION_SECRET` | 会话 cookie HMAC | `config` (login readiness) | 🟠 缺失则 cookie 不签名 |
| `TRUSTED_IDENTITY_HEADER_SECRET` | 受信头 HMAC | — | 🟠 网关身份链断裂 |
| `ZIWEI_RATE_LIMIT_REDIS_REQUIRED` + URL/TOKEN | 生产限流 | `config.rate_limit` | 🟠 缺失写接口失败关闭 |
| `OBS_LOG_SINK` / `OBS_METRICS_ENDPOINT` / `OBS_ALERT_WEBHOOK_URL` | 可观测 | `config.observability` | 🟠 无法上线（README 明示） |
| `ZIWEI_EXPORT_STORAGE_*` | 导出对象存储 | `config.export_storage` | 🟡 导出不可用 |
| `WECHAT_PAY_*` / `ALIPAY_*` | 真实支付 | `config.china_payment_providers` | 🟡 缺则仅沙箱 |
| `PHASE10_ADMIN_TOKEN` + MFA | 后台门禁 | `config.ops_security` | 🔴 缺失则后台裸奔 |
| `SMS_PROVIDER=http_sms` + 网关 | 短信登录 | login readiness | 🟠 mock_sms 不得生产 |

---

## 5. 兼容性评估

| 项 | 状态 | 说明 |
|----|------|------|
| Node 版本 | 🟡 待确认 | `package.json` **未声明 `engines`**；环境有 22.22.2 / 24.16.0；Next 16 要求 Node ≥ 20 |
| 浏览器 E2E | 🟠 仅 desktop | `playwright.config.ts` 仅 desktop project，**无移动端 viewport 覆盖** |
| 微信 H5 | 🟡 部分 | JS-SDK 签名有测试，真机分享未验证 |
| 小程序 | 🟡 部分 | 单元覆盖，真机联调缺失 |
| `@mediapipe/tasks-vision` | 🟠 风险 | 依赖浏览器摄像头/WASM，无降级路径测试 |
| Prisma/PostgreSQL | 🟢 良好 | production-database.test 覆盖 readiness |

---

## 6. QA 结论

- **测试通过率**：95.4%（314/329），但 **9 个文件整体失败**，回归信号不可信。
- **上线阻塞**：`typecheck` 硬失败 + 13 个 hook 超时掩盖真实回归风险。
- **核心建议**：清理 `data/phase-store` 残留 + 配置 `hookTimeout` + 修正 4 个 TS 错误 + 更新 1 个过时断言，之后重跑全量测试确认 100% 通过，方可放行。
