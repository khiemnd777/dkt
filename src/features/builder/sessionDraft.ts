import type { GameDefinition } from "@shared/game";
import { builderDraftSchema } from "./gameConfig";

export const BUILDER_DRAFT_KEY = "dkt:builder-draft:v1";
export const BUILDER_SELECTED_ITEM_KEY = "dkt:builder-selected-item:v1";

export function loadBuilderDraft(): GameDefinition | undefined {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(BUILDER_DRAFT_KEY) ?? "null");
    const result = builderDraftSchema.safeParse(value);
    return result.success ? result.data : undefined;
  } catch {
    return undefined;
  }
}

export function loadBuilderSelectedItemId(): string | undefined {
  try {
    return sessionStorage.getItem(BUILDER_SELECTED_ITEM_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}
