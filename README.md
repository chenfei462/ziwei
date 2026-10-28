# 紫微星垣网页端产品

紫微星垣把高门槛紫微斗数转成可解释、可脱敏分享、可连续打卡的星垣观察卡，用免费生成获客，用社交分享扩散，用私密报告和会员权益转化。

紫微星垣是一个基于 Next.js App Router 的紫微斗数网页产品。当前公开主流程已经从阶段演示入口收敛为面向大众用户的正式路径：匿名或账号访问、创建命盘、查看结构化解读、生成报告、创建脱敏分享、查看会员权益、查看订单、提交客服和反馈问题。

## Trae CN 投稿入口

- 最终提交控制台：`docs/trae-submission/final-submission-control-room.md`
- 投稿资产清单：`docs/trae-submission/assets-checklist.md`
- 投资人一页纸：`docs/trae-submission/investor-one-pager.md`
- 投资人 8 页 deck 文稿：`docs/trae-submission/investor-mini-deck.md`
- 可打开/可打印 HTML deck：`docs/trae-submission/investor-deck.html`
- 社区作品帖：`docs/trae-submission/community-post.md`
- 决赛答辩 Q&A：`docs/trae-submission/judging-qna.md`
- 截图资产 manifest：`output/trae-assets/manifest.json`
- 一键投稿包：`output/trae-submission-pack`，运行 `npm run build:trae-submission-pack` 生成
- 投稿材料验证：`npm run verify:trae-submission` 会先生成投稿包，再校验文档、截图、pack manifest 和必须用户回填的外部证据占位
- 本地验证入口：`npm run typecheck`、`npm test -- tests/public-mvp.test.ts --maxWorkers=1 --no-file-parallelism`、`node scripts/capture-trae-assets.mjs`

## 当前能力

