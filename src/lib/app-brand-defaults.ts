import { AppBrandDataSchema, type AppBrandData } from "@/types/project";

export function createDefaultAppBrandData(partial?: Partial<AppBrandData>): AppBrandData {
  return AppBrandDataSchema.parse(partial ?? {});
}
