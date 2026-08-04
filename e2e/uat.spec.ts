import { expect, test } from "@playwright/test";
import type { GameDefinition } from "../shared/game";

const uatGame: GameDefinition = {
  title: "UAT tạm dừng",
  mode: "TURN_BASED",
  defaultDurationSec: 5,
  createdClientVersion: "uat",
  items: [
    {
      id: "uat-choice",
      type: "SINGLE_CHOICE",
      prompt: "Ai đã đánh bại Gô-li-át?",
      options: [
        { id: "david", text: "Đa-vít" },
        { id: "moses", text: "Môi-se" },
      ],
      correctOptionId: "david",
      durationSec: 5,
    },
  ],
};

const alignedCrosswordDraft: GameDefinition = {
  title: "UAT căn hàng dọc",
  mode: "TURN_BASED",
  defaultDurationSec: 20,
  createdClientVersion: "uat",
  items: [
    {
      id: "uat-crossword",
      type: "CROSSWORD",
      title: "Nhân vật Kinh Thánh",
      horizontalDurationSec: 20,
      verticalDurationSec: 30,
      verticalClue: "Từ khóa dọc",
      verticalAnswer: "ÔÁÔ",
      horizontalRows: [
        {
          id: "row-one",
          clue: "Môn đồ từng nghi ngờ",
          answer: "TÔ-MA",
          acceptedAliases: [],
          specialCellIndex: 1,
        },
        {
          id: "row-two",
          clue: "Con trai của Áp-ra-ham",
          answer: "I-SÁC",
          acceptedAliases: [],
          specialCellIndex: 2,
        },
        {
          id: "row-three",
          clue: "Người đóng tàu",
          answer: "NÔ-Ê",
          acceptedAliases: [],
          specialCellIndex: 1,
        },
      ],
    },
  ],
};

test.describe.configure({ mode: "serial" });

test("UAT — restores an ephemeral builder draft and serves installable PWA assets", async ({
  page,
  request,
}) => {
  await page.goto("/create");
  const poweredBy = page.getByRole("link", { name: /KNASOFTWARE/u });
  await expect(poweredBy).toBeVisible();
  await expect(poweredBy).toHaveAttribute("href", "https://www.knasoftware.com");
  await expect(poweredBy).toHaveAttribute("target", "_blank");
  const title = page.getByLabel("Tên game");
  await title.fill("Bản nháp UAT trên thiết bị");
  await page.reload();
  await expect(title).toHaveValue("Bản nháp UAT trên thiết bị");
  await expect(page.getByText(/Đã khôi phục bản nháp/)).toBeVisible();

  const manifestResponse = await request.get("/manifest.webmanifest");
  expect(manifestResponse.ok()).toBe(true);
  const manifest = (await manifestResponse.json()) as { icons?: Array<{ sizes?: string }> };
  expect(manifest.icons?.map((icon) => icon.sizes)).toEqual(["192x192", "512x512", "512x512"]);
  expect((await request.get("/icons/apple-touch-icon-180x180.png")).ok()).toBe(true);
  expect((await request.get("/icons/maskable-icon-512x512.png")).ok()).toBe(true);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

test("UAT — downloads an unfinished game and imports it on another device session", async ({
  browser,
  page,
}, testInfo) => {
  const usesNativeShare = testInfo.project.name.startsWith("mobile-");
  if (usesNativeShare) {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "canShare", {
        configurable: true,
        value: () => true,
      });
      Object.defineProperty(navigator, "share", {
        configurable: true,
        value: async (data: ShareData) => {
          const file = data.files?.[0];
          if (!file) throw new Error("UAT expected a shared configuration file");
          (
            globalThis as typeof globalThis & {
              __uatSharedConfig?: { name: string; text: string };
            }
          ).__uatSharedConfig = { name: file.name, text: await file.text() };
        },
      });
    });
  }

  await page.goto("/create");
  await page.getByLabel("Tên game").fill("Nhiều ngày nhiều thiết bị");
  await page
    .getByRole("textbox", { name: "Câu hỏi", exact: true })
    .fill("Câu hỏi đang viết dở để chuyển thiết bị");
  let importedFile: string | { name: string; mimeType: string; buffer: Buffer };
  if (usesNativeShare) {
    await page.getByRole("button", { name: /Tải.*cấu hình game/u }).click();
    await expect(page.getByText(/Đã chia sẻ cấu hình/u)).toBeVisible();
    const shared = await page.evaluate(
      () =>
        (
          globalThis as typeof globalThis & {
            __uatSharedConfig?: { name: string; text: string };
          }
        ).__uatSharedConfig,
    );
    expect(shared?.name).toMatch(/\.dkt\.json$/u);
    importedFile = {
      name: shared?.name ?? "uat.dkt.json",
      mimeType: "application/json",
      buffer: Buffer.from(shared?.text ?? ""),
    };
  } else {
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: /Tải.*cấu hình game/u }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.dkt\.json$/u);
    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();
    importedFile = downloadPath as string;
  }

  const otherDevice = await browser.newContext();
  const importedPage = await otherDevice.newPage();
  try {
    await importedPage.goto("/create");
    await importedPage.getByLabel("Chọn file cấu hình game").setInputFiles(importedFile);
    await expect(importedPage.getByRole("heading", { name: "Nhập cấu hình này?" })).toBeVisible();
    await importedPage.getByRole("button", { name: "Nhập và thay thế" }).click();
    await expect(importedPage.getByLabel("Tên game")).toHaveValue("Nhiều ngày nhiều thiết bị");
    await expect(importedPage.getByRole("textbox", { name: "Câu hỏi", exact: true })).toHaveValue(
      "Câu hỏi đang viết dở để chuyển thiết bị",
    );
    await expect(importedPage.getByText(/Bản nháp mới đã được lưu/u)).toBeVisible();
  } finally {
    await otherDevice.close();
  }
});

