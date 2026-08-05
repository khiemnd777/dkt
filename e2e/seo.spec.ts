import { expect, test } from "@playwright/test";

test("public HTML is crawlable without hydration and unknown URLs are real 404s", async ({
  browser,
  request,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  try {
    const response = await page.goto("/vi/");
    expect(response?.status()).toBe(200);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Tạo game Đố Kinh Thánh và chơi cùng nhau theo thời gian thực",
      }),
    ).toBeVisible();
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      "https://dokinhthanh.io.vn/vi/",
    );
    await expect(page.locator('link[hreflang="en"]')).toHaveAttribute(
      "href",
      "https://dokinhthanh.io.vn/en/",
    );

    const englishResponse = await page.goto("/en/");
    expect(englishResponse?.status()).toBe(200);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Create a Bible quiz and play together in real time",
      }),
    ).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeVisible();
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      "https://dokinhthanh.io.vn/en/",
    );

    const missing = await request.get("/not-a-public-or-game-route");
    expect(missing.status()).toBe(404);
  } finally {
    await context.close();
  }
});

test("crawler files have the expected content type and operational routes are noindex", async ({
  request,
}) => {
  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  expect(robots.headers()["content-type"]).toContain("text/plain");
  expect(await robots.text()).toContain("User-agent: OAI-SearchBot\nAllow: /");

  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.status()).toBe(200);
  expect(sitemap.headers()["content-type"]).toContain("xml");
  expect(await sitemap.text()).not.toContain("game.dokinhthanh.io.vn/join/");

  const llms = await request.get("/llms.txt");
  expect(llms.status()).toBe(200);
  expect(llms.headers()["content-type"]).toContain("text/plain");

  const builder = await request.get("/create");
  expect(builder.status()).toBe(200);
  expect(builder.headers()["x-robots-tag"]).toContain("noindex");

  const goneRoom = await request.get("/join/ABC234");
  expect(goneRoom.status()).toBe(410);
  expect(goneRoom.headers()["cache-control"]).toBe("no-store");
});
