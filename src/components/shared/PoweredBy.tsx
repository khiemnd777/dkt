import { useLocation } from "react-router-dom";

export function PoweredBy() {
  const { pathname } = useLocation();
  const placement =
    pathname === "/create" ? "builder" : pathname.startsWith("/screen/") ? "screen" : "";

  return (
    <a
      className={`powered-by ${placement}`.trim()}
      href="https://www.knasoftware.com"
      target="_blank"
      rel="noopener noreferrer"
    >
      <span>POWERED BY</span>
      <strong>KNASOFTWARE</strong>
    </a>
  );
}
