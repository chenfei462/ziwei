import { PrismaClient } from "@prisma/client";
import type { PrismaProductClient } from "./productRepository.js";

const globalPrisma = globalThis as typeof globalThis & {
  __ziweiPrismaClient?: PrismaClient;
};

export function getPrismaProductClient(): PrismaProductClient | undefined {
  if (!process.env.DATABASE_URL) return undefined;
  globalPrisma.__ziweiPrismaClient ??= new PrismaClient();
  return adaptPrismaProductClient(globalPrisma.__ziweiPrismaClient);
}

function adaptPrismaProductClient(client: PrismaClient): PrismaProductClient {
  return {
    birthProfile: getPrismaDelegate<PrismaProductClient["birthProfile"]>(client, "birthProfile"),
    chart: getPrismaDelegate<PrismaProductClient["chart"]>(client, "chart"),
    chartOwner: getPrismaDelegate<PrismaProductClient["chartOwner"]>(client, "chartOwner"),
    analyticsEvent: getPrismaDelegate<PrismaProductClient["analyticsEvent"]>(client, "analyticsEvent"),
    auditLog: getPrismaDelegate<PrismaProductClient["auditLog"]>(client, "auditLog"),
    ruleVersion: getPrismaDelegate<PrismaProductClient["ruleVersion"]>(client, "ruleVersion"),
    user: getPrismaDelegate<PrismaProductClient["user"]>(client, "user"),
    anonymousVisitor: getPrismaDelegate<PrismaProductClient["anonymousVisitor"]>(client, "anonymousVisitor"),
    anonymousLink: getPrismaDelegate<PrismaProductClient["anonymousLink"]>(client, "anonymousLink"),
    smsVerificationChallenge: getPrismaDelegate<PrismaProductClient["smsVerificationChallenge"]>(client, "smsVerificationChallenge"),
    share: getPrismaDelegate<PrismaProductClient["share"]>(client, "share"),
    supportTicket: getPrismaDelegate<PrismaProductClient["supportTicket"]>(client, "supportTicket"),
    dataDeletionRequest: getPrismaDelegate<PrismaProductClient["dataDeletionRequest"]>(client, "dataDeletionRequest"),
    wechatOpenIdBinding: getPrismaDelegate<PrismaProductClient["wechatOpenIdBinding"]>(client, "wechatOpenIdBinding"),
    order: getPrismaDelegate<PrismaProductClient["order"]>(client, "order"),
    checkoutSession: getPrismaDelegate<PrismaProductClient["checkoutSession"]>(client, "checkoutSession"),
    paymentEvent: getPrismaDelegate<PrismaProductClient["paymentEvent"]>(client, "paymentEvent"),
    providerStatement: getPrismaDelegate<PrismaProductClient["providerStatement"]>(client, "providerStatement"),
    refund: getPrismaDelegate<PrismaProductClient["refund"]>(client, "refund"),
    entitlement: getPrismaDelegate<PrismaProductClient["entitlement"]>(client, "entitlement"),
    report: getPrismaDelegate<PrismaProductClient["report"]>(client, "report"),
    reportVersion: getPrismaDelegate<PrismaProductClient["reportVersion"]>(client, "reportVersion"),
    reportGenerationJob: getPrismaDelegate<PrismaProductClient["reportGenerationJob"]>(client, "reportGenerationJob"),
    exportPreview: getPrismaDelegate<PrismaProductClient["exportPreview"]>(client, "exportPreview"),
    aiGenerationLog: getPrismaDelegate<PrismaProductClient["aiGenerationLog"]>(client, "aiGenerationLog"),
    followUpQuota: getPrismaDelegate<PrismaProductClient["followUpQuota"]>(client, "followUpQuota"),
    contentReviewRecord: getPrismaDelegate<PrismaProductClient["contentReviewRecord"]>(client, "contentReviewRecord")
  };
}

function getPrismaDelegate<T>(client: PrismaClient, key: keyof PrismaProductClient): T {
  const delegate = (client as unknown as Record<keyof PrismaProductClient, unknown>)[key];
  if (delegate) return delegate as T;

  return new Proxy({} as Record<PropertyKey, unknown>, {
    get(_target, property) {
      if (property === "then") return undefined;
      return () => {
        throw new Error(`Prisma client is missing "${String(key)}"; run prisma generate after applying prisma/schema.prisma.`);
      };
    }
  }) as T;
}
