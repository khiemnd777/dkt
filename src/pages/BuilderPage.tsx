import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { GameDefinition, GameItem, GameItemType, GameMode } from "@shared/game";
import { LIMITS } from "@shared/limits";
import { gameDefinitionSchema, gameItemSchema } from "@shared/schemas";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Clock3,
  Download,
  Eye,
  Plus,
  Rocket,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Brand } from "../components/shared/Brand";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { createItem, duplicateItem } from "../features/builder/factories";
import {
  gameConfigFilename,
  MAX_GAME_CONFIG_BYTES,
  parseGameConfig,
  serializeGameConfig,
} from "../features/builder/gameConfig";
import { ItemEditor } from "../features/builder/ItemEditor";
import { Preview } from "../features/builder/Preview";
import { SortableQuestion } from "../features/builder/SortableQuestion";
import {
  BUILDER_DRAFT_KEY,
  BUILDER_SELECTED_ITEM_KEY,
  loadBuilderDraft,
  loadBuilderSelectedItemId,
} from "../features/builder/sessionDraft";
import { Turnstile } from "../features/security/Turnstile";
import { api } from "../lib/api";
import { saveSession } from "../lib/session";

const itemChoices: Array<{ type: GameItemType; icon: string; title: string }> = [
  { type: "SINGLE_CHOICE", icon: "🔷", title: "Trắc nghiệm" },
  { type: "TRUE_FALSE", icon: "✓", title: "Đúng / Sai" },
  { type: "SHORT_ANSWER", icon: "✍️", title: "Trả lời ngắn" },
  { type: "CROSSWORD", icon: "▦", title: "Ô chữ Kinh Thánh" },
];

function freshGame(): GameDefinition {
  return {
    title: "Hành trình Kinh Thánh",
    mode: "TURN_BASED",
    defaultDurationSec: 20,
    items: [createItem("SINGLE_CHOICE")],
    createdClientVersion: "1.1.0",
  };
}

function estimatedSeconds(items: GameItem[], defaultDuration: number): number {
  return items.reduce((total, item) => {
    if (item.type === "CROSSWORD")
      return (
        total + item.horizontalRows.length * item.horizontalDurationSec + item.verticalDurationSec
      );
    return total + (item.durationSec ?? defaultDuration);
  }, 0);
}

