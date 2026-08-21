export type GameMode = "TURN_BASED" | "SPEED_RACE";
export type GameItemType = "SINGLE_CHOICE" | "TRUE_FALSE" | "SHORT_ANSWER" | "CROSSWORD";

export interface BaseGameItem {
  id: string;
  durationSec?: number;
  bibleReference?: string;
  explanation?: string;
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
}

export type GameItem = SingleChoiceItem | TrueFalseItem | ShortAnswerItem | CrosswordItem;

export interface GameDefinition {
  title: string;
  mode: GameMode;
  defaultDurationSec: number;
  items: GameItem[];
  createdClientVersion: string;
}

export type RuntimeRoundKind =
  | "SINGLE_CHOICE"
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
  };
}

export type PlayerAnswer =
  | { type: "OPTION"; optionId: string }
  | { type: "BOOLEAN"; value: boolean }
  | { type: "TEXT"; value: string };
