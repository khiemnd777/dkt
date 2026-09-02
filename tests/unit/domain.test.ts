import { describe, expect, it } from "vitest";
import { crosswordItemSchema, multipleChoiceItemSchema } from "../../shared/schemas";
import { answerCells, normalizeAnswer } from "../../shared/text";
import { nextAlarmAt } from "../../worker/room/alarm-scheduler";
import { rankPlayers } from "../../worker/room/ranking";
import { compileGame } from "../../worker/room/round-compiler";
import {
  calculateCrosswordVerticalScore,
  calculateScore,
  isCorrectAnswer,
} from "../../worker/room/scoring";
import { filterRoundForPublic } from "../../worker/room/snapshot-filter";
import { assertTransition, canTransition } from "../../worker/room/state-machine";
import { crosswordGame, multipleChoiceGame, smallGame } from "../fixtures/games";

describe("Vietnamese answer normalization", () => {
  it.each(["Đa-vít", "Đa Vít", "ĐAVÍT", "da vit", "DAVIT"])("normalizes %s", (value) => {
    expect(normalizeAnswer(value)).toBe("DAVIT");
  });

  it("maps Đ, removes punctuation and combining marks", () => {
    expect(normalizeAnswer("  ĐỨC, TIN! ")).toBe("DUCTIN");
  });

  it("keeps accented graphemes intact in display cells", () => {
    expect(answerCells("ĐA-VÍT")).toEqual(["Đ", "A", "V", "Í", "T"]);
  });
});

