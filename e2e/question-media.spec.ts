import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

// Opt-in local integration tests: private R2 + local signing key, all AI flags off.
// Disabled-feature coverage remains in uat.spec.ts; Worker tests always exercise media.
test.beforeEach(async ({ request }) => {
  const health = await (await request.get("/api/health")).json();
  test.skip(!health.features?.questionMedia, "Enable local QUESTION_MEDIA_ENABLED and signing key");
  expect(health.features.questionSuggestions).toBe(false);
  expect(health.features.aiMediaAnalysis).toBe(false);
});

for (const kind of ["IMAGE", "AUDIO"] as const) {
  test(`${kind} upload and ZIP round-trip work while AI is disabled`, async ({ page, browser }) => {
    const aiRequests: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/api/question-suggestions")) aiRequests.push(request.url());
    });
    await page.goto("/create");
    const editor = page.locator(".question-media-editor");
    await expect(editor).toBeVisible();
    await expect(page.getByText("Trợ lý tạo câu hỏi từ YouVersion", { exact: true })).toHaveCount(
      0,
    );
    await expect(editor.getByText(/OpenAI|phiên âm|AI/u)).toHaveCount(0);
    const bytes = Buffer.alloc(417 * 2);
    for (const offset of [0, 417]) bytes.set([0xff, 0xfb, 0x90, 0x00], offset);
    await editor
      .locator('input[type="file"]')
      .setInputFiles(
        kind === "IMAGE"
          ? "public/icons/pwa-64x64.png"
          : { name: "test.mp3", mimeType: "audio/mpeg", buffer: bytes },
      );
    const description = kind === "IMAGE" ? "Biểu tượng kiểm thử ảnh" : "Âm thanh kiểm thử";
    await editor
      .getByRole("textbox", { name: "Mô tả thay thế / nội dung âm thanh" })
      .fill(description);
    await editor
      .getByRole("checkbox", { name: "Tôi có quyền sử dụng tệp này trong game." })
      .check();
    const uploaded = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/question-media") && response.request().method() === "POST",
    );
    await editor.getByRole("button", { name: "Tải lên", exact: true }).click();
    expect((await uploaded).status()).toBe(201);
    await expect(editor.getByRole("button", { name: "Gỡ tệp" })).toBeVisible();
    if (kind === "IMAGE") {
      await expect(editor.getByRole("img", { name: description })).toBeVisible();
      await expect
        .poll(() => editor.locator("img").evaluate((image: HTMLImageElement) => image.naturalWidth))
        .toBe(64);
    } else {
      await expect(editor.locator("audio")).toHaveAttribute("controls", "");
      await expect(editor.locator("audio")).toHaveAttribute("src", /\/api\/question-media\//u);
    }
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Tải hoặc chia sẻ cấu hình game" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.dkt\.zip$/u);
    const otherDevice = await browser.newContext();
    try {
      const imported = await otherDevice.newPage();
      imported.on("request", (request) => {
        if (request.url().includes("/api/question-suggestions")) aiRequests.push(request.url());
      });
      await imported.goto("/create");
      // Playwright's temporary download path has no extension; preserve the user's ZIP filename.
      await imported.getByLabel("Chọn file cấu hình game").setInputFiles({
        name: download.suggestedFilename(),
        mimeType: "application/zip",
        buffer: await readFile(await download.path()),
      });
      await expect(imported.getByRole("heading", { name: "Nhập cấu hình này?" })).toBeVisible();
      await imported.getByRole("button", { name: "Nhập và thay thế" }).click();
      const importedEditor = imported.locator(".question-media-editor");
      await expect(importedEditor.locator("figcaption")).toHaveText(description);
      await importedEditor.getByRole("button", { name: "Gỡ tệp" }).click();
      await expect(importedEditor.getByRole("button", { name: "Chọn ảnh hoặc MP3" })).toBeVisible();
    } finally {
      await otherDevice.close();
    }
    await editor.getByRole("button", { name: "Gỡ tệp" }).click();
    await expect(editor.getByRole("button", { name: "Chọn ảnh hoặc MP3" })).toBeVisible();
    expect(aiRequests).toEqual([]);
  });
}
