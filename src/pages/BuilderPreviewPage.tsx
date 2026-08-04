import type { GameDefinition } from "@shared/game";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { Preview } from "../features/builder/Preview";
import { BUILDER_SELECTED_ITEM_KEY, loadBuilderDraft } from "../features/builder/sessionDraft";

interface PreviewNavigationState {
  game?: GameDefinition;
  selectedId?: string;
}

export function BuilderPreviewPage() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const navigationState = location.state as PreviewNavigationState | null;
  const [game] = useState<GameDefinition | undefined>(
    () => navigationState?.game ?? loadBuilderDraft(),
  );
  const requestedItemId = navigationState?.selectedId ?? searchParams.get("item") ?? undefined;
  const initialIndex = useMemo(() => {
    if (!game) return 0;
    const index = game.items.findIndex((item) => item.id === requestedItemId);
    return index >= 0 ? index : 0;
  }, [game, requestedItemId]);
  const [itemIndex, setItemIndex] = useState(initialIndex);
  const item = game?.items[itemIndex];

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (!item) return;
    try {
      sessionStorage.setItem(BUILDER_SELECTED_ITEM_KEY, item.id);
    } catch {
      // Returning to the builder will simply select its first item.
    }
  }, [item]);

  if (!game || !item)
    return (
      <main className="center-page builder-preview-missing">
        <h1>Không có bản nháp để xem thử</h1>
        <p>Hãy quay lại trình tạo game và thêm ít nhất một câu hỏi.</p>
        <Link className="button primary" to="/create">
          Quay lại tạo game
        </Link>
      </main>
    );

  return (
    <main className="builder-preview-page">
      <header className="builder-preview-header">
        <Link className="button secondary" to="/create" aria-label="Quay lại chỉnh sửa">
          <ArrowLeft /> <span>Quay lại chỉnh sửa</span>
        </Link>
        <div className="builder-preview-title">
          <small>TỰ CHƠI KIỂM NGHIỆM</small>
          <strong>{game.title || "Bản nháp chưa đặt tên"}</strong>
        </div>
        <nav className="builder-preview-pagination" aria-label="Chuyển câu hỏi xem thử">
          <button
            type="button"
            aria-label="Câu trước"
            disabled={itemIndex === 0}
            onClick={() => setItemIndex((current) => Math.max(0, current - 1))}
          >
            <ChevronLeft />
          </button>
          <span>
            Câu <strong>{itemIndex + 1}</strong> / {game.items.length}
          </span>
          <button
            type="button"
            aria-label="Câu tiếp theo"
            disabled={itemIndex === game.items.length - 1}
            onClick={() => setItemIndex((current) => Math.min(game.items.length - 1, current + 1))}
          >
            <ChevronRight />
          </button>
        </nav>
      </header>
      <section className="builder-preview-canvas" aria-label="Nội dung xem thử">
        <Preview
          item={item}
          mode={game.mode}
          defaultDurationSec={game.defaultDurationSec}
          fullScreen
        />
      </section>
    </main>
  );
}