describe("round evaluation and scoring", () => {
  const rounds = compileGame(smallGame);

  it("evaluates single choice and exact normalized aliases", () => {
    expect(isCorrectAnswer(rounds[0], { type: "OPTION", optionId: "david" })).toBe(true);
    expect(isCorrectAnswer(rounds[0], { type: "OPTION", optionId: "moses" })).toBe(false);
    expect(isCorrectAnswer(rounds[1], { type: "TEXT", value: "ĐA VÍT" })).toBe(true);
    expect(isCorrectAnswer(rounds[1], { type: "TEXT", value: "Đa-vị" })).toBe(false);
  });

  it("evaluates true/false without accepting a mismatched answer type", () => {
    const definition = structuredClone(smallGame);
    definition.items = [
      { id: "truth-1", type: "TRUE_FALSE", statement: "Nô-ê đã đóng tàu.", correctValue: true },
    ];
    const round = compileGame(definition)[0];
    expect(isCorrectAnswer(round, { type: "BOOLEAN", value: true })).toBe(true);
    expect(isCorrectAnswer(round, { type: "BOOLEAN", value: false })).toBe(false);
    expect(isCorrectAnswer(round, { type: "TEXT", value: "Đúng" })).toBe(false);
  });

  it("scores MULTIPLE_CHOICE as an exact unordered set without duplicates", () => {
    const round = compileGame(multipleChoiceGame)[0];
    expect(round.kind).toBe("MULTIPLE_CHOICE");
    expect(isCorrectAnswer(round, { type: "OPTIONS", optionIds: ["ham", "shem"] })).toBe(true);
    expect(isCorrectAnswer(round, { type: "OPTIONS", optionIds: ["shem"] })).toBe(false);
    expect(isCorrectAnswer(round, { type: "OPTIONS", optionIds: ["shem", "ham", "abraham"] })).toBe(
      false,
    );
    expect(isCorrectAnswer(round, { type: "OPTIONS", optionIds: ["shem", "shem"] })).toBe(false);
  });

  it("rejects invalid MULTIPLE_CHOICE answer cardinality", () => {
    const item = structuredClone(multipleChoiceGame.items[0]);
    if (item.type !== "MULTIPLE_CHOICE") throw new Error("fixture");
    item.correctOptionIds = ["shem"];
    expect(multipleChoiceItemSchema.safeParse(item).success).toBe(false);
    item.correctOptionIds = item.options.map((option) => option.id);
    expect(multipleChoiceItemSchema.safeParse(item).success).toBe(false);
  });

  it("filters private answers and pre-reveal payloads from public rounds", () => {
    const publicPayload = filterRoundForPublic(rounds[0]);
    const serialized = JSON.stringify(publicPayload);
    expect(serialized).not.toContain("privateAnswer");
    expect(serialized).not.toContain("correctOptionId");
    expect(serialized).not.toContain("revealPayload");
  });

  it("uses equal turn-based points regardless of speed", () => {
    expect(
      calculateScore({
        mode: "TURN_BASED",
        isCorrect: true,
        openedAt: 0,
        deadlineAt: 10_000,
        receivedAt: 10,
        multiplier: 1,
      }),
    ).toBe(1000);
    expect(
      calculateScore({
        mode: "TURN_BASED",
        isCorrect: true,
        openedAt: 0,
        deadlineAt: 10_000,
        receivedAt: 9_999,
        multiplier: 2,
      }),
    ).toBe(2000);
  });

  it("calculates speed score at opening, halfway, deadline, late and double-value", () => {
    expect(
      calculateScore({
        mode: "SPEED_RACE",
        isCorrect: true,
        openedAt: 0,
        deadlineAt: 10_000,
        receivedAt: 0,
        multiplier: 1,
      }),
    ).toBe(1000);
    expect(
      calculateScore({
        mode: "SPEED_RACE",
        isCorrect: true,
        openedAt: 0,
        deadlineAt: 10_000,
        receivedAt: 5_000,
        multiplier: 1,
      }),
    ).toBe(750);
    expect(
      calculateScore({
        mode: "SPEED_RACE",
        isCorrect: true,
        openedAt: 0,
        deadlineAt: 10_000,
        receivedAt: 10_000,
        multiplier: 1,
      }),
    ).toBe(500);
    expect(
      calculateScore({
        mode: "SPEED_RACE",
        isCorrect: true,
        openedAt: 0,
        deadlineAt: 10_000,
        receivedAt: 10_001,
        multiplier: 1,
      }),
    ).toBe(0);
    expect(
      calculateScore({
        mode: "SPEED_RACE",
        isCorrect: true,
        openedAt: 0,
        deadlineAt: 10_000,
        receivedAt: 5_000,
        multiplier: 2,
      }),
    ).toBe(1500);
  });

  it("decreases crossword vertical points as special cells are revealed", () => {
    expect(
      calculateCrosswordVerticalScore({ isCorrect: true, revealedCells: 0, totalCells: 3 }),
    ).toBe(2000);
    expect(
      calculateCrosswordVerticalScore({ isCorrect: true, revealedCells: 1, totalCells: 3 }),
    ).toBe(1330);
    expect(
      calculateCrosswordVerticalScore({ isCorrect: true, revealedCells: 2, totalCells: 3 }),
    ).toBe(670);
    expect(
      calculateCrosswordVerticalScore({ isCorrect: true, revealedCells: 3, totalCells: 3 }),
    ).toBe(0);
    expect(
      calculateCrosswordVerticalScore({ isCorrect: false, revealedCells: 0, totalCells: 3 }),
    ).toBe(0);
  });
});

describe("crossword compilation and validation", () => {
  it("flattens only horizontal rows and exposes the vertical clue for early guesses", () => {
    const rounds = compileGame(crosswordGame);
    expect(rounds).toHaveLength(3);
    expect(rounds.map((round) => round.kind)).toEqual([
      "CROSSWORD_HORIZONTAL",
      "CROSSWORD_HORIZONTAL",
      "CROSSWORD_HORIZONTAL",
    ]);
    expect(rounds[0].publicPayload.crossword?.verticalClue).toBe("Điều còn lại lớn nhất?");
  });

  it("rejects row count mismatch and invalid special cells", () => {
    const item = structuredClone(crosswordGame.items[0]);
    if (item.type !== "CROSSWORD") throw new Error("fixture");
    item.verticalAnswer = "TINH";
    expect(crosswordItemSchema.safeParse(item).success).toBe(false);
    item.verticalAnswer = "TIN";
    item.horizontalRows[0].specialCellIndex = 99;
    expect(crosswordItemSchema.safeParse(item).success).toBe(false);
  });
});

