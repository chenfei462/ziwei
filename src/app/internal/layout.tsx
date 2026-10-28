import type { Metadata } from "next";
import { headers } from "next/headers.js";
import type { ReactNode } from "react";
import { getConfiguredOpsToken } from "../../phase10/launchOps.js";
const OPS_TOKEN_ENV = "PHASE10_ADMIN_TOKEN";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true
  },
  other: {
    "x-robots-tag": "noindex,nofollow,noarchive"
  }
};

export default async function InternalLayout({ children }: Readonly<{ children: ReactNode }>) {
  const headerStore = await headers();
  const token = headerStore.get("x-admin-token") ?? "";
  const configuredRole = process.env.PHASE10_ADMIN_ROLE?.trim();
  const role = process.env.NODE_ENV === "test"
    ? headerStore.get("x-admin-role") ?? ""
    : configuredRole && ["ops_admin", "support_agent", "content_reviewer"].includes(configuredRole)
      ? configuredRole
      : "";
  const mfaCode = headerStore.get("x-admin-mfa-code") ?? "";
  const allowedRoles = new Set(["ops_admin", "support_agent", "content_reviewer"]);
  const mfaEnabled = process.env.PHASE10_OPS_MFA_ENABLED === "true";
  const configuredMfaCode = process.env.PHASE10_OPS_MFA_CODE?.trim() ?? "";
  const mfaAllowed = !mfaEnabled || (configuredMfaCode.length > 0 && mfaCode === configuredMfaCode);

  if (!getConfiguredOpsToken() || token !== getConfiguredOpsToken() || !allowedRoles.has(role) || !mfaAllowed) {
    return (
      <main className="public-page">
        <section className="public-note">
          <h1>内部入口受保护</h1>
          <p>该页面仅允许授权运营、客服或内容审核人员访问。</p>
          <a href="/">回到首页</a>
        </section>
      </main>
    );
  }

  return children;
}
