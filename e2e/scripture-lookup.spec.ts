import { expect, type Page, test } from "@playwright/test";

async function mockFeatures(page: Page, media = false) {
  await page.route("**/api/health", (route) =>
    route.fulfill({
      json: {
        ok: true,
        environment: "development",
        turnstileProtected: false,
        features: {
          scripture: true,
          questionSuggestions: false,
          autoBalance: false,
          questionMedia: media,
          aiMediaAnalysis: false,
        },
      },
    }),
  );
}

const version = {
  provider: "youversion",
  id: 1638,
  abbreviation: "TEST",
  localizedTitle: "Bản dịch kiểm thử",
  languageTag: "vi",
  copyright: "Nguồn bản dịch kiểm thử",
  attribution: "Nguồn bản dịch kiểm thử",
  deepLink: "https://www.bible.com/versions/1638",
};

test("reference lookup is independent of AI and keeps passage text out of the draft", async ({
  page,
}) => {
  const aiRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/question-suggestions")) aiRequests.push(request.url());
  });
  await mockFeatures(page);
  await page.route("**/api/scripture/versions?*", (route) =>
    route.fulfill({ json: { versions: [version] } }),
  );
  await page.route("**/api/scripture/lookup?*", (route) => {
    const reference = new URL(route.request().url()).searchParams.get("reference");
    expect(reference).toBe("1 Sa-mu-ên 17:50");
    const scope = {
      provider: "youversion",
      bibleVersionId: 1638,
      bookUsfm: "1SA",
      chapter: 17,
      passageId: "1SA.17.50",
    };
    return route.fulfill({
      json: {
        version,
        requestedScope: scope,
        chunks: [
          {
            reference: scope,
            localizedReference: reference,
            content: "Đây là nội dung giả lập chỉ dành cho kiểm thử tra cứu.",
            contentSha256: "a".repeat(64),
            attribution: version.attribution,
          },
        ],
      },
    });
  });
  await page.goto("/create");
  await expect(page.getByText("Tra cứu YouVersion", { exact: true })).toBeVisible();
  await expect(page.getByText("Trợ lý tạo câu hỏi từ YouVersion", { exact: true })).toHaveCount(0);
  await page.getByRole("textbox", { name: /Câu Kinh Thánh tham khảo/u }).fill("1 Sa-mu-ên 17:50");
  await expect(
    page.getByText("Đây là nội dung giả lập chỉ dành cho kiểm thử tra cứu."),
  ).toBeVisible();
  await expect(page.getByText(version.attribution, { exact: true })).toBeVisible();
  const draft = await page.evaluate(() => JSON.stringify(sessionStorage));
  expect(draft).toContain("1 Sa-mu-ên 17:50");
  expect(draft).not.toContain("Đây là nội dung giả lập");
  expect(aiRequests).toEqual([]);
  await page.getByRole("button", { name: "Thêm câu hỏi", exact: true }).click();
  await page.getByRole("button", { name: /Chọn nhiều đáp án/u }).click();
  await expect(
    page.getByText("Đây là nội dung giả lập chỉ dành cho kiểm thử tra cứu."),
  ).toHaveCount(0);
});

test("all answer types have independent Scripture lookup and image/audio editor capabilities", async ({
  page,
}) => {
  await mockFeatures(page, true);
  await page.goto("/create");
  await expect(page.getByText("Hình ảnh hoặc âm thanh câu hỏi", { exact: true })).toBeVisible();
  for (const name of ["Chọn nhiều đáp án", "Đúng / Sai", "Trả lời ngắn", "Ô chữ Kinh Thánh"]) {
    await page.getByRole("button", { name: "Thêm câu hỏi", exact: true }).click();
    await page.getByRole("button", { name: new RegExp(name, "u") }).click();
    const count = name === "Ô chữ Kinh Thánh" ? 4 : 1;
    await expect(page.getByText("Tra cứu YouVersion", { exact: true })).toHaveCount(count);
    await expect(page.getByText("Hình ảnh hoặc âm thanh câu hỏi", { exact: true })).toHaveCount(
      count,
    );
  }
  await expect(page.getByText("Trợ lý tạo câu hỏi từ YouVersion", { exact: true })).toHaveCount(0);
});

test("mobile lookup failure leaves the question editable and exposes a retry", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockFeatures(page);
  await page.route("**/api/scripture/versions?*", (route) =>
    route.fulfill({ json: { versions: [version] } }),
  );
  await page.route("**/api/scripture/lookup?*", (route) =>
    route.fulfill({
      status: 503,
      json: {
        error: {
          code: "SCRIPTURE_VERSION_UNAVAILABLE",
          message: "Tra cứu tạm thời không khả dụng.",
        },
      },
    }),
  );
  await page.goto("/create");
  await page.getByRole("textbox", { name: /Câu Kinh Thánh tham khảo/u }).fill("Giăng 3:16");
  await expect(
    page.getByText(/Bạn vẫn có thể nhập câu hỏi và tạo phòng bình thường/u),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Thử tra cứu lại" })).toBeVisible();
  const prompt = page.locator(".prominent textarea");
  await prompt.fill("Câu hỏi thủ công vẫn sửa được");
  await expect(prompt).toHaveValue("Câu hỏi thủ công vẫn sửa được");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
});
