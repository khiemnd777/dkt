export type GameMode = "TURN_BASED" | "SPEED_RACE";
export type GameItemType =
  | "SINGLE_CHOICE"
  | "MULTIPLE_CHOICE"
  | "TRUE_FALSE"
  | "SHORT_ANSWER"
  | "CROSSWORD";

export type QuestionMediaKind = "IMAGE" | "AUDIO";

export interface QuestionMediaRights {
  source: "USER_UPLOAD" | "APP_OWNED";
  attestedByHost: boolean;
  attribution?: string;
}

export interface QuestionMediaRef {
  assetId: string;
  kind: QuestionMediaKind;
  mimeType: "image/jpeg" | "image/png" | "image/webp" | "audio/mpeg";
  sha256: string;
  byteSize: number;
  accessibilityText: string;
  width?: number;
  height?: number;
  durationMs?: number;
  rights: QuestionMediaRights;
}

export interface QuestionPresentation {
  media?: QuestionMediaRef;
}

export type PublicQuestionMedia = Pick<
  QuestionMediaRef,
  | "assetId"
  | "kind"
  | "mimeType"
  | "byteSize"
  | "accessibilityText"
  | "width"
  | "height"
  | "durationMs"
> & { deliveryUrl?: string };

export interface BuilderMediaHandle {
  media: QuestionMediaRef;
  readCapability: string;
  deleteCapability: string;
  expiresAt: string;
}

export interface ScriptureEvidenceMetadata {
  provider: "youversion";
  bibleVersionId: number;
  versionAbbreviation: string;
  passageId: string;
  evidencePassageIds: string[];
  localizedReference: string;
  attribution: string;
  sourceContentSha256: string;
  containsExactQuotation: boolean;
}

export interface GenerationProvenance {
  source: "AI_ASSISTED";
  provider: "openai";
  model: string;
  promptVersion: string;
  strategyVersion: string;
  generatedAt: string;
  validatedAt: string;
  humanApprovedAt: string;
  confidence: number;
  validationReceipt?: string;
}

export interface BaseGameItem {
  id: string;
  durationSec?: number;
  bibleReference?: string;
  explanation?: string;
  presentation?: QuestionPresentation;
  scriptureEvidence?: ScriptureEvidenceMetadata;
  generationProvenance?: GenerationProvenance;
}

export interface ChoiceOption {
  id: string;
  text: string;
}

export interface SingleChoiceItem extends BaseGameItem {
  type: "SINGLE_CHOICE";
  prompt: string;
  options: ChoiceOption[];
  correctOptionId: string;
}

export interface MultipleChoiceItem extends BaseGameItem {
  type: "MULTIPLE_CHOICE";
  prompt: string;
  options: ChoiceOption[];
  correctOptionIds: string[];
}

export interface TrueFalseItem extends BaseGameItem {
  type: "TRUE_FALSE";
  statement: string;
  correctValue: boolean;
}

export interface ShortAnswerItem extends BaseGameItem {
  type: "SHORT_ANSWER";
  prompt: string;
  canonicalAnswer: string;
  acceptedAliases: string[];
}

export interface CrosswordRow {
  id: string;
  clue: string;
  answer: string;
  acceptedAliases: string[];
  specialCellIndex: number;
  bibleReference?: string;
  explanation?: string;
  presentation?: QuestionPresentation;
  scriptureEvidence?: ScriptureEvidenceMetadata;
  generationProvenance?: GenerationProvenance;
}

export interface CrosswordItem {
  id: string;
  type: "CROSSWORD";
  title: string;
  horizontalDurationSec: number;
  verticalDurationSec?: number;
  verticalClue: string;
  verticalAnswer: string;
  horizontalRows: CrosswordRow[];
  bibleReference?: string;
  explanation?: string;
  presentation?: QuestionPresentation;
  scriptureEvidence?: ScriptureEvidenceMetadata;
  generationProvenance?: GenerationProvenance;
}

export type GameItem =
  | SingleChoiceItem
  | MultipleChoiceItem
  | TrueFalseItem
  | ShortAnswerItem
  | CrosswordItem;

export interface GameDefinition {
  title: string;
  mode: GameMode;
  defaultDurationSec: number;
  items: GameItem[];
  createdClientVersion: string;
}

export type RuntimeRoundKind =
  | "SINGLE_CHOICE"
  | "MULTIPLE_CHOICE"
  | "TRUE_FALSE"
  | "SHORT_ANSWER"
  | "CROSSWORD_HORIZONTAL";

export interface RuntimeRound {
  roundId: string;
  itemId: string;
  groupId?: string;
  index: number;
  kind: RuntimeRoundKind;
  publicPayload: {
    prompt: string;
    options?: ChoiceOption[];
    media?: PublicQuestionMedia;
    crossword?: {
      title: string;
      rowIndex: number;
      rowCount: number;
      rows: Array<{ id: string; cellCount: number; specialCellIndex: number }>;
      verticalClue?: string;
    };
  };
  privateAnswer:
    | { type: "OPTION"; optionId: string }
    | { type: "OPTIONS"; optionIds: string[] }
    | { type: "BOOLEAN"; value: boolean }
    | { type: "TEXT"; acceptedNormalized: string[] };
  durationSec: number;
  scoreMultiplier: number;
  revealPayload: {
    answer: string;
    bibleReference?: string;
    explanation?: string;
    crosswordRowId?: string;
    specialLetter?: string;
    mediaAccessibilityText?: string;
    mediaAttribution?: string;
  };
}

export type PlayerAnswer =
  | { type: "OPTION"; optionId: string }
  | { type: "OPTIONS"; optionIds: string[] }
  | { type: "BOOLEAN"; value: boolean }
  | { type: "TEXT"; value: string };
