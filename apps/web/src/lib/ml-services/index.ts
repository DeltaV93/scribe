/**
 * ML Services Client
 *
 * Usage:
 * ```ts
 * import mlServices from "@/lib/ml-services";
 *
 * // List models
 * const { items } = await mlServices.models.list();
 *
 * // Create a model
 * const model = await mlServices.models.create({
 *   name: "extraction-v1",
 *   model_type: "extraction",
 * });
 *
 * // Get privacy budget
 * const budget = await mlServices.orgProfile.getPrivacyBudget(orgId);
 * ```
 */

export * from "./types";
export * from "./client";
export { default } from "./client";