export function BuilderPage() {
  const navigate = useNavigate();
  const [initialDraft] = useState(loadBuilderDraft);
  const [initialGame] = useState<GameDefinition>(() => initialDraft ?? freshGame());
  const [restoredDraft] = useState(Boolean(initialDraft));
  const [title, setTitle] = useState(initialGame.title);
  const [mode, setMode] = useState<GameMode>(initialGame.mode);
  const [duration, setDuration] = useState(initialGame.defaultDurationSec);
  const [items, setItems] = useState<GameItem[]>(initialGame.items);
  const [selectedId, setSelectedId] = useState(() => {
    const savedId = loadBuilderSelectedItemId();
    return initialGame.items.some((item) => item.id === savedId)
      ? (savedId as string)
      : initialGame.items[0].id;
  });
  const [showTypes, setShowTypes] = useState(false);
  const [error, setError] = useState<string>();
  const [issues, setIssues] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string>();
  const [created, setCreated] = useState(false);
  const [pendingImport, setPendingImport] = useState<{
    game: GameDefinition;
    filename: string;
  }>();
  const [transferNotice, setTransferNotice] = useState<string>();
  const fileInput = useRef<HTMLInputElement>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const selected = items.find((item) => item.id === selectedId) ?? items[0];
  const seconds = estimatedSeconds(items, duration);
  const sitekey = import.meta.env.VITE_TURNSTILE_SITE_KEY;

  useEffect(() => {
    const protect = (event: BeforeUnloadEvent) => {
      if (!created) event.preventDefault();
    };
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [created]);

  const updateSelected = (next: GameItem) =>
    setItems((current) => current.map((item) => (item.id === next.id ? next : item)));
  const add = (type: GameItemType) => {
    if (items.length >= LIMITS.maxItems) return;
    const item = createItem(type);
    setItems((current) => [...current, item]);
    setSelectedId(item.id);
    setShowTypes(false);
  };
  const remove = (id: string) => {
    if (items.length <= 1) return;
    const index = items.findIndex((item) => item.id === id);
    const remaining = items.filter((item) => item.id !== id);
    setItems(remaining);
    if (selectedId === id) setSelectedId(remaining[Math.max(0, index - 1)].id);
  };
  const duplicate = (item: GameItem) => {
    if (items.length >= LIMITS.maxItems) return;
    const copy = duplicateItem(item);
    const index = items.findIndex((candidate) => candidate.id === item.id);
    setItems([...items.slice(0, index + 1), copy, ...items.slice(index + 1)]);
    setSelectedId(copy.id);
  };
  const dragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    setItems((current) =>
      arrayMove(
        current,
        current.findIndex((item) => item.id === active.id),
        current.findIndex((item) => item.id === over.id),
      ),
    );
  };
  const game = useMemo<GameDefinition>(
    () => ({ title, mode, defaultDurationSec: duration, items, createdClientVersion: "1.1.0" }),
    [title, mode, duration, items],
  );

  useEffect(() => {
    if (created) return;
    try {
      sessionStorage.setItem(BUILDER_DRAFT_KEY, JSON.stringify(game));
    } catch {
      // The unload warning remains the fallback when session storage is unavailable.
    }
  }, [created, game]);

  const downloadConfig = async () => {
    try {
      const serialized = serializeGameConfig(game);
      const filename = gameConfigFilename(title);
      const blob = new Blob([serialized], { type: "application/json;charset=utf-8" });
      const file = new File([blob], filename, { type: "application/json" });
      const prefersNativeShare =
        navigator.maxTouchPoints > 0 ||
        /Android|iPhone|iPad|iPod|Mobile/u.test(navigator.userAgent);
      const canShareFile =
        prefersNativeShare &&
        typeof navigator.share === "function" &&
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [file] });

      if (canShareFile) {
        try {
          await navigator.share({
            files: [file],
            title: `Cấu hình ${title || "Đố Kinh Thánh"}`,
          });
          setTransferNotice(
            "Đã chia sẻ cấu hình. Bạn có thể mở file trên thiết bị khác để tiếp tục.",
          );
          setError(undefined);
          setIssues([]);
          return;
        } catch (cause) {
          if (cause instanceof DOMException && cause.name === "AbortError") return;
          // Fall back to a browser download if the native share sheet is unavailable at runtime.
        }
      }

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      // Mobile browsers may resolve blob downloads after the click task has completed.
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setTransferNotice("Đã tải cấu hình. Bạn có thể chuyển file sang thiết bị khác để tiếp tục.");
      setError(undefined);
      setIssues([]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể tải cấu hình.");
      setIssues([]);
    }
  };

  const chooseConfig = async (file?: File) => {
    if (!file) return;
    setTransferNotice(undefined);
    setIssues([]);
    try {
      if (file.size > MAX_GAME_CONFIG_BYTES)
        throw new Error("File cấu hình vượt quá giới hạn 512 KiB.");
      const imported = parseGameConfig(await file.text());
      setPendingImport({ game: imported, filename: file.name });
      setError(undefined);
    } catch (cause) {
      setPendingImport(undefined);
      setError(cause instanceof Error ? cause.message : "Không thể đọc file cấu hình.");
    }
  };

  const applyImport = () => {
    if (!pendingImport) return;
    const imported = structuredClone(pendingImport.game);
    setTitle(imported.title);
    setMode(imported.mode);
    setDuration(imported.defaultDurationSec);
    setItems(imported.items);
    setSelectedId(imported.items[0].id);
    setShowTypes(false);
    setError(undefined);
    setIssues([]);
    setTransferNotice(
      `Đã nhập “${pendingImport.filename}”. Bản nháp mới đã được lưu trong phiên tab này.`,
    );
    setPendingImport(undefined);
  };

  const createRoom = async () => {
    const result = gameDefinitionSchema.safeParse(game);
    if (!result.success) {
      setIssues(result.error.issues.slice(0, 8).map((issue) => issue.message));
      setError("Hãy hoàn thiện các mục được báo trước khi tạo phòng.");
      const firstInvalid = items.find((item) => !gameItemSchema.safeParse(item).success);
      if (firstInvalid) setSelectedId(firstInvalid.id);
      window.setTimeout(
        () =>
          document
            .querySelector<HTMLElement>(".field-error, input:invalid, textarea:invalid")
            ?.focus(),
        0,
      );
      return;
    }
    setCreating(true);
    setError(undefined);
    setIssues([]);
    try {
      const room = await api.createRoom(result.data, turnstileToken);
      saveSession("HOST", room.roomCode, room.hostToken);
      saveSession("SCREEN", room.roomCode, room.screenToken);
      sessionStorage.removeItem(BUILDER_DRAFT_KEY);
      sessionStorage.removeItem(BUILDER_SELECTED_ITEM_KEY);
      setCreated(true);
      navigate(`/host/${room.roomCode}`, { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể tạo phòng chơi.");
    } finally {
      setCreating(false);
    }
  };

  const onTurnstile = useCallback((token?: string) => setTurnstileToken(token), []);

  const openFullPreview = () => {
    try {
      sessionStorage.setItem(BUILDER_DRAFT_KEY, JSON.stringify(game));
      sessionStorage.setItem(BUILDER_SELECTED_ITEM_KEY, selected.id);
    } catch {
      // Navigation state remains available even if session storage is unavailable.
    }
    navigate(`/create/preview?item=${encodeURIComponent(selected.id)}`, {
      state: { game, selectedId: selected.id },
    });
  };

  return (
    <main className="builder-page">
      <header className="builder-header">
        <Link to="/" className="icon-button" aria-label="Đóng trình tạo game">
          <ArrowLeft />
        </Link>
        <Brand compact />
        <label className="builder-title">
          <span>Tên game</span>
          <input value={title} maxLength={80} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <span className="privacy-chip">
          <ShieldCheck /> Không lưu lâu dài
        </span>
      </header>
      <div className="builder-workspace">
        <aside className="question-sidebar">
          <div className="sidebar-heading">
            <strong>Câu hỏi</strong>
            <span>
              {items.length}/{LIMITS.maxItems}
            </span>
          </div>
          <DndContext sensors={sensors} onDragEnd={dragEnd}>
            <SortableContext
              items={items.map((item) => item.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="question-list">
                {items.map((item, index) => (
                  <SortableQuestion
                    key={item.id}
                    item={item}
                    index={index}
                    selected={item.id === selectedId}
                    onSelect={() => setSelectedId(item.id)}
                    onDuplicate={() => duplicate(item)}
                    onDelete={() => remove(item.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
          <div className="add-menu-wrap">
            <button
              className="button primary full"
              type="button"
              onClick={() => setShowTypes((value) => !value)}
            >
              <Plus /> Thêm câu hỏi <ChevronDown />
            </button>
            {showTypes ? (
              <div className="add-menu">
                {itemChoices.map((choice) => (
                  <button type="button" key={choice.type} onClick={() => add(choice.type)}>
                    <span>{choice.icon}</span>
                    {choice.title}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </aside>
        <section className="item-editor">
          <div className="mobile-item-label">
            Câu {items.indexOf(selected) + 1} / {items.length}
          </div>
          <ItemEditor item={selected} update={updateSelected} />
        </section>
        <aside className="preview-sidebar">
          <Preview item={selected} />
          <div className="builder-settings">
            <label>
              Thời gian mặc định
              <input
                type="number"
                min="5"
                max="120"
                value={duration}
                onChange={(event) => setDuration(Number(event.target.value))}
              />
            </label>
          </div>
        </aside>
      </div>
      <div className="mode-section">
        <h2>Chọn cách tính điểm</h2>
        <div className="mode-cards">
          <button
            type="button"
            className={mode === "TURN_BASED" ? "selected" : ""}
            onClick={() => setMode("TURN_BASED")}
          >
            <span className="mode-icon">📖</span>
            <span>
              <strong>Theo lượt câu hỏi</strong>
              <small>
                Tất cả cùng trả lời. Ai đúng cũng nhận 1.000 điểm. Tốc độ không ảnh hưởng điểm.
              </small>
            </span>
            {mode === "TURN_BASED" ? <Check /> : null}
          </button>
          <button
            type="button"
            className={mode === "SPEED_RACE" ? "selected" : ""}
            onClick={() => setMode("SPEED_RACE")}
          >
            <span className="mode-icon">⚡</span>
            <span>
              <strong>Đua tốc độ</strong>
              <small>
                Tất cả cùng trả lời. Ai đúng cũng có điểm. Trả lời nhanh hơn sẽ nhận nhiều điểm hơn.
              </small>
            </span>
            {mode === "SPEED_RACE" ? <Check /> : null}
          </button>
        </div>
      </div>
      <div className="builder-ephemeral">
        <Clock3 />
        <span>
          {restoredDraft ? "Đã khôi phục bản nháp trong tab này. " : ""}
          Bản nháp tự lưu trong phiên tab và tự xóa sau khi tạo phòng; hãy tải cấu hình về nếu muốn
          tiếp tục vào ngày khác hoặc trên thiết bị khác.
        </span>
      </div>
      {transferNotice ? (
        <div className="builder-transfer-notice" role="status" aria-live="polite">
          {transferNotice}
        </div>
      ) : null}
      <footer className="builder-footer">
        <div>
          <strong>{items.length} mục</strong>
          <span>~ {Math.ceil(seconds / 60)} phút</span>
          <span>{mode === "TURN_BASED" ? "Theo lượt" : "Đua tốc độ"}</span>
        </div>
        <div className="builder-footer-actions">
          <button
            type="button"
            className="button secondary preview-action"
            aria-label="Mở xem thử toàn màn hình"
            onClick={openFullPreview}
          >
            <Eye /> <span>Xem thử</span>
          </button>
          <button
            type="button"
            className="button secondary config-action"
            aria-label="Nhập cấu hình game từ file"
            onClick={() => fileInput.current?.click()}
          >
            <Upload /> <span>Nhập cấu hình</span>
          </button>
          <input
            ref={fileInput}
            hidden
            type="file"
            accept=".json,application/json"
            aria-label="Chọn file cấu hình game"
            onChange={(event) => {
              void chooseConfig(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          <button
            type="button"
            className="button secondary config-action"
            aria-label="Tải hoặc chia sẻ cấu hình game"
            onClick={() => void downloadConfig()}
          >
            <Download /> <span>Tải cấu hình</span>
          </button>
          <Turnstile onToken={onTurnstile} />
          <button
            type="button"
            className="button gold large"
            disabled={creating || Boolean(sitekey && !turnstileToken)}
            onClick={createRoom}
          >
            {creating ? (
              "Đang tạo phòng…"
            ) : (
              <>
                <Rocket /> Tạo phòng chơi
              </>
            )}
          </button>
        </div>
        {error ? (
          <div className="builder-error" role="alert">
            <strong>{error}</strong>
            {issues.length ? (
              <ul>
                {issues.map((issue, index) => (
                  <li key={`${issue}-${index}`}>{issue}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </footer>
      <ConfirmDialog
        open={Boolean(pendingImport)}
        title="Nhập cấu hình này?"
        description={
          pendingImport
            ? `File “${pendingImport.filename}” có ${pendingImport.game.items.length} mục. Nội dung đang mở sẽ được thay thế; bản nháp trong file có thể tiếp tục chỉnh sửa trước khi tạo phòng.`
            : ""
        }
        confirmLabel="Nhập và thay thế"
        confirmTone="primary"
        onCancel={() => setPendingImport(undefined)}
        onConfirm={applyImport}
      />
    </main>
  );
}
