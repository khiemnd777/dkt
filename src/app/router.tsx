import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { HomePage } from "../pages/HomePage";
import { NotFoundPage } from "../pages/NotFoundPage";

const BuilderPage = lazy(() =>
  import("../pages/BuilderPage").then((module) => ({ default: module.BuilderPage })),
);
const BuilderPreviewPage = lazy(() =>
  import("../pages/BuilderPreviewPage").then((module) => ({ default: module.BuilderPreviewPage })),
);
const HostRoomPage = lazy(() =>
  import("../pages/HostRoomPage").then((module) => ({ default: module.HostRoomPage })),
);
const JoinRoomPage = lazy(() =>
  import("../pages/JoinRoomPage").then((module) => ({ default: module.JoinRoomPage })),
);
const PlayerRoomPage = lazy(() =>
  import("../pages/PlayerRoomPage").then((module) => ({ default: module.PlayerRoomPage })),
);
const PrivacyPage = lazy(() =>
  import("../pages/PrivacyPage").then((module) => ({ default: module.PrivacyPage })),
);
const ScreenRoomPage = lazy(() =>
  import("../pages/ScreenRoomPage").then((module) => ({ default: module.ScreenRoomPage })),
);

function RouteFallback() {
  return (
    <main className="center-page" aria-busy="true" aria-live="polite">
      <p>Đang tải giao diện…</p>
    </main>
  );
}

export function AppRouter() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/create" element={<BuilderPage />} />
        <Route path="/create/preview" element={<BuilderPreviewPage />} />
        <Route path="/join/:roomCode" element={<JoinRoomPage />} />
        <Route path="/play/:roomCode" element={<PlayerRoomPage />} />
        <Route path="/host/:roomCode" element={<HostRoomPage />} />
        <Route path="/screen/:roomCode" element={<ScreenRoomPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