- 正式公开路径：`/`、`/account`、`/chart/new`、`/chart/[id]`、`/report/[id]`、`/share/[id]`、`/member`、`/orders`、`/support`、`/legal/privacy`、`/legal/terms`。
- 阶段演示能力保留在 `/internal/phases/*`；公开 `/phase*` route files 已移除，访问统一走正式 404，不作为大众主流程。
- 首次建盘会下发 `zv_visitor_id` HttpOnly 匿名访客 cookie；手机号验证码登录或账号升级后下发 `zv_member_id` HttpOnly 会员 cookie，并迁移匿名命盘归属。配置 `SESSION_SECRET` 后会话 cookie 使用 HMAC-SHA256 签名，服务端会拒绝被篡改的 cookie。
- `/api/account/sms/send` 和 `/api/account/sms/login` 已提供手机号验证码登录闭环；服务端只保存手机号哈希和验证码哈希，`mock_sms` 仅用于自动化测试，生产必须接入真实短信服务商。
- 命盘、归属、用户、匿名访客、报告、导出预览、分享、订单、checkout、支付事件、provider 对账单、权益、反馈、客服工单、运营事件和后台审计相关记录通过 repository/store 边界持久化。开发和测试可使用 `data/phase-store` 测试替身；生产 repository mode 必须配置 PostgreSQL `DATABASE_URL`，否则失败关闭，不把文件型 store 伪装成生产数据库。
- 分享页和公开统计默认隐藏完整出生日期、出生时间、精确地点、真实身份和图片 payload。
- 订单、checkout、payment webhook、entitlement、report 流程具备状态机、签名校验、幂等事件和 mock provider；公开 `/api/payment/webhook?provider=...` 会按 Stripe、微信支付、支付宝或 mock provider 选择对应签名 header，可测试支付成功、失败、退款和权益发放。命盘页和报告免费摘要页可直接创建微信支付/支付宝结账会话；缺少真实商户号时会落到 `/commercial/checkout-sandbox` 接入验证页，不伪装生产支付。本地和预发可通过 `/api/checkout/sandbox/confirm` 在服务端消费已签名 sandbox webhook 并发放权益，不向浏览器暴露 raw webhook、签名或支付密钥；`/api/launch/config.sandbox_checkout_confirm` 会暴露该入口是否开启，生产默认关闭且开启时会提示真实订单必须走微信支付/支付宝 webhook。`/api/launch/config.china_payment_providers` 会分别暴露微信支付和支付宝所需商户环境变量、回调签名 header、sandbox/production 状态和缺失配置 blocker；生产支付放量 gate 会按用户选择的微信或支付宝 provider 逐一校验 ready 状态，未指定 provider 时才接受任一中国支付 provider ready。后台 `/api/ops/reconciliation/preview` 可由 `ops_admin` 预检微信/支付宝 provider 对账单元数据，只返回匹配行、金额差异、孤儿流水和脱敏告警，不写入 `provider_statements`，不写入导入审计，raw reference 只生成 digest；`/api/ops/reconciliation/import` 和 `/internal/commercial/dashboard` 支持正式导入，既可提交结构化 JSON rows，也可粘贴带平台别名表头的 CSV（如 `transaction_id`、`out_trade_no`、`out_refund_no`、`total_amount`、`success_time`、`memo`），服务端按内部订单/退款识别匹配行、金额差异和第三方孤儿流水；`/api/ops/reconciliation.alerts` 会把金额不一致、孤儿流水、重复 webhook 和权益缺口汇总为脱敏 Payment Alerts，内部商业后台会展示严重级别、计数和处置建议；原始账单备注只保存 digest，预览后页面粘贴区会可见脱敏，导入成功后写入 `ops_provider_statement_imported` 管理员审计并清空页面粘贴区，避免敏感备注留在 DOM。`starter_19` 仅发放免费摘要和脱敏分享权益，`standard_49`/`premium_99` 才发放完整报告阅读和导出预览权益。
- AI 解读具备 prompt 版本、生成记录、失败回退和安全过滤；公开 `/api/interpret` 会先校验当前 visitor/member 拥有 `chart_id`，再进入本地规则和模型改写；`/api/ai/follow-up` 支持事业、关系、财务习惯、自我成长、年度节奏追问，免费用户每日 3 次、会员每日 20 次，回答只引用当前命盘和规则 trace。
- 日常星垣、星曜图鉴、成就和社群挑战接口会从 HttpOnly cookie 或受信 header 解析当前主体；`/api/daily/theme` 会校验当前主体拥有 `chart_id` 后才生成日主题，`/api/daily/check-in`、`/api/daily/streak`、`/api/star-atlas*`、`/api/member/achievements`、`/api/challenge/*` 会覆盖 query/body 中的 `member_id`，避免前端伪造他人成就、连续打卡或挑战进度。
- 渠道入口、渠道分享、分享/渠道增长事件会从 HttpOnly cookie 或受信 header 解析当前主体；`/api/channel/entry`、`/api/share/create`、`/api/growth/channel-event`、`/api/growth/referral-event` 会覆盖 body 中的 `visitor_id`/`member_id`，首次匿名访问会下发 `zv_visitor_id`。渠道入口落地 URL 使用正式 `/chart/new`，公开 URL 只保留 `channel`、`campaign`、`share_id` 等归因参数，不暴露 `visitor_id` 或内部 `/phase14` 路径。
- 小程序登录、openid 绑定、订阅授权和提醒事件也只信服务端解析出的当前主体；`/api/mini-program/login` 会用当前 visitor/member 覆盖 body 中的主体字段并写回 HttpOnly cookie，`/api/mini-program/link-member`、`/api/mini-program/subscribe`、`/api/mini-program/reminder-event` 会覆盖 body 中的 `visitor_id`/`member_id`，前端控制台不再提交这些标识。
- 报告生成具备任务记录、失败重试计数和客服兜底工单关联；公开 `/api/report/draft` 会用当前 HttpOnly cookie 或受信 header 校验 `chart_id` 归属，陌生 visitor/member 不能用别人的命盘生成报告草稿。每份报告保存 `report_version`、访问层、规则版本、AI prompt 版本、生成时间、公开脱敏摘要和导出选项，任务只保存请求摘要和 digest，不保存完整出生资料。未购买的报告拥有者只能在 `/report/[id]` 查看免费脱敏摘要和购买入口，完整宫位详情、规则 trace 和导出预览需有效完整报告权益。
- 报告导出预览支持本地预览和 S3/OSS/COS 兼容对象存储 readiness；生产设置 `ZIWEI_EXPORT_STORAGE_REQUIRED=true` 后缺少对象存储配置会失败关闭，导出 URL 和对象 key 使用哈希路径，不包含报告 ID、出生资料或地点原文。
- 报告内容审核记录会独立持久化，后台 `/api/ops/content-reviews` 可按报告、状态和来源查询脱敏审核元数据；不返回原始报告正文、prompt 或完整出生资料。
- 规则版本治理已接入运营后台：`/api/ops/rule-profiles` 和 `/api/ops/rule-profiles/[id]` 返回当前活跃默认规则、规则版本、顾问确认状态和可提升状态，`/api/ops/rule-profiles/default` 仅允许 `ops_admin` 在 `second_confirmed=true` 且规则为 `confirmed` 时切换默认规则；规则对比和知识图谱搜索迁移到 `/api/ops/chart/compare-rules`、`/api/ops/knowledge/search`、`/api/ops/knowledge/node/[id]`。切换会写入 `rule_versions.active_default` 和 `ops_rule_profile_promoted` 审计，后续未显式指定 `rule_profile_id` 的建盘会使用新的活跃默认规则；响应和审计不包含出生资料、报告正文、模型 prompt 或第三方身份明文。
- 公开客服工单 `/api/support/ticket` 只绑定服务端解析出的当前 visitor/member 身份，前端不再提交用户标识；缺少既有会话或在请求体中冒充其他主体会被拒绝。运营后台创建订单关联工单走 `/api/ops/order/[id]/support-ticket`，由管理员鉴权后从订单归属绑定 member/report/order，并写入工单审计和订单备注；工单详情读取和状态更新走 `/api/ops/support/ticket/[id]`，旧公开 `/api/support/ticket/[id]` 已移除。
- 数据删除和账号注销请求通过 `/api/privacy/delete-request` 创建独立状态记录并关联客服工单；请求主体只能来自服务端解析的 `zv_visitor_id`/`zv_member_id` 或受信 header，缺少既有会话或在请求体中冒充其他主体会被拒绝；后台 `/api/ops/deletion-requests` 可查询，完成、拒绝或取消必须二次确认并写入审计轨迹。
- 管理后台入口保留在 `/internal/ops`，商业化控制台保留在 `/internal/commercial/dashboard`，二者都依赖管理员 header/token；生产应开启 `PHASE10_OPS_MFA_ENABLED=true` 并由受保护网关注入 `x-admin-mfa-code`，公开主导航不暴露后台入口。旧公开 `/phase*`、`/ops`、`/commercial/dashboard`、`/immersive` 入口不再挂载 route file，访问会走正式 404，不向大众产品暴露阶段、后台或沉浸式内部入口。旧 `/api/beta/*` 已迁移为受保护的 `/api/ops/product-signals/*`，分享卡、收藏、报告意向和信号 dashboard 仅供内部运营验证，缺少管理员凭据会返回 `OPS_AUTH_REQUIRED`。旧 `/api/feedback` 也已迁移为 `/api/ops/internal-feedback`，内部原型反馈需要管理员凭据；旧 `/api/immersive/session*` 已迁移为 `/api/ops/immersive/session*`，沉浸式舞台会话创建、读取、事件和 stream 都要求后台凭据；旧 `/api/launch/dashboard` 与 `/api/commercial/dashboard` 已迁移为 `/api/ops/launch/dashboard` 和 `/api/ops/commercial/dashboard`，后台仪表盘不再挂在公开 API 空间；旧 `/api/launch/growth-event` 已迁移为 `/api/ops/launch/growth-event`，launch 增长事件注入必须带管理员凭据；旧 `/api/synastry/create` 与 `/api/timeline/interpret` 已迁移为 `/api/ops/synastry/create` 和 `/api/ops/timeline/interpret`，合盘/年度主题扩展仅供内部阶段页和审核角色使用。正式公开反馈、申诉和删除申请走 `/api/support/ticket` 与 `/api/privacy/delete-request`。`/api/ops/users`、`/api/ops/reports`、`/api/ops/shares` 只返回脱敏运营摘要，财务复盘只对 `ops_admin` 和 `support_agent` 开放；`/internal/ops` 还提供 Rule Version Control，可加载规则画像、查看 active default、对顾问确认规则执行二次确认提升，并展示本次规则审计。
- 所有用户写接口统一执行 Origin 校验和 rate limit；开发/测试使用进程内限流，生产可通过 Upstash/Redis REST 适配。`ZIWEI_RATE_LIMIT_REDIS_REQUIRED=true` 且 Redis 未配置时写接口失败关闭，`/api/launch/config.rate_limit` 会暴露 readiness。
- 生产观测接入 readiness 已暴露在 `/api/launch/config.observability`；结构化日志 formatter 会哈希用户标识并脱敏出生资料、手机号、邮箱、图片 payload 和密钥，告警规则覆盖 5xx、支付签名失败、权益缺口、后台未授权访问和备份健康检查。
- sitemap、robots、manifest、Open Graph metadata、隐私政策、用户协议和免责声明已提供。

