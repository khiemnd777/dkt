import type { BuilderMediaHandle, CrosswordItem, GameItem, QuestionMediaRef } from "@shared/game";
import { LIMITS } from "@shared/limits";
import { answerCells } from "@shared/text";
import { Check, CirclePlus, Trash2, X } from "lucide-react";
import { newId } from "./factories";
import { QuestionMediaEditor } from "./QuestionMediaEditor";
import { ScriptureReferenceField } from "./ScriptureReferenceField";

interface ItemEditorProps {
  item: GameItem;
  update: (next: GameItem) => void;
  mediaHandles: Record<string, BuilderMediaHandle>;
  onMediaHandle: (handle: BuilderMediaHandle) => void;
  mediaEnabled: boolean;
  scriptureEnabled: boolean;
}

export function ItemEditor({
  item,
  update,
  mediaHandles,
  onMediaHandle,
  mediaEnabled,
  scriptureEnabled,
}: ItemEditorProps) {
  const mediaEditor = (
    media: QuestionMediaRef | undefined,
    onChange: (next?: QuestionMediaRef) => void,
  ) =>
    mediaEnabled ? (
      <QuestionMediaEditor
        media={media}
        handle={media ? mediaHandles[media.assetId] : undefined}
        onChange={onChange}
        onHandle={onMediaHandle}
      />
    ) : null;
  const common = (
    <>
      <div className="form-grid two">
        <label>
          Thời gian riêng <span>(giây, để trống dùng mặc định)</span>
          <input
            type="number"
            min={LIMITS.minDurationSec}
            max={LIMITS.maxDurationSec}
            value={"durationSec" in item ? (item.durationSec ?? "") : ""}
            onChange={(event) =>
              update({
                ...item,
                durationSec: event.target.value ? Number(event.target.value) : undefined,
              } as GameItem)
            }
          />
        </label>
        <ScriptureReferenceField
          value={item.bibleReference ?? ""}
          enabled={scriptureEnabled}
          onChange={(value) => update({ ...item, bibleReference: value || undefined } as GameItem)}
        />
      </div>
      {mediaEditor(item.presentation?.media, (media) =>
        update({ ...item, presentation: media ? { media } : undefined } as GameItem),
      )}
    </>
  );
  if (item.type === "SINGLE_CHOICE") {
    return (
      <div className="editor-form">
        <label className="prominent">
          Câu hỏi
          <textarea
            value={item.prompt}
            maxLength={300}
            onChange={(event) => update({ ...item, prompt: event.target.value })}
          />
        </label>
        <fieldset className="options-editor">
          <legend>Các lựa chọn · chọn đáp án đúng</legend>
          {item.options.map((option, index) => (
            <div className="option-edit" key={option.id}>
              <button
                className={`correct-radio ${item.correctOptionId === option.id ? "selected" : ""}`}
                type="button"
                onClick={() => update({ ...item, correctOptionId: option.id })}
                aria-label={`Đặt lựa chọn ${index + 1} là đáp án đúng`}
              >
                {item.correctOptionId === option.id ? <Check strokeWidth={3.2} /> : index + 1}
              </button>
              <input
                value={option.text}
                maxLength={120}
                onChange={(event) =>
                  update({
                    ...item,
                    options: item.options.map((candidate) =>
                      candidate.id === option.id
                        ? { ...candidate, text: event.target.value }
                        : candidate,
                    ),
                  })
                }
              />
              <button
                type="button"
                aria-label="Xóa lựa chọn"
                disabled={item.options.length <= 2}
                onClick={() =>
                  update({
                    ...item,
                    options: item.options.filter((candidate) => candidate.id !== option.id),
                    correctOptionId:
                      item.correctOptionId === option.id
                        ? (item.options.find((candidate) => candidate.id !== option.id)?.id ?? "")
                        : item.correctOptionId,
                  })
                }
              >
                <Trash2 />
              </button>
            </div>
          ))}
          <button
            className="button tertiary"
            type="button"
            disabled={item.options.length >= 4}
            onClick={() =>
              update({
                ...item,
                options: [
                  ...item.options,
                  { id: newId("option"), text: `Lựa chọn ${item.options.length + 1}` },
                ],
              })
            }
          >
            <CirclePlus /> Thêm lựa chọn
          </button>
        </fieldset>
        {common}
        <Explanation item={item} update={update} />
      </div>
    );
  }
  if (item.type === "MULTIPLE_CHOICE") {
    return (
      <div className="editor-form">
        <label className="prominent">
          Câu hỏi <span>(người chơi chọn tất cả đáp án đúng)</span>
          <textarea
            value={item.prompt}
            maxLength={300}
            onChange={(event) => update({ ...item, prompt: event.target.value })}
          />
        </label>
        <fieldset className="options-editor">
          <legend>Các lựa chọn · chọn ít nhất hai đáp án đúng</legend>
          {item.options.map((option, index) => {
            const selected = item.correctOptionIds.includes(option.id);
            return (
              <div className="option-edit" key={option.id}>
                <button
                  className={`correct-radio ${selected ? "selected" : ""}`}
                  type="button"
                  onClick={() =>
                    update({
                      ...item,
                      correctOptionIds: selected
                        ? item.correctOptionIds.filter((id) => id !== option.id)
                        : [...item.correctOptionIds, option.id],
                    })
                  }
                  aria-pressed={selected}
                  aria-label={`${selected ? "Bỏ" : "Đặt"} lựa chọn ${index + 1} là đáp án đúng`}
                >
                  {selected ? <Check strokeWidth={3.2} /> : index + 1}
                </button>
                <input
                  value={option.text}
                  maxLength={120}
                  onChange={(event) =>
                    update({
                      ...item,
                      options: item.options.map((candidate) =>
                        candidate.id === option.id
                          ? { ...candidate, text: event.target.value }
                          : candidate,
                      ),
                    })
                  }
                />
                <button
                  type="button"
                  aria-label="Xóa lựa chọn"
                  disabled={item.options.length <= LIMITS.minMultipleChoiceOptions}
                  onClick={() =>
                    update({
                      ...item,
                      options: item.options.filter((candidate) => candidate.id !== option.id),
                      correctOptionIds: item.correctOptionIds.filter((id) => id !== option.id),
                    })
                  }
                >
                  <Trash2 />
                </button>
              </div>
            );
          })}
          <button
            className="button tertiary"
            type="button"
            disabled={item.options.length >= LIMITS.maxChoiceOptions}
            onClick={() =>
              update({
                ...item,
                options: [
                  ...item.options,
                  { id: newId("option"), text: `Lựa chọn ${item.options.length + 1}` },
                ],
              })
            }
          >
            <CirclePlus /> Thêm lựa chọn
          </button>
          <p className="helper">
            Tính đúng khi tập lựa chọn khớp hoàn toàn; phiên bản đầu không chấm điểm một phần.
          </p>
        </fieldset>
        {common}
        <Explanation item={item} update={update} />
      </div>
    );
  }
  if (item.type === "TRUE_FALSE") {
    return (
      <div className="editor-form">
        <label className="prominent">
          Mệnh đề
          <textarea
            value={item.statement}
            maxLength={300}
            onChange={(event) => update({ ...item, statement: event.target.value })}
          />
        </label>
        <fieldset>
          <legend>Đáp án đúng</legend>
          <div className="truth-selector">
            <button
              className={item.correctValue ? "selected" : ""}
              type="button"
              aria-pressed={item.correctValue}
              onClick={() => update({ ...item, correctValue: true })}
            >
              <Check /> Đúng
            </button>
            <button
              className={!item.correctValue ? "selected" : ""}
              type="button"
              aria-pressed={!item.correctValue}
              onClick={() => update({ ...item, correctValue: false })}
            >
              <X /> Sai
            </button>
          </div>
        </fieldset>
        {common}
        <Explanation item={item} update={update} />
      </div>
    );
  }
  if (item.type === "SHORT_ANSWER") {
    return (
      <div className="editor-form">
        <label className="prominent">
          Câu hỏi
          <textarea
            value={item.prompt}
            maxLength={300}
            onChange={(event) => update({ ...item, prompt: event.target.value })}
          />
        </label>
        <label>
          Đáp án chuẩn
          <input
            value={item.canonicalAnswer}
            maxLength={120}
            onChange={(event) => update({ ...item, canonicalAnswer: event.target.value })}
          />
        </label>
        <label>
          Các cách viết khác <span>(mỗi dòng một đáp án, tối đa 10)</span>
          <textarea
            value={item.acceptedAliases.join("\n")}
            onChange={(event) =>
              update({
                ...item,
                acceptedAliases: event.target.value
                  .split("\n")
                  .map((value) => value.trim())
                  .filter(Boolean)
                  .slice(0, 10),
              })
            }
            placeholder={"David\nĐa Vít"}
          />
        </label>
        <p className="helper">
          So khớp chính xác sau khi bỏ dấu, khoảng trắng và dấu câu. Không dùng phỏng đoán mơ hồ.
        </p>
        {common}
        <Explanation item={item} update={update} />
      </div>
    );
  }
  return (
    <CrosswordEditor
      item={item}
      update={(next) => update(next)}
      mediaEditor={mediaEditor}
      scriptureEnabled={scriptureEnabled}
    />
  );
}

