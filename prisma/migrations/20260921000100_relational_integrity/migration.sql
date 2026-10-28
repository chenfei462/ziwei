-- Relational integrity hardening for the core ownership and payment graph.
-- Constraints are initially NOT VALID so deploys can inventory legacy orphans;
-- run VALIDATE CONSTRAINT after the orphan remediation job has completed.
ALTER TABLE "identities"
  ADD CONSTRAINT "identities_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "users"("member_id") ON DELETE CASCADE NOT VALID;
ALTER TABLE "birth_profiles"
  ADD CONSTRAINT "birth_profiles_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "users"("member_id") ON DELETE CASCADE NOT VALID;
ALTER TABLE "charts"
  ADD CONSTRAINT "charts_birth_profile_id_fkey" FOREIGN KEY ("birth_profile_id") REFERENCES "birth_profiles"("birth_profile_id") ON DELETE CASCADE NOT VALID;
ALTER TABLE "reports"
  ADD CONSTRAINT "reports_chart_id_fkey" FOREIGN KEY ("chart_id") REFERENCES "charts"("chart_id") ON DELETE SET NULL NOT VALID;
ALTER TABLE "reports"
  ADD CONSTRAINT "reports_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "users"("member_id") ON DELETE SET NULL NOT VALID;
ALTER TABLE "report_versions"
  ADD CONSTRAINT "report_versions_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("report_id") ON DELETE CASCADE NOT VALID;
ALTER TABLE "orders"
  ADD CONSTRAINT "orders_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "users"("member_id") ON DELETE RESTRICT NOT VALID;
ALTER TABLE "orders"
  ADD CONSTRAINT "orders_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("report_id") ON DELETE RESTRICT NOT VALID;
ALTER TABLE "checkout_sessions"
  ADD CONSTRAINT "checkout_sessions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("order_id") ON DELETE CASCADE NOT VALID;
ALTER TABLE "payment_events"
  ADD CONSTRAINT "payment_events_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("order_id") ON DELETE SET NULL NOT VALID;
ALTER TABLE "entitlements"
  ADD CONSTRAINT "entitlements_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "users"("member_id") ON DELETE CASCADE NOT VALID;
ALTER TABLE "entitlements"
  ADD CONSTRAINT "entitlements_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("report_id") ON DELETE CASCADE NOT VALID;
ALTER TABLE "entitlements"
  ADD CONSTRAINT "entitlements_source_order_id_fkey" FOREIGN KEY ("source_order_id") REFERENCES "orders"("order_id") ON DELETE RESTRICT NOT VALID;
ALTER TABLE "refunds"
  ADD CONSTRAINT "refunds_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("order_id") ON DELETE RESTRICT NOT VALID;