## 命令

```bash
npm install
npm run generate:fixtures
npm run typecheck
npm test
npm run build
npm run dev
npm run test:e2e
```

`npm run test:e2e` 会先拉起本地生产构建服务，再执行 Playwright，并在结束后主动关闭服务。

## 2026-06-07 数据层增量

- 互动追问额度已进入正式数据层：`prisma/schema.prisma` 和迁移脚本新增 `follow_up_quotas`，生产 repository 通过 Prisma 按 `subject_id + window_start` 持久化免费/会员追问计数。
- `/api/ai/follow-up` 改为 async repository 路径：先校验命盘归属，再读取命盘，再检查和扣减额度；陌生访客不能追问他人的私有命盘。
- 追问额度记录只保存 subject、plan、日期窗口、limit、used 和 privacy note，不保存原始问题、回答、生日、出生时间或地点。
- 开发/测试文件型 store 的路径拼接已通过 runtime helper 隔离，`next build` 不再把 `data/phase-store` 历史 JSON 当作 Turbopack 静态文件模式追踪；生产仍必须使用 PostgreSQL，不得以文件 store 作为正式主库。

## 2026-06-07 后台审计与敏感字段授权增量
- 通用管理员审计日志已从 `audit_logs` PostgreSQL 表接入 `src/repositories/productRepository.ts`、`src/store.ts` 和 `scripts/migrate-phase-store-to-postgres.ts`；生产 Prisma adapter 支持写入和查询后台关键操作审计记录。
- 新增 `/api/ops/sensitive-record`，仅 `ops_admin` 可在提供 reason 且 `second_confirmed=true` 后查看 chart/report/order/share/support_ticket 的敏感详情；support_agent 和 content_reviewer 默认只能使用脱敏列表。
- 敏感详情 reveal 会写入 `ops_sensitive_record_revealed` 审计日志，metadata 中的生日、出生时间、地点等会再次脱敏；该接口不解密 `birth_profiles` 中的原始出生资料密文。
- 新增 `/api/ops/audit-logs` 和 `/internal/ops` audit 计数，方便运营负责人核对退款、补发、删除数据、敏感详情查看等关键操作是否留痕。
- `/internal/ops` 已挂载受保护的运营控制台，可在同一页面加载审计日志、填写 record type/ID/reason/ticket、二次确认后触发敏感详情 reveal；revealed record 只在管理员操作界面展示，审计列表仍显示脱敏 metadata。
- 2026-06-09 规则版本管理增量：新增 `/api/ops/rule-profiles`、`/api/ops/rule-profiles/[id]`、`/api/ops/rule-profiles/default`、`/api/ops/chart/compare-rules` 和 `/api/ops/knowledge/*`，后台角色可读取脱敏规则版本摘要、执行规则对比和检索知识图谱；默认规则提升只允许 `ops_admin` 二次确认。默认规则状态通过 repository 写入 `rule_versions` 或开发测试 `rule-versions` bucket，可随 PostgreSQL 迁移；切换审计动作为 `ops_rule_profile_promoted`。旧公开 `/api/rule-profiles*`、`/api/knowledge*`、`/api/chart/compare-rules` 已移除。
- 2026-06-09 Phase 7 扩展工具收束增量：新增 `/api/ops/synastry/create` 和 `/api/ops/timeline/interpret`，合盘对照和年度/月度主题只允许后台角色调用；旧公开 `/api/synastry/create`、`/api/timeline/interpret` route files 已移除，同步 dispatcher 也不再服务旧路径。

