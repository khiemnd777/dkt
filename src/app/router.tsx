import { Route, Routes } from "react-router-dom";
import { BuilderPage } from "../pages/BuilderPage";
import { BuilderPreviewPage } from "../pages/BuilderPreviewPage";
import { HomePage } from "../pages/HomePage";
import { HostRoomPage } from "../pages/HostRoomPage";
import { JoinRoomPage } from "../pages/JoinRoomPage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { PlayerRoomPage } from "../pages/PlayerRoomPage";
import { PrivacyPage } from "../pages/PrivacyPage";
import { ScreenRoomPage } from "../pages/ScreenRoomPage";

export function AppRouter() {
  return (
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
  );
}