test("UAT — keeps every crossword vertical cell on one automatic column", async ({ page }) => {
  await page.addInitScript((draft) => {
    sessionStorage.setItem("dkt:builder-draft:v1", JSON.stringify(draft));
  }, alignedCrosswordDraft);
  await page.goto("/create");

  const specialCells = page.locator(".crossword-preview i.special");
  await expect(specialCells).toHaveCount(3);
  const xPositions = await specialCells.evaluateAll((cells) =>
    cells.map((cell) => cell.getBoundingClientRect().left),
  );
  expect(Math.max(...xPositions) - Math.min(...xPositions)).toBeLessThanOrEqual(1);

  await page.getByRole("button", { name: "Mở xem thử toàn màn hình" }).click();
  await expect(page).toHaveURL(/\/create\/preview/u);
  await expect(page.locator(".preview-pane.fullscreen")).toBeVisible();
  const phoneLayout = await page.evaluate(() => {
    const frame = document.querySelector<HTMLElement>(".game-preview");
    const crossword = document.querySelector<HTMLElement>(".crossword-preview");
    const cell = document.querySelector<HTMLElement>(".crossword-preview i:not(.alignment-spacer)");
    if (!frame || !crossword || !cell) throw new Error("Missing crossword preview layout");
    const frameBox = frame.getBoundingClientRect();
    const crosswordBox = crossword.getBoundingClientRect();
    return {
      centerDelta: Math.abs(
        frameBox.left + frameBox.width / 2 - (crosswordBox.left + crosswordBox.width / 2),
      ),
      cellWidth: cell.getBoundingClientRect().width,
    };
  });
  expect(phoneLayout.centerDelta).toBeLessThanOrEqual(2);
  expect(phoneLayout.cellWidth).toBeGreaterThanOrEqual(35);

  await page.getByRole("button", { name: "Máy tính / trình chiếu" }).click();
  const desktopLayout = await page.evaluate(() => {
    const frame = document.querySelector<HTMLElement>(".game-preview");
    const crossword = document.querySelector<HTMLElement>(".crossword-preview");
    const cell = document.querySelector<HTMLElement>(".crossword-preview i:not(.alignment-spacer)");
    if (!frame || !crossword || !cell) throw new Error("Missing crossword preview layout");
    const frameBox = frame.getBoundingClientRect();
    const crosswordBox = crossword.getBoundingClientRect();
    return {
      centerDelta: Math.abs(
        frameBox.left + frameBox.width / 2 - (crosswordBox.left + crosswordBox.width / 2),
      ),
      cellWidth: cell.getBoundingClientRect().width,
    };
  });
  expect(desktopLayout.centerDelta).toBeLessThanOrEqual(2);
  expect(desktopLayout.cellWidth).toBeGreaterThanOrEqual(47);

  const answerInput = page.getByLabel("Câu trả lời thử của Host");
  await expect(page.getByText("HÀNG NGANG 1 / 3")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Môn đồ từng nghi ngờ" })).toBeVisible();
  await answerInput.fill("to ma");
  await page.getByRole("button", { name: "Kiểm tra đáp án" }).click();
  await expect(page.getByText("Chính xác!")).toBeVisible();
  await expect(page.locator(".crossword-preview > div").nth(0)).toContainText("TÔMA");

  await page.getByRole("button", { name: "Hàng tiếp theo" }).click();
  await expect(page.getByText("HÀNG NGANG 2 / 3")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Con trai của Áp-ra-ham" })).toBeVisible();
  await answerInput.fill("sai");
  await page.getByRole("button", { name: "Kiểm tra đáp án" }).click();
  await expect(page.getByText("Chưa đúng")).toBeVisible();
  await expect(page.locator(".crossword-preview > div").nth(1)).toContainText("ISÁC");

  await page.getByRole("button", { name: "Hàng tiếp theo" }).click();
  await expect(page.getByText("HÀNG NGANG 3 / 3")).toBeVisible();
  await answerInput.fill("no e");
  await page.getByRole("button", { name: "Kiểm tra đáp án" }).click();
  await expect(page.getByText("Chính xác!")).toBeVisible();
  await page.getByRole("button", { name: "Đến từ khóa dọc" }).click();

  await expect(page.getByText("TỪ KHÓA DỌC · ĐIỂM ×2")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Từ khóa dọc" })).toBeVisible();
  await answerInput.fill("o a o");
  await page.getByRole("button", { name: "Kiểm tra đáp án" }).click();
  await expect(page.getByText("Mô phỏng: 2.000 điểm")).toBeVisible();
  await expect(page.getByRole("button", { name: "Chơi lại ô chữ" })).toBeVisible();
});

test("UAT — opens a full-screen builder preview for mobile and desktop layouts", async ({
  page,
}) => {
  await page.goto("/create");
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.getByRole("button", { name: "Mở xem thử toàn màn hình" }).click();
  await expect(page).toHaveURL(/\/create\/preview/u);
  await expect(page.locator(".builder-preview-page")).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);

  const preview = page.locator(".game-preview");
  await expect(preview).toHaveClass(/phone/u);
  await page.getByRole("button", { name: /Đa-vít/u }).click();
  await page.getByRole("button", { name: "Kiểm tra đáp án" }).click();
  await expect(page.getByText("Chính xác!")).toBeVisible();
  await page.getByRole("button", { name: "Thử lại câu này" }).click();
  await expect(page.getByRole("button", { name: "Kiểm tra đáp án" })).toBeDisabled();
  await page.getByRole("button", { name: "Máy tính / trình chiếu" }).click();
  await expect(preview).toHaveClass(/present/u);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);

  await page.getByRole("link", { name: "Quay lại chỉnh sửa" }).click();
  await expect(page).toHaveURL(/\/create$/u);
  await expect(page.getByLabel("Tên game")).toHaveValue("Hành trình Kinh Thánh");
});

test("UAT — host can pause beyond the deadline, reload, resume, and preserve the answer", async ({
  browser,
  request,
}, testInfo) => {
  const create = await request.post("/api/rooms", { data: { game: uatGame } });
  expect(create.status()).toBe(201);
  const room = (await create.json()) as {
    roomCode: string;
    hostUrl: string;
  };
  const hostContext = await browser.newContext();
  const playerContext = await browser.newContext();
  const host = await hostContext.newPage();
  const player = await playerContext.newPage();
  try {
    await host.goto(room.hostUrl);
    await player.goto(`/join/${room.roomCode}`);
    await player.getByLabel("Tên hiển thị").fill("Người chơi UAT");
    await player.getByRole("button", { name: /Vào phòng/ }).click();

    const feedback = player.getByRole("button", { name: "Bật âm thanh và rung" });
    await feedback.click();
    await expect(player.getByRole("button", { name: "Tắt âm thanh và rung" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    const recovery = host.getByRole("button", { name: /Sao chép link khôi phục host/ });
    await expect(recovery).toBeVisible();
    if (testInfo.project.name === "chromium") {
      await hostContext.grantPermissions(["clipboard-read", "clipboard-write"]);
      await recovery.click();
      await expect(host.getByRole("button", { name: /Đã sao chép link bí mật/ })).toBeVisible();
    }

    await host.getByRole("button", { name: "Bắt đầu game" }).click();
    const answer = player.getByRole("button", { name: /Đa-vít/ });
    await expect(answer).toBeVisible({ timeout: 15_000 });
    await answer.click();
    await host.getByRole("button", { name: "Tạm dừng" }).click();
    await expect(player.getByRole("heading", { name: "Người dẫn đã tạm dừng" })).toBeVisible();

    await player.waitForTimeout(5_500);
    await expect(player.getByRole("heading", { name: "Người dẫn đã tạm dừng" })).toBeVisible();
    await host.reload();
    await host.getByRole("button", { name: "Tiếp tục câu hỏi" }).click();
    await expect(answer).toHaveClass(/selected/u);
    await player.getByRole("button", { name: /Gửi câu trả lời/ }).click();
    await expect(player.getByText("Đã ghi nhận câu trả lời")).toBeVisible();
    await host.getByRole("button", { name: "Hiện đáp án" }).click();
    await expect(player.getByText("+1000 điểm")).toBeVisible();

    await player.reload();
    await expect(player.getByRole("button", { name: "Tắt âm thanh và rung" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  } finally {
    await Promise.all([hostContext.close(), playerContext.close()]);
  }
});
