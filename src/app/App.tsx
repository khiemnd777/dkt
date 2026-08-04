import { BrowserRouter } from "react-router-dom";
import { PoweredBy } from "../components/shared/PoweredBy";
import { AppRouter } from "./router";

export function App() {
  return (
    <BrowserRouter>
      <AppRouter />
      <PoweredBy />
    </BrowserRouter>
  );
}
