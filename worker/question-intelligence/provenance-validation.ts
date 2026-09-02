import type { GameDefinition, GameItem, GenerationProvenance } from "../../shared/game";
import { verifyValidationReceipt } from "../security/provenance";

function unsignedItem(value: GameItem): Record<string, unknown> {
  const { generationProvenance: _provenance, ...unsigned } = value as GameItem & {
    generationProvenance?: GenerationProvenance;
  };
  return unsigned as Record<string, unknown>;
}

async function valid(
  item: GameItem,
  provenance: GenerationProvenance,
  key: string | undefined,
): Promise<boolean> {
  if (!key || !item.scriptureEvidence) return false;
  return verifyValidationReceipt(
    key,
    {
      proposedItem: unsignedItem(item),
      evidence: item.scriptureEvidence,
      model: provenance.model,
      promptVersion: provenance.promptVersion,
      strategyVersion: provenance.strategyVersion,
    },
    provenance.validationReceipt,
  );
}

export async function sanitizeGenerationProvenance(
  game: GameDefinition,
  signingKey: string | undefined,
): Promise<GameDefinition> {
  const next = structuredClone(game);
  for (const item of next.items) {
    if (item.generationProvenance && !(await valid(item, item.generationProvenance, signingKey))) {
      delete item.generationProvenance;
    }
    if (item.type === "CROSSWORD") {
      for (const row of item.horizontalRows) {
        // Row-level provenance is not independently signed in v1. Preserve the valid question,
        // but downgrade unsupported provenance rather than rejecting a manually editable row.
        if (row.generationProvenance) delete row.generationProvenance;
      }
    }
  }
  return next;
}
