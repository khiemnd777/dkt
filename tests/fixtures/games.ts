import type { GameDefinition } from "../../shared/game";

export const smallGame: GameDefinition = {
  title: "Vua Đa-vít",
  mode: "TURN_BASED",
  defaultDurationSec: 20,
  createdClientVersion: "test",
  items: [
    {
      id: "choice-1",
      type: "SINGLE_CHOICE",
      prompt: "Ai đã đánh bại Gô-li-át?",
      options: [
        { id: "david", text: "Đa-vít" },
        { id: "moses", text: "Môi-se" },
      ],
      correctOptionId: "david",
    },
    {
      id: "short-1",
      type: "SHORT_ANSWER",
      prompt: "Tên người đánh bại Gô-li-át?",
      canonicalAnswer: "Đa-vít",
      acceptedAliases: ["David"],
    },
  ],
};

export const crosswordGame: GameDefinition = {
  title: "Ô chữ Đức Tin",
  mode: "SPEED_RACE",
  defaultDurationSec: 20,
  createdClientVersion: "test",
  items: [
    {
      id: "crossword-1",
      type: "CROSSWORD",
      title: "Nhân vật Kinh Thánh",
      horizontalDurationSec: 20,
      verticalClue: "Điều còn lại lớn nhất?",
      verticalAnswer: "TIN",
      horizontalRows: [
        {
          id: "r1",
          clue: "Môn đồ nghi ngờ",
          answer: "TÔ-MA",
          acceptedAliases: [],
          specialCellIndex: 0,
        },
        {
          id: "r2",
          clue: "Con trai của Áp-ra-ham",
          answer: "I-SÁC",
          acceptedAliases: [],
          specialCellIndex: 0,
        },
        {
          id: "r3",
          clue: "Người đóng tàu",
          answer: "NÔ-Ê",
          acceptedAliases: [],
          specialCellIndex: 0,
        },
      ],
    },
  ],
};

export const multipleChoiceGame: GameDefinition = {
  title: "Gia đình Nô-ê",
  mode: "TURN_BASED",
  defaultDurationSec: 20,
  createdClientVersion: "test",
  items: [
    {
      id: "multiple-1",
      type: "MULTIPLE_CHOICE",
      prompt: "Những ai là con trai của Nô-ê?",
      options: [
        { id: "shem", text: "Sem" },
        { id: "ham", text: "Cham" },
        { id: "abraham", text: "Áp-ra-ham" },
      ],
      correctOptionIds: ["shem", "ham"],
    },
  ],
};
