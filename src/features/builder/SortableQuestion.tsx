import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { GameItem } from "@shared/game";
import { gameItemSchema } from "@shared/schemas";
import { CheckCircle2, Copy, GripVertical, Trash2, TriangleAlert } from "lucide-react";

const labels: Record<GameItem["type"], string> = {
  SINGLE_CHOICE: "Chọn một đáp án",
  MULTIPLE_CHOICE: "Chọn nhiều đáp án",
  TRUE_FALSE: "Đúng / Sai",
  SHORT_ANSWER: "Trả lời ngắn",
  CROSSWORD: "Ô chữ Kinh Thánh",
};

function summary(item: GameItem): string {
  if (item.type === "TRUE_FALSE") return item.statement;
  if (item.type === "CROSSWORD") return item.title;
  return item.prompt;
}

export function SortableQuestion(props: {
  item: GameItem;
  index: number;
  selected: boolean;
  onSelect(): void;
  onDuplicate(): void;
  onDelete(): void;
}) {
  const sortable = useSortable({ id: props.item.id });
  const style = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
  };
  const valid = gameItemSchema.safeParse(props.item).success;
  return (
    <div
      ref={sortable.setNodeRef}
      style={style}
      className={`question-list-item ${props.selected ? "selected" : ""}`}
    >
      <button
        className="drag-handle"
        type="button"
        {...sortable.attributes}
        {...sortable.listeners}
        aria-label={`Kéo câu ${props.index + 1}`}
      >
        <GripVertical />
      </button>
      <button className="question-select" type="button" onClick={props.onSelect}>
        <span className="question-number">{props.index + 1}</span>
        <span>
          <small>{labels[props.item.type]}</small>
          <strong>{summary(props.item) || "Câu hỏi chưa hoàn thiện"}</strong>
        </span>
        {valid ? <CheckCircle2 className="valid" /> : <TriangleAlert className="invalid" />}
      </button>
      <div className="question-item-actions">
        <button type="button" onClick={props.onDuplicate} aria-label="Nhân bản câu hỏi">
          <Copy />
        </button>
        <button type="button" onClick={props.onDelete} aria-label="Xóa câu hỏi">
          <Trash2 />
        </button>
      </div>
    </div>
  );
}
