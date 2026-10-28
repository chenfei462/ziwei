import { productRepository } from "./repositories/productRepository.js";
import type { AnonymousLinkResponse } from "./types.js";

export async function persistAnonymousMemberLink(linked: AnonymousLinkResponse): Promise<void> {
  await productRepository.saveUserAsync(linked.user);
  await productRepository.saveAnonymousVisitorAsync(linked.visitor);
  await productRepository.saveAnonymousLinkAsync(linked.link);

  for (const chartId of linked.migrated.chart_ids) {
    const owner = await productRepository.getChartOwnerAsync(chartId);
    await productRepository.saveChartOwnerAsync({
      chart_id: chartId,
      member_id: linked.user.member_id,
      created_at: owner?.created_at ?? new Date().toISOString()
    });
  }
}

export function persistAnonymousMemberLinkSync(linked: AnonymousLinkResponse): void {
  productRepository.saveUser(linked.user);
  productRepository.saveAnonymousVisitor(linked.visitor);
  productRepository.saveAnonymousLink(linked.link);

  for (const chartId of linked.migrated.chart_ids) {
    const owner = productRepository.getChartOwner(chartId);
    productRepository.saveChartOwner({
      chart_id: chartId,
      member_id: linked.user.member_id,
      created_at: owner?.created_at ?? new Date().toISOString()
    });
  }
}