describe("ranking and state machine", () => {
  const players = [
    {
      playerId: "a",
      displayName: "A",
      avatarId: "🦁",
      totalScore: 1000,
      correctCount: 1,
      totalCorrectResponseMs: 500,
    },
    {
      playerId: "b",
      displayName: "B",
      avatarId: "🐑",
      totalScore: 1000,
      correctCount: 1,
      totalCorrectResponseMs: 500,
    },
    {
      playerId: "c",
      displayName: "C",
      avatarId: "🕊️",
      totalScore: 900,
      correctCount: 2,
      totalCorrectResponseMs: 200,
    },
  ];

  it("uses shared competition ranks", () => {
    expect(rankPlayers(players, "TURN_BASED").map(({ rank }) => rank)).toEqual([1, 1, 3]);
  });

  it("uses speed tie breakers", () => {
    const adjusted = players.map((player) => ({ ...player }));
    adjusted[1].correctCount = 2;
    expect(rankPlayers(adjusted, "SPEED_RACE")[0].playerId).toBe("b");
  });

  it("accepts only explicit transitions", () => {
    expect(canTransition("LOBBY", "COUNTDOWN")).toBe(true);
    expect(canTransition("QUESTION_OPEN", "QUESTION_PAUSED")).toBe(true);
    expect(canTransition("QUESTION_PAUSED", "QUESTION_OPEN")).toBe(true);
    expect(canTransition("QUESTION_PAUSED", "QUESTION_LOCKED")).toBe(false);
    expect(canTransition("LOBBY", "QUESTION_OPEN")).toBe(false);
    expect(() => assertTransition("QUESTION_OPEN", "FINISHED")).toThrow();
  });
});

describe("media preparation timing", () => {
  it("keeps media preparation outside the scored answer window", () => {
    expect(canTransition("COUNTDOWN", "MEDIA_PREPARE")).toBe(true);
    expect(canTransition("MEDIA_PREPARE", "QUESTION_OPEN")).toBe(true);
    expect(canTransition("MEDIA_PREPARE", "QUESTION_LOCKED")).toBe(false);
    const now = Date.now();
    expect(
      nextAlarmAt(
        {
          roomCode: "ABC234",
          status: "ACTIVE",
          createdAt: now,
          hardExpiresAt: now + 60_000,
          inactivityExpiresAt: now + 50_000,
          lastHostActivityAt: now,
          protocolVersion: 1,
          stateVersion: 1,
          sequence: 0,
        },
        {
          phase: "MEDIA_PREPARE",
          currentRoundIndex: 0,
          mediaStartAt: now,
          answerOpenedAt: now + 5_000,
          revealedRoundIds: [],
          nextAction: "WAIT_FOR_MEDIA",
        },
      ),
    ).toBe(now + 5_000);
  });

  it("waits for bounded host readiness before scheduling media playback", () => {
    const now = Date.now();
    expect(
      nextAlarmAt(
        {
          roomCode: "ABC234",
          status: "ACTIVE",
          createdAt: now,
          hardExpiresAt: now + 60_000,
          inactivityExpiresAt: now + 50_000,
          lastHostActivityAt: now,
          protocolVersion: 1,
          stateVersion: 1,
          sequence: 0,
        },
        {
          phase: "MEDIA_PREPARE",
          currentRoundIndex: 0,
          mediaReadyDeadlineAt: now + 10_000,
          revealedRoundIds: [],
          nextAction: "WAIT_FOR_MEDIA_READY",
        },
      ),
    ).toBe(now + 10_000);
  });
});
