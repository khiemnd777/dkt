const PUBLIC_ORIGIN = "https://dokinhthanh.io.vn";
const GAME_ORIGIN = "https://game.dokinhthanh.io.vn";

export {};

interface ExpectedResponse {
  status: number;
  contentType?: string;
  cacheControl?: string;
  robots?: string;
  location?: string;
  bodyIncludes?: string[];
  bodyExcludes?: string[];
}

async function verify(url: string, expected: ExpectedResponse): Promise<void> {
  const response = await fetch(url, { redirect: "manual" });
  const body = await response.text();
  const failures: string[] = [];
  if (response.status !== expected.status) {
    failures.push(`status ${response.status}, expected ${expected.status}`);
  }
  for (const [header, fragment] of [
    ["content-type", expected.contentType],
    ["cache-control", expected.cacheControl],
    ["x-robots-tag", expected.robots],
    ["location", expected.location],
  ] as const) {
    if (fragment && !response.headers.get(header)?.includes(fragment)) {
      failures.push(`${header} does not contain ${JSON.stringify(fragment)}`);
    }
  }
  for (const fragment of expected.bodyIncludes ?? []) {
    if (!body.includes(fragment)) failures.push(`body is missing ${JSON.stringify(fragment)}`);
  }
  for (const fragment of expected.bodyExcludes ?? []) {
    if (body.includes(fragment))
      failures.push(`body unexpectedly contains ${JSON.stringify(fragment)}`);
  }
  if (failures.length > 0) throw new Error(`${url}: ${failures.join("; ")}`);
  console.info(`✓ ${response.status} ${url}`);
}

await verify(`${PUBLIC_ORIGIN}/`, {
  status: 308,
  location: `${PUBLIC_ORIGIN}/vi/`,
});
await verify(`https://www.dokinhthanh.io.vn/en/`, {
  status: 301,
  location: `${PUBLIC_ORIGIN}/en/`,
});
await verify(`${PUBLIC_ORIGIN}/vi/`, {
  status: 200,
  contentType: "text/html",
  bodyIncludes: [
    '<html lang="vi">',
    `<link rel="canonical" href="${PUBLIC_ORIGIN}/vi/"`,
    "Tạo game Đố Kinh Thánh và chơi cùng nhau theo thời gian thực",
  ],
});
await verify(`${PUBLIC_ORIGIN}/en/`, {
  status: 200,
  contentType: "text/html",
  bodyIncludes: ['<html lang="en">', `<link rel="canonical" href="${PUBLIC_ORIGIN}/en/"`],
});
await verify(`${PUBLIC_ORIGIN}/robots.txt`, {
  status: 200,
  contentType: "text/plain",
  bodyIncludes: ["User-agent: OAI-SearchBot\nAllow: /", `Sitemap: ${PUBLIC_ORIGIN}/sitemap.xml`],
  bodyExcludes: ["User-agent: OAI-SearchBot\nDisallow: /", "User-agent: *\nDisallow: /"],
});
await verify(`${PUBLIC_ORIGIN}/sitemap.xml`, {
  status: 200,
  contentType: "xml",
  bodyIncludes: [`<loc>${PUBLIC_ORIGIN}/vi/</loc>`, `<loc>${PUBLIC_ORIGIN}/en/</loc>`],
  bodyExcludes: [`${GAME_ORIGIN}/join/`, `${GAME_ORIGIN}/play/`],
});
await verify(`${PUBLIC_ORIGIN}/llms.txt`, {
  status: 200,
  contentType: "text/plain",
  bodyIncludes: ["# Đố Kinh Thánh Live", `${PUBLIC_ORIGIN}/vi/`, `${PUBLIC_ORIGIN}/en/`],
});
await verify(`${PUBLIC_ORIGIN}/smoke-unknown-route`, { status: 404 });
await verify(`${PUBLIC_ORIGIN}/api/health`, {
  status: 404,
  cacheControl: "no-store",
});
await verify(`${GAME_ORIGIN}/`, {
  status: 200,
  contentType: "text/html",
  cacheControl: "no-store",
  robots: "noindex",
  bodyIncludes: ['name="robots" content="noindex,nofollow,noarchive,nosnippet"'],
});
await verify(`${GAME_ORIGIN}/robots.txt`, {
  status: 200,
  contentType: "text/plain",
  bodyIncludes: ["Disallow: /api/"],
  bodyExcludes: ["Sitemap:"],
});
await verify(`${GAME_ORIGIN}/join/ZZZ999`, {
  status: 410,
  cacheControl: "no-store",
  robots: "noindex",
});
await verify(`${GAME_ORIGIN}/api/health`, {
  status: 200,
  contentType: "application/json",
  cacheControl: "no-store",
  bodyIncludes: ['"ok":true'],
});

console.info("✓ Production SEO/game smoke checks passed.");