function Explanation({ item, update }: { item: GameItem; update: (next: GameItem) => void }) {
  return (
    <label>
      Lời giải thích <span>(không bắt buộc)</span>
      <textarea
        maxLength={500}
        value={item.explanation ?? ""}
        onChange={(event) =>
          update({ ...item, explanation: event.target.value || undefined } as GameItem)
        }
      />
    </label>
  );
}

function CrosswordEditor({
  item,
  update,
  mediaEditor,
  scriptureEnabled,
}: {
  item: CrosswordItem;
  update: (next: CrosswordItem) => void;
  scriptureEnabled: boolean;
  mediaEditor: (
    media: QuestionMediaRef | undefined,
    onChange: (next?: QuestionMediaRef) => void,
  ) => React.ReactNode;
}) {
  const changeRow = (rowId: string, patch: Partial<CrosswordItem["horizontalRows"][number]>) =>
    update({
      ...item,
      horizontalRows: item.horizontalRows.map((row) =>
        row.id === rowId ? { ...row, ...patch } : row,
      ),
    });
  return (
    <div className="editor-form crossword-editor">
      <div className="crossword-intro">
        <strong>Ô chữ Kinh Thánh</strong>
        <span>Mỗi hàng ngang là một vòng; từ khóa dọc có thể được đoán sớm với điểm giảm dần.</span>
      </div>
      <label className="prominent">
        Tên ô chữ
        <input
          value={item.title}
          maxLength={120}
          onChange={(event) => update({ ...item, title: event.target.value })}
        />
      </label>
      <div className="form-grid two">
        <label>
          Gợi ý từ khóa dọc
          <textarea
            value={item.verticalClue}
            maxLength={300}
            onChange={(event) => update({ ...item, verticalClue: event.target.value })}
          />
        </label>
        <label>
          Từ khóa dọc
          <input
            value={item.verticalAnswer}
            maxLength={120}
            onChange={(event) => update({ ...item, verticalAnswer: event.target.value })}
          />
          <small>Số ô chữ phải bằng số hàng ngang.</small>
        </label>
        <label>
          Thời gian hàng ngang
          <input
            type="number"
            min="5"
            max="120"
            value={item.horizontalDurationSec}
            onChange={(event) =>
              update({ ...item, horizontalDurationSec: Number(event.target.value) })
            }
          />
        </label>
        <label>
          Thời gian đoán hàng dọc <span>(không bắt buộc)</span>
          <input
            type="number"
            min={LIMITS.minDurationSec}
            max={LIMITS.maxDurationSec}
            value={item.verticalDurationSec ?? ""}
            onChange={(event) =>
              update({
                ...item,
                verticalDurationSec: event.target.value ? Number(event.target.value) : undefined,
              })
            }
          />
        </label>
        <ScriptureReferenceField
          label="Câu Kinh Thánh cho từ khóa dọc"
          optional={false}
          value={item.bibleReference ?? ""}
          enabled={scriptureEnabled}
          onChange={(value) => update({ ...item, bibleReference: value || undefined })}
        />
      </div>
      {mediaEditor(item.presentation?.media, (media) =>
        update({ ...item, presentation: media ? { media } : undefined }),
      )}
      <div className="crossword-rows">
        <div className="section-title">
          <h3>Hàng ngang</h3>
          <span>{item.horizontalRows.length}/10</span>
        </div>
        {item.horizontalRows.map((row, index) => {
          const cells = answerCells(row.answer);
          return (
            <div className="crossword-row-editor" key={row.id}>
              <div className="row-heading">
                <strong>Hàng {index + 1}</strong>
                <button
                  type="button"
                  disabled={item.horizontalRows.length <= 3}
                  onClick={() =>
                    update({
                      ...item,
                      horizontalRows: item.horizontalRows.filter(
                        (candidate) => candidate.id !== row.id,
                      ),
                    })
                  }
                  aria-label={`Xóa hàng ${index + 1}`}
                >
                  <Trash2 />
                </button>
              </div>
              <label>
                Gợi ý
                <input
                  value={row.clue}
                  maxLength={300}
                  onChange={(event) => changeRow(row.id, { clue: event.target.value })}
                />
              </label>
              <label>
                Đáp án
                <input
                  value={row.answer}
                  maxLength={120}
                  onChange={(event) =>
                    changeRow(row.id, {
                      answer: event.target.value,
                      specialCellIndex: Math.min(
                        row.specialCellIndex,
                        Math.max(0, answerCells(event.target.value).length - 1),
                      ),
                    })
                  }
                />
              </label>
              <label>
                Cách viết khác <span>(phân cách bằng dấu phẩy)</span>
                <input
                  value={row.acceptedAliases.join(", ")}
                  maxLength={400}
                  onChange={(event) =>
                    changeRow(row.id, {
                      acceptedAliases: event.target.value
                        .split(",")
                        .map((value) => value.trim())
                        .filter(Boolean)
                        .slice(0, LIMITS.maxAliases),
                    })
                  }
                />
              </label>
              <ScriptureReferenceField
                optional={false}
                value={row.bibleReference ?? ""}
                enabled={scriptureEnabled}
                onChange={(value) => changeRow(row.id, { bibleReference: value || undefined })}
              />
              <label>
                Lời giải thích
                <textarea
                  value={row.explanation ?? ""}
                  maxLength={500}
                  onChange={(event) =>
                    changeRow(row.id, { explanation: event.target.value || undefined })
                  }
                />
              </label>
              <div>
                <span className="field-label">Chọn ô tạo từ khóa dọc</span>
                <div className="cell-picker">
                  {cells.map((cell, cellIndex) => (
                    <button
                      type="button"
                      key={`${cell}-${cellIndex}`}
                      className={row.specialCellIndex === cellIndex ? "special" : ""}
                      onClick={() => changeRow(row.id, { specialCellIndex: cellIndex })}
                    >
                      {cell}
                    </button>
                  ))}
                </div>
              </div>
              {mediaEditor(row.presentation?.media, (media) =>
                changeRow(row.id, { presentation: media ? { media } : undefined }),
              )}
            </div>
          );
        })}
        <button
          className="button tertiary"
          type="button"
          disabled={item.horizontalRows.length >= 10}
          onClick={() =>
            update({
              ...item,
              horizontalRows: [
                ...item.horizontalRows,
                {
                  id: newId("row"),
                  clue: "Gợi ý mới",
                  answer: "A",
                  acceptedAliases: [],
                  specialCellIndex: 0,
                },
              ],
            })
          }
        >
          <CirclePlus /> Thêm hàng ngang
        </button>
      </div>
      <Explanation item={item} update={(next) => update(next as CrosswordItem)} />
    </div>
  );
}
