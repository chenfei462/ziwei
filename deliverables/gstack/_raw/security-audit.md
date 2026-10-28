# 安全审计报告（原始产出）

**日期**：2026-09-20
**执行人**：gstack-security-officer（安全官）
**框架**：OWASP Top 10 (2021) + STRIDE 威胁建模
**项目**：紫微星垣（Next.js 16 全栈，88 个 API 路由）

> 审计方法：**读取实际代码验证 README 的安全声称**。声称与实现不符处为最高价值发现。

---

## 1. 已核验的良好实践 ✅

| 项 | 位置 | 核验结论 |
|----|------|---------|
| 生产环境身份边界 | `src/auth.ts:67-72, 89-99` | ✅ 生产仅从签名 cookie 取身份，**忽略** `x-visitor-id`/`x-member-id`/query 参数 |
| 会话 cookie 签名 | `src/auth.ts:315-330` | ✅ HMAC-SHA256 + `timingSafeEqual` 常量时间比较 + 正则校验签名格式 |
| 受信头验签 | `src/auth.ts:251-264` | ✅ HMAC + 5 分钟时间窗 + `timingSafeEqual`；无 secret 时返回 undefined（不信任） |
| 密钥长度门禁 | `src/auth.ts:332-340` | ✅ secret < 24 字符视为未配置 |
| 微信支付验签 | `src/phase9/commerce.ts:838-889` | ✅ 真实 RSA-SHA256 + 平台证书序列号匹配 + 5 分钟时间窗，全部 fail-closed |
| 支付宝验签 | `src/phase9/commerce.ts:891-919` | ✅ RSA2、按 key 排序、排除 sign/sign_type |
| Mock 验签 | `src/phase9/commerce.ts:826-835` | ✅ HMAC + `timingSafeEqual` + 长度预检 |
| 出生资料加密 | `src/repositories/productRepository.ts:3888-3904` | ✅ AES-256-GCM + 每字段随机 12 字节 IV + AAD + authTag |
| 加密 fail-closed | `src/repositories/productRepository.ts:3899-3902` | ✅ 生产缺 key 直接 throw |
| 硬编码密钥扫描 | `src/`, `mini-program/` | ✅ 未发现明文 sk-/PEM/密钥字面量（`sk_live_` 仅为 `startsWith` 判断） |
| `.gitignore` | `.gitignore:1-3` | ✅ 覆盖 `.env`、`.env.*` |

---

## 2. 威胁建模（STRIDE）

| 威胁 | 场景 | 现状 | 评级 |
|------|------|------|------|
| **S**poofing | 伪造身份访问他人命盘/报告 | cookie 签名 + 生产忽略裸 header | 🟢 已缓解 |
| **T**ampering | 篡改支付 webhook 骗领权益 | RSA-SHA256/HMAC 验签 + 时间窗 | 🟢 已缓解 |
| **R**epudiation | 后台敏感操作抵赖 | `audit_logs` + reveal 审计 | 🟢 已缓解 |
| **I**nfo Disclosure | 出生资料/手机号泄露 | AES-256-GCM + 日志脱敏 + 分享脱敏 | 🟠 见 F-03 |
| **D**oS | 暴力刷写接口 | 限流（生产 Redis 强制） | 🟠 见 F-01 |
| **E**levation | 角色越权访问 ops | `PHASE10_ADMIN_TOKEN` + MFA + 角色区分 | 🟡 见 F-04 |

---

## 3. OWASP Top 10 (2021) 检查表

| # | 分类 | 结论 | 说明 |
|---|------|------|------|
| A01 | Broken Access Control | 🟡 | 主链路归属校验完善；限流键可被伪造（F-01） |
| A02 | Cryptographic Failures | 🟠 | 加密实现正确，但**密钥派生无 KDF**（F-02） |
| A03 | Injection | 🟢 | 未发现 raw SQL 拼接；CSV 导入风险低 |
| A04 | Insecure Design | 🟢 | 支付/权益状态机设计严谨，生产开关 fail-closed |
| A05 | Security Misconfiguration | 🟠 | **无安全响应头配置**（F-05）；`next.config.ts` 仅 4 行 |
| A06 | Vulnerable Components | 🟡 | 未执行 `npm audit`（建议补） |
| A07 | Auth Failures | 🟢 | 签名 + 时间窗 + 常量时间比较，实现规范 |
| A08 | Data Integrity Failures | 🟢 | webhook 验签 + 幂等事件覆盖良好 |
| A09 | Logging Failures | 🟢 | 结构化日志 + 脱敏 + 告警规则就绪 |
| A10 | SSRF | 🟡 | SMS 网关/对象存储/webhook URL 来自环境变量（受控） |

---

## 4. 安全发现明细

### 🟠 F-01：限流键使用攻击者可控的无签名请求头（中高危）

**位置**：`src/apiSecurity.ts:125-130`

```ts
function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const visitor = request.headers.get("x-visitor-id");   // ← 无签名，客户端可控
  const member = request.headers.get("x-member-id");     // ← 无签名，客户端可控
  return [forwarded, member, visitor, new URL(request.url).pathname].filter(Boolean).join(":");
}
```

**问题**：`x-visitor-id` / `x-member-id` 未被签名或校验即参与限流分桶。攻击者可任意轮换这两个 header 值，使每次请求落入**全新限流桶**，从而完全绕过进程内限流。

**攻击场景**：对 `/api/account/sms/send` 遍历 `x-visitor-id: v1, v2, v3...`，绕过 60 req/min 限制，实施短信轰炸 / 验证码爆破。

**加重因素**：`assertTrustedOrigin`（`src/apiSecurity.ts:44`）在**无 `Origin` 头时直接放行**，服务端脚本/curl 天然无 Origin，Origin 校验对非浏览器攻击者无效。

