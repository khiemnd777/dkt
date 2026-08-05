import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import sharp from "sharp";
import { PUBLIC_ROBOTS, SITE } from "../site/config";
import { alternateFor, PAGE_BY_PATH, PUBLIC_PAGES } from "../site/content";
import { renderLlmsTxt, renderPage, renderSitemap } from "../site/render";

const root = new URL("..", import.meta.url).pathname;
const publicDirectory = join(root, "public");

function validateRegistry(): void {
  const paths = new Set<string>();
  const canonicals = new Set<string>();
  const translationLocalePairs = new Set<string>();
  for (const page of PUBLIC_PAGES) {
    if (paths.has(page.path)) throw new Error(`Duplicate path: ${page.path}`);
    paths.add(page.path);
    const canonical = new URL(page.path, SITE.baseUrl).href;
    if (canonicals.has(canonical)) throw new Error(`Duplicate canonical: ${canonical}`);
    canonicals.add(canonical);
    const pair = `${page.translationKey}:${page.locale}`;
    if (translationLocalePairs.has(pair)) throw new Error(`Duplicate translation key: ${pair}`);
    translationLocalePairs.add(pair);
    if (!page.title || !page.description || !page.h1 || !page.summary) {
      throw new Error(`Missing required publishing field: ${page.path}`);
    }
    if (page.draft && !page.noindex) throw new Error(`Draft must be noindex: ${page.path}`);
    if (page.path.includes("game.dokinhthanh.io.vn")) {
      throw new Error(`Operational game URL in public registry: ${page.path}`);
    }
    alternateFor(page);
    for (const related of page.related) {
      if (!PAGE_BY_PATH.has(related))
        throw new Error(`Broken related link: ${page.path} -> ${related}`);
    }
  }
}

function socialSvg(locale: "vi" | "en"): string {
  const title = locale === "vi" ? "Đố Kinh Thánh Live" : "Bible Quiz Live";
  const subtitle =
    locale === "vi"
      ? "Tạo phòng và chơi cùng nhau theo thời gian thực"
      : "Create a room and play together in real time";
  const accountLabel = locale === "vi" ? "Không cần tài khoản" : "No account";
  const realtimeLabel = locale === "vi" ? "Thời gian thực" : "Real-time";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
    <defs>
      <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#fffaf0"/><stop offset="1" stop-color="#dce9ff"/></linearGradient>
      <linearGradient id="card" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#2d6cdf"/><stop offset="1" stop-color="#173c83"/></linearGradient>
      <filter id="shadow"><feDropShadow dx="0" dy="20" stdDeviation="20" flood-color="#10223d" flood-opacity=".18"/></filter>
    </defs>
    <rect width="1200" height="630" fill="url(#bg)"/>
    <circle cx="95" cy="70" r="190" fill="#f4bd4b" opacity=".22"/>
    <circle cx="1120" cy="570" r="250" fill="#2d6cdf" opacity=".12"/>
    <g transform="translate(82 108)" font-family="Arial, Helvetica, sans-serif" fill="#10223d">
      <text y="58" font-size="28" font-weight="700" letter-spacing="4">DOKINHTHANH.IO.VN</text>
      <text y="166" font-size="72" font-weight="800">${title}</text>
      <text y="232" font-size="32" fill="#526176">${subtitle}</text>
      <g transform="translate(0 300)" font-size="25" font-weight="700">
        <rect width="260" height="62" rx="22" fill="#fff" stroke="#b8c7dc"/>
        <text x="130" y="40" text-anchor="middle">${accountLabel}</text>
        <rect x="280" width="230" height="62" rx="22" fill="#fff" stroke="#b8c7dc"/>
        <text x="395" y="40" text-anchor="middle">${realtimeLabel}</text>
      </g>
    </g>
    <g transform="translate(850 110)" filter="url(#shadow)">
      <rect width="245" height="245" rx="60" fill="url(#card)" transform="rotate(8 122 122)"/>
      <text x="122" y="164" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="130" font-weight="900" fill="#fff">?</text>
      <circle cx="44" cy="315" r="70" fill="#f4bd4b"/>
      <text x="44" y="344" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="80" font-weight="900" fill="#10223d">✓</text>
    </g>
  </svg>`;
}

async function writeUtf8(path: string, value: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, value, "utf8");
}

async function main(): Promise<void> {
  validateRegistry();
  await Promise.all([
    rm(join(publicDirectory, "vi"), { recursive: true, force: true }),
    rm(join(publicDirectory, "en"), { recursive: true, force: true }),
    rm(join(publicDirectory, "site"), { recursive: true, force: true }),
    rm(join(publicDirectory, "social"), { recursive: true, force: true }),
  ]);

  const stylesheet = await readFile(join(root, "site/site.css"), "utf8");
  const stylesheetVersion = createHash("sha256").update(stylesheet).digest("hex").slice(0, 12);
  const stylesheetHref = `/site/site.css?v=${stylesheetVersion}`;

  for (const page of PUBLIC_PAGES) {
    const output = join(publicDirectory, page.path.slice(1), "index.html");
    await writeUtf8(output, renderPage(page, stylesheetHref));
  }

  await Promise.all([
    writeUtf8(join(publicDirectory, "site/site.css"), stylesheet),
    writeUtf8(join(publicDirectory, "robots.txt"), PUBLIC_ROBOTS),
    writeUtf8(join(publicDirectory, "sitemap.xml"), renderSitemap()),
    writeUtf8(join(publicDirectory, "llms.txt"), renderLlmsTxt()),
  ]);

  const socialDirectory = join(publicDirectory, "social");
  await mkdir(socialDirectory, { recursive: true });
  await Promise.all([
    sharp(Buffer.from(socialSvg("vi")))
      .png({ compressionLevel: 9 })
      .toFile(join(socialDirectory, "do-kinh-thanh-live-vi.png")),
    sharp(Buffer.from(socialSvg("en")))
      .png({ compressionLevel: 9 })
      .toFile(join(socialDirectory, "bible-quiz-live-en.png")),
  ]);

  console.log(
    `✓ Generated ${PUBLIC_PAGES.length} static public pages, sitemap.xml, llms.txt and social cards.`,
  );
}

await main();