## 关键环境变量

- `NEXT_PUBLIC_SITE_URL`：生产站点 URL，用于 metadata、sitemap、Open Graph 和 Origin 校验。
- `ZIWEI_STORE_DIR`：文件型持久化目录。默认生产路径为 `data/phase-store`，测试路径为 `data/phase-store/test-<pid>`。
- `ZIWEI_E2E_STORE_TEST_DOUBLE`：仅 Playwright 对生产构建产物执行端到端测试时可设为 `true`，允许 `next start` 在无真实 PostgreSQL 时使用文件 store 测试替身；生产、预发和真实流量环境不得配置。
- `ZIWEI_ENABLE_SANDBOX_CHECKOUT_CONFIRM`：仅本地、自动化测试或受控预发环境可设为 `true`，允许 `/commercial/checkout-sandbox` 通过服务端确认 sandbox checkout 并触发权益发放。生产环境默认失败关闭，真实订单必须由微信支付/支付宝 webhook 验签回调驱动；`/api/launch/config.sandbox_checkout_confirm` 会返回 `enabled`、`production_safe=false`、所需环境变量和生产禁用 blocker。
- `DATABASE_URL`：PostgreSQL 生产数据库连接串。正式上线必须配置，并执行 `npx prisma migrate deploy`。
- `DIRECT_DATABASE_URL`：生产迁移和应急维护使用的 PostgreSQL 直连连接串。
- `ZIWEI_BIRTH_DATA_ENCRYPTION_KEY`：出生日期、出生时间和地点写入 PostgreSQL `birth_profiles` 前使用的 AES-256-GCM 服务端密钥，至少 24 字符；`/api/launch/config.birth_data_encryption.ready=false` 时不得开放生产建盘。
- `TRUSTED_IDENTITY_HEADER_SECRET`：受保护网关或 BFF 注入 `x-trusted-visitor-id`、`x-trusted-member-id` 时使用的 HMAC 签名密钥。生产公开请求默认只信 HttpOnly cookie；未签名的 `x-member-id`、`x-visitor-id` 和 query 身份参数不会作为生产身份边界。
- `STRIPE_SECRET_KEY`：真实 Stripe secret key。只有 `sk_live_` 且生产开关开启时才进入 production provider mode。
- `STRIPE_WEBHOOK_SECRET`：Stripe webhook 签名密钥。
- `STRIPE_CHECKOUT_BASE_URL`：真实 checkout provider 跳转基地址。
- `PHASE10_PRODUCTION_PAYMENT_ENABLED`：设置为 `true` 后才允许生产支付模式。
- `PHASE10_PAYMENT_ROLLOUT_PERCENT`：大于 `0` 才允许生产支付放量。
- `PHASE10_PAYMENT_ROLLBACK`：设置为 `true` 时强制回退 sandbox。
- `PHASE10_MAX_PRODUCTION_AMOUNT_CENTS`：生产支付最大金额保护。
- `MOCK_PAYMENT_WEBHOOK_SECRET`：mock checkout provider 的 webhook 签名密钥。
- `WECHAT_PAY_MCH_ID`、`WECHAT_PAY_APP_ID`、`WECHAT_PAY_API_V3_KEY`、`WECHAT_PAY_MERCHANT_CERT_SERIAL`、`WECHAT_PAY_PRIVATE_KEY`、`WECHAT_PAY_PLATFORM_CERT`、`WECHAT_PAY_PLATFORM_CERT_SERIAL`、`WECHAT_PAY_NOTIFY_URL`、`WECHAT_PAY_CHECKOUT_BASE_URL`：微信支付生产商户、证书、平台证书序列号、回调和 checkout 配置；缺失时 `/api/launch/config.china_payment_providers.wechat_pay.ready=false`，公开购买只允许沙箱接入验证。`WECHAT_PAY_MERCHANT_SERIAL_NO`、`WECHAT_PAY_PLATFORM_CERTIFICATE` 等旧变量名不会启用生产 checkout，避免配置漂移绕过上线门禁。
- `ALIPAY_APP_ID`、`ALIPAY_PRIVATE_KEY`、`ALIPAY_PUBLIC_KEY`、`ALIPAY_GATEWAY_URL`、`ALIPAY_NOTIFY_URL`、`ALIPAY_CHECKOUT_BASE_URL`：支付宝生产应用、密钥、网关、回调和 checkout 配置；缺失时 `/api/launch/config.china_payment_providers.alipay.ready=false`，公开购买只允许沙箱接入验证。
- 微信支付生产回调会读取标准 `Wechatpay-Timestamp`、`Wechatpay-Nonce`、`Wechatpay-Serial`、`Wechatpay-Signature` header，使用 `WECHAT_PAY_PLATFORM_CERT` 做 RSA-SHA256 验签，并校验 `WECHAT_PAY_PLATFORM_CERT_SERIAL` 与 5 分钟时间窗；支付宝生产异步通知按表单参数排序、排除 `sign`/`sign_type` 后使用 `ALIPAY_PUBLIC_KEY` 做 RSA2 验签。现有 `t=...,v1=...` HMAC 只用于 mock provider 和沙箱接入验证。
- 微信支付和支付宝退款会生成 provider refund request envelope，记录 endpoint、幂等 key、签名算法、payload digest、所需环境变量和外部配置状态，并持久化到 `refunds.provider_refund_request_json`；该记录不保存原始出生资料、手机号、第三方身份明文、完整报告、商户私钥或 API v3 key。缺少真实商户资质时 `submission_status=external_configuration_required`，不得把后台退款标记等同于真实资金已原路退回。
- `/api/ops/reconciliation/preview` 和 `/api/ops/reconciliation/import` 仅允许 `ops_admin` 处理 provider statement。preview 只做预检，返回 `persistence.persisted=false`、`audit_written=false` 和 `raw_reference_storage=digest_only`，不会写入 `provider_statements` 或导入审计；import 才写入 `provider_statements`，保留 provider transaction id、order/refund id、金额、时间和可选 raw reference digest。两个接口均支持结构化 `rows` 和 CSV `csv` 字段，CSV 会在服务端识别微信/支付宝常见表头别名、元/分金额与支付/退款时间；每次正式导入会写入 `audit_logs` 的 `ops_provider_statement_imported` 记录，metadata 只含 statement、provider、行数、差异计数和 `raw_reference_storage=digest_only`。`/api/ops/reconciliation` 和内部商业后台会返回/展示 statement 摘要、匹配行数、金额不一致、孤儿流水差异和脱敏 Payment Alerts，不返回原始账单备注、联系人、出生资料或报告正文。
- `/api/ops/rule-profiles`、`/api/ops/rule-profiles/[id]`、`/api/ops/chart/compare-rules`、`/api/ops/knowledge/search` 和 `/api/ops/knowledge/node/[id]` 允许 `ops_admin`、`support_agent`、`content_reviewer` 查看规则治理和知识图谱工具；`/api/ops/rule-profiles/default` 只允许 `ops_admin`，请求体必须包含 `profile_id`、`reason` 和 `second_confirmed=true`。服务端会拒绝未顾问确认的实验规则，成功后写入 `rule_versions.active_default` 与 `ops_rule_profile_promoted` 审计。
- `/api/ops/synastry/create` 和 `/api/ops/timeline/interpret` 允许后台角色使用 Phase 7 合盘/年度主题扩展工具；响应继续隐藏完整出生日期、出生时间和地点。旧公开 `/api/synastry/create`、`/api/timeline/interpret` 不再挂载，正式大众产品不暴露该内部扩展 API。
- `PHASE10_ADMIN_TOKEN`：运营和客服后台 token。
- `PHASE10_OPS_MFA_ENABLED`、`PHASE10_OPS_MFA_CODE`：运营后台第二因子门禁。生产应设置 `PHASE10_OPS_MFA_ENABLED=true`，并由反向代理、BFF 或内部网关注入 `x-admin-mfa-code`；开启后缺失或错误第二因子会拒绝所有 ops API 和 `/internal/*` 页面，`/api/launch/config.ops_security` 会暴露 readiness。
- `ZIWEI_RATE_LIMIT_REDIS_REQUIRED`：设置为 `true` 后要求生产写接口使用 Redis REST 限流；缺少 Redis 配置时写接口返回 `RATE_LIMIT_REDIS_NOT_CONFIGURED`，不得正式放量。
- `ZIWEI_RATE_LIMIT_REDIS_REST_URL`、`ZIWEI_RATE_LIMIT_REDIS_REST_TOKEN`：生产 Redis/Upstash REST 限流配置。限流 key 会在服务端 SHA-256 哈希，不把 visitor/member/path 原文写入 Redis key。
- `ZIWEI_EXPORT_STORAGE_REQUIRED`：设置为 `true` 后要求报告导出预览使用生产对象存储；缺少对象存储配置时返回 `EXPORT_STORAGE_NOT_CONFIGURED`，不得开放生产导出。
- `ZIWEI_EXPORT_STORAGE_ENDPOINT`、`ZIWEI_EXPORT_STORAGE_BUCKET`、`ZIWEI_EXPORT_STORAGE_ACCESS_KEY_ID`、`ZIWEI_EXPORT_STORAGE_SECRET_ACCESS_KEY`、`ZIWEI_EXPORT_STORAGE_PUBLIC_BASE_URL`：S3/OSS/COS 兼容导出存储配置。密钥只在服务端使用，`/api/launch/config.export_storage` 只暴露 readiness，不返回 secret。
- `ZIWEI_DISABLED_CHANNELS`：逗号分隔的渠道暂停列表，例如 `short_video,qr_event`。服务端会在 `/api/channel/entry`、`/api/share/create` 的渠道分享路径和 `/api/growth/channel-event` 写入前拒绝暂停渠道，返回 `CHANNEL_DISABLED`；`/api/ops/growth/channel-dashboard` 仍会返回 `disabled_channels` 和聚合 `channel_health`，用于授权运营复盘。公开渠道 URL 必须落到 `/chart/new` 或 `/share/[id]`，不得携带 `visitor_id` 或内部阶段路径。
- `OBS_LOG_SINK`、`OBS_METRICS_ENDPOINT`、`OBS_ALERT_WEBHOOK_URL`、`OBS_ALERT_WEBHOOK_SECRET`、`OBS_TRACE_EXPORTER`、`OBS_BACKUP_HEALTHCHECK_URL`：生产日志、指标、告警 webhook、告警签名密钥、链路追踪和备份健康检查配置。未配置时 `/api/launch/config.observability.ready=false`，不得正式上线。`ops_admin` 可通过 `POST /api/ops/reconciliation/alerts` 生成并投递脱敏 Payment Alerts webhook envelope，携带幂等 key、endpoint digest 和 HMAC-SHA256 签名；响应只保留 HTTP status 与 response digest。`/internal/commercial/dashboard` 为 `ops_admin` 提供 dry-run/send 操作入口，浏览器请求体只携带 mode 与脱敏 reason，不携带管理员凭据、第三方身份明文、出生资料、webhook URL 或 secret；`support_agent` 只能查看对账和告警列表。未配置 URL 或 secret 时只返回 blocked/dry-run，不伪装外部平台已收到。
- `SMS_PROVIDER`、`SMS_ACCESS_KEY`、`SMS_TEMPLATE_ID`：手机号验证码登录 provider 配置。`mock_sms` 只能在测试/预发固定验证码场景使用；生产使用 `http_sms`，由受保护短信网关转接阿里云短信、腾讯云短信或等效服务商。
- `SMS_HTTP_ENDPOINT`、`SMS_HTTP_SIGNING_SECRET`：`SMS_PROVIDER=http_sms` 时必填。服务端会把手机号、验证码、模板和 nonce 发送到该 HTTPS 网关，并使用 `x-ziwei-sms-signature: sha256=<hmac>` 签名；网关失败时验证码接口失败关闭，不保存可用挑战。
- `SMS_TEST_FIXED_CODE`：仅 `SMS_PROVIDER=mock_sms` 时用于自动化测试的固定 6 位验证码，生产不得配置为对外可用登录方式。
- `WECHAT_APP_ID`、`WECHAT_APP_SECRET`：微信网页登录/授权 provider 配置。
- `WECHAT_JS_SDK_APP_ID`、`WECHAT_JS_SDK_TICKET`、`WECHAT_JS_SDK_ENABLED`：微信 H5 JS-SDK 分享签名配置。`WECHAT_JS_SDK_ENABLED=true` 且 `/api/launch/config.wechat_share.ready=true` 后，`/api/wechat/jssdk?url=<同源绝对URL>&share_id=<share_id>` 才会返回签名配置；`jsapi_ticket` 只在服务端使用。
- `SESSION_SECRET`：正式登录 session 签名密钥，至少 24 字符。未配置时 `/api/launch/config` 会提示登录 provider 未就绪；配置后 visitor/member cookie 会被 HMAC-SHA256 签名并在服务端验签。

