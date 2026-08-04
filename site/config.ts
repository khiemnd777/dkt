export const SITE = {
  name: "Đố Kinh Thánh Live",
  baseUrl: "https://dokinhthanh.io.vn",
  gameUrl: "https://game.dokinhthanh.io.vn",
  defaultLocale: "vi",
  locales: ["vi", "en"],
  logo: "/icons/icon.svg",
  socialImages: {
    vi: "/social/do-kinh-thanh-live-vi.png",
    en: "/social/bible-quiz-live-en.png",
  },
  socialImageWidth: 1200,
  socialImageHeight: 630,
} as const;

export type Locale = (typeof SITE.locales)[number];

export const PUBLIC_ROBOTS = `User-agent: *
Allow: /
Disallow: /api/
Disallow: /preview/
Disallow: /draft/
Disallow: /_actions/

User-agent: OAI-SearchBot
Allow: /
Disallow: /api/
Disallow: /preview/
Disallow: /draft/
Disallow: /_actions/

User-agent: ChatGPT-User
Allow: /
Disallow: /api/
Disallow: /preview/
Disallow: /draft/
Disallow: /_actions/

User-agent: GPTBot
Disallow: /

Sitemap: ${SITE.baseUrl}/sitemap.xml
`;

export const GAME_ROBOTS = `User-agent: *
Allow: /
Disallow: /api/

User-agent: GPTBot
Disallow: /
`;