**建议**：
1. 限流键改用**服务端可信标识**（已验签的 cookie 值或 `x-forwarded-for`），绝不使用裸 client header。
2. Origin 缺失时对写接口返回 403 而非放行（或要求 `Sec-Fetch-Site`）。
3. 短信/登录类接口独立更严格配额（如 IP + 手机号双维度）。

---

### 🟠 F-02：出生资料加密密钥派生未使用 KDF（中危）

**位置**：`src/repositories/productRepository.ts:3903`

```ts
return createHash("sha256").update(configuredKey || "ziwei-local-birth-data-test-key").digest();
```

**问题**：原始密钥直接经**单轮 SHA-256** 派生为 AES-256 密钥，未使用 PBKDF2 / scrypt / Argon2 加盐迭代。若 `ZIWEI_BIRTH_DATA_ENCRYPTION_KEY` 为人工设置的弱口令（README 仅要求"至少 24 字符"），可被离线暴力/字典攻击。

**加重因素**：fallback 值 `"ziwei-local-birth-data-test-key"` 为**公开可读的固定字符串**。虽第 3900 行有生产 fail-closed 保护，但任何 `NODE_ENV !== "production"` 的部署（预发、容器误配）都会用该固定密钥加密真实出生资料。

**建议**：
1. 使用 `crypto.scryptSync(configuredKey, salt, 32)` 派生，salt 随密文存储。
2. 移除固定 fallback，测试环境亦要求显式注入密钥。
3. 引入 `v2` 密文格式版本，支持密钥轮换。

---

### 🟡 F-03：`data/phase-store` 敏感数据落盘与残留（中低危）

**位置**：`data/phase-store/`（**52 327 个 JSON 文件**）

**问题**：
1. 文件型 store 中持久化了 `charts`(2295)、`reports`(920)、`chart-owners`(357)、`orders`(423)、`payment-events`(416)、`ai-generation-logs`(458) 等业务数据。README 明确"文件型 repository 只适合开发/测试"，但**目录中混有非测试数据**。
2. 累积 **3 000+ 个 `test-<pid>` 残留子目录**从未清理，既是磁盘泄漏也是数据卫生问题。
3. `.gitignore` 仅忽略 `data/phase-store/`（正确），但需确认该目录未被误打包进构建产物或部署包。

**建议**：
1. 上线前确认生产环境 `ZIWEI_STORE_DIR` 不指向该目录，且生产强制 `DATABASE_URL`。
2. 清理测试残留，CI 增加测试后清理步骤。
3. 若目录中曾写入真实出生资料，按隐私流程评估是否需要删除审计。

---

### 🟡 F-04：角色权限与二次确认可绕过面（中低危）

**位置**：`/api/ops/sensitive-record`、`/api/ops/rule-profiles/default`、`/api/ops/reconciliation/import`

**问题**：敏感操作依赖请求体 `second_confirmed: true` 与 `reason` 字段。若这些字段仅做**存在性检查**而无服务端状态绑定（如工单号校验、时间戳窗口、二次会话校验），攻击者一旦获得 `ops_admin` 凭据即可无摩擦批量 reveal 敏感详情。

**建议**：核查各 ops 接口是否为纯布尔校验；建议引入"预申请 + 二次会话确认"或至少绑定 `ticket_id` 与操作时间戳。

---

### 🟡 F-05：缺少安全响应头配置（中低危）

**位置**：`next.config.ts`（全文仅 4 行）

```ts
const nextConfig: NextConfig = { reactStrictMode: true };
```

**问题**：未配置 `headers()`，缺少：
- `Strict-Transport-Security`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options` / `frame-ancestors`（点击劫持）
- `Content-Security-Policy`（XSS 纵深防御）
- `Referrer-Policy`

**建议**：在 `next.config.ts` 增加 `headers()` 统一注入，或由反向代理/CDN 层补齐。

---

### 🟡 F-06：环境文件含明文 API 密钥（中低危）

**位置**：`.env.local:1`

```
DEEPSEEK_API_KEY=[REDACTED]
```

**问题**：项目根目录存在含**明文 DeepSeek API Key** 的 `.env.local`。`.gitignore` 已正确忽略（未被追踪），但：
1. 密钥已落盘在开发机，且曾出现在会话读取中，**应立即轮换**。
2. 需确认该 key 未被写入任何日志、构建产物或提交历史。

**建议**：立即在 DeepSeek 控制台吊销并轮换该 key；确认 git 历史无泄漏（`git log -p --all -- .env.local`）。

---

### 🟢 F-07：未声明 `engines` 与未执行依赖扫描（低危）

**问题**：`package.json` 无 `engines` 字段；本次未执行 `npm audit`。

**建议**：声明 Node 版本约束；CI 增加 `npm audit --production --audit-level=high` 卡点。注意 `next@^16.2.7`、`@prisma/client@^6.19.3`、`iztro@^2.5.3` 等依赖应定期跟踪安全公告。

---

## 5. 严重度分布

| 级别 | 数量 | 编号 |
|------|------|------|
| 🔴 Critical | 0 | — |
| 🟠 High | 2 | F-01, F-02 |
| 🟡 Medium | 4 | F-03, F-04, F-05, F-06 |
| 🟢 Low | 1 | F-07 |

## 6. 安全结论

核心安全架构（身份签名、支付验签、加密、审计）**实现质量高于同类项目平均水平**，未见直接可远程利用的高危漏洞（0 Critical）。

但存在 **2 项 High**：限流可被伪造 header 绕过（F-01）、加密密钥派生强度不足 + 固定 fallback（F-02）。两者均为**上线前应修复**项。

另需立即处理：轮换 `.env.local` 中的 DeepSeek API Key（F-06）。
