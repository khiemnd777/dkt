import type { GameItem, GameItemType } from "@shared/game";

export function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function createItem(type: GameItemType): GameItem {
  const id = newId("item");
  if (type === "SINGLE_CHOICE") {
    const first = newId("option");
    return {
      id,
      type,
      prompt: "Ai đã đánh bại Gô-li-át?",
      options: [
        { id: first, text: "Đa-vít" },
        { id: newId("option"), text: "Môi-se" },
        { id: newId("option"), text: "Giô-suê" },
      ],
      correctOptionId: first,
    };
  }
  if (type === "TRUE_FALSE") {
    return { id, type, statement: "Nô-ê đã đóng một con tàu.", correctValue: true };
  }
  if (type === "SHORT_ANSWER") {
    return {
      id,
      type,
      prompt: "Ai đã đánh bại Gô-li-át?",
      canonicalAnswer: "Đa-vít",
      acceptedAliases: ["David"],
    };
  }
  return {
    id,
    type,
    title: "Nhân vật Kinh Thánh",
    horizontalDurationSec: 20,
    verticalClue: "Điều giúp chúng ta vững lòng nơi Chúa?",
    verticalAnswer: "TIN",
    horizontalRows: [
      {
        id: newId("row"),
        clue: "Môn đồ từng nghi ngờ",
        answer: "TÔ-MA",
        acceptedAliases: [],
        specialCellIndex: 0,
      },
      {
        id: newId("row"),
        clue: "Con trai của Áp-ra-ham",
        answer: "I-SÁC",
        acceptedAliases: [],
        specialCellIndex: 0,
      },
      {
        id: newId("row"),
        clue: "Người đóng tàu",
        answer: "NÔ-Ê",
        acceptedAliases: [],
        specialCellIndex: 0,
      },
    ],
  };
}

export function duplicateItem(item: GameItem): GameItem {
  const copy = structuredClone(item);
  copy.id = newId("item");
  if (copy.type === "SINGLE_CHOICE") {
    const idMap = new Map(copy.options.map((option) => [option.id, newId("option")]));
    copy.options = copy.options.map((option) => ({
      ...option,
      id: idMap.get(option.id) as string,
    }));
    copy.correctOptionId = idMap.get(copy.correctOptionId) as string;
  }
  if (copy.type === "CROSSWORD")
    copy.horizontalRows = copy.horizontalRows.map((row) => ({ ...row, id: newId("row") }));
  return copy;
}
