import type { GameItem, GameItemType, QuestionMediaRef, ScriptureEvidenceMetadata } from "./game";
import type { ScriptureReference } from "./scripture";

export type CandidateState = "GENERATED" | "VALIDATED" | "NEEDS_REVIEW" | "REJECTED";
export type CandidateDifficulty = "EASY" | "MEDIUM" | "HARD";

export interface CandidateValidationCheck {
  code: string;
  kind: "DETERMINISTIC" | "AI_ASSISTED";
  outcome: "PASS" | "WARN" | "FAIL";
  message: string;
}

export interface QuestionCandidateEnvelope {
  schemaVersion: 1;
  candidateId: string;
  state: CandidateState;
  type: GameItemType;
  proposedItem: GameItem;
  media?: QuestionMediaRef;
  evidence: ScriptureEvidenceMetadata;
  generation: {
    provider: "openai";
    model: string;
    responseId?: string;
    promptVersion: string;
    strategyVersion: string;
    generatedAt: string;
  };
  validation: {
    overall: "PASS" | "WARN" | "FAIL";
    checks: CandidateValidationCheck[];
  };
  difficulty: {
    label: CandidateDifficulty;
    score: number;
    reasons: string[];
  };
  confidence: number;
  validationReceipt?: string;
}

export interface QuestionSuggestionsResponse {
  requestId: string;
  scope: Pick<ScriptureReference, "bibleVersionId" | "passageId">;
  version: { abbreviation: string; attribution: string };
  candidates: QuestionCandidateEnvelope[];
  rejectedCount: number;
  warnings: string[];
  usage: { candidateCount: number };
}