## 数据边界

当前文件型 repository 适配层只适合开发、自动化测试和应急导出，不是最终生产数据库。生产数据库交付物位于 `prisma/schema.prisma`、`prisma/migrations/20260525000100_china_market_delivery/migration.sql` 和 Prisma repository adapter；生产部署应执行 `npx prisma generate` 与 `npx prisma migrate deploy`，配置 PostgreSQL `DATABASE_URL` 后 `src/repositories/prismaClient.ts` 会在服务端自动实例化生成的 Prisma Client。当前生产 adapter 已覆盖命盘主体、出生资料、命盘归属、用户、匿名访客、匿名绑定、短信验证码挑战、分享快照、客服工单、删除申请、运营漏斗事件、订单、checkout、支付事件、provider 对账单、权益、退款、报告草稿/版本、报告生成任务、导出预览、AI 生成记录和内容审核记录；`scripts/migrate-phase-store-to-postgres.ts` 支持主要文件 bucket 的 dry-run 与导入。出生日期、出生时间和地点写入 `birth_profiles` 前使用 `ZIWEI_BIRTH_DATA_ENCRYPTION_KEY` 派生的 AES-256-GCM 密钥加密，`/api/launch/config` 会暴露 PostgreSQL readiness、出生资料加密 readiness 和缺失配置。迁移时应保持记录模型和权限边界不变：用户只能读取自己的命盘、报告、订单和权益；分享页只读取脱敏快照；客服和后台默认脱敏敏感字段。

更完整的部署、迁移、备份、回滚、监控和告警说明见 [生产部署与运维手册](docs/生产部署与运维手册.md)。
## 合规边界

所有命盘、解读和报告内容仅供娱乐、自我观察和传统文化体验参考，不作为医疗、投资、法律、婚恋或其他专业决策依据。内容生成、报告导出和公开分享必须避免确定性命运判断、灾祸预测、恐吓语言和高风险建议。
