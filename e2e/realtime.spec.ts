import {
  type APIRequestContext,
  type Browser,
  type BrowserContext,
  expect,
  type Page,
  test,
} from "@playwright/test";
import type { GameDefinition } from "../shared/game";

interface Bootstrap {
  roomCode: string;
  hostToken: string;
  screenToken: string;
  hostUrl: string;
  joinUrl: string;
  screenUrl: string;
}

const choiceItem = {
  id: "choice-1",
  type: "SINGLE_CHOICE" as const,
  prompt: "Ai đã đánh bại Gô-li-át?",
  options: [
    { id: "david", text: "Đa-vít" },
    { id: "moses", text: "Môi-se" },
  ],
  correctOptionId: "david",
  durationSec: 10,
};

function game(mode: GameDefinition["mode"] = "TURN_BASED"): GameDefinition {
  return {
    title: `E2E ${mode}`,
    mode,
    defaultDurationSec: 10,
    items: [choiceItem],
    createdClientVersion: "e2e",
  };
}

async function createRoom(
  request: APIRequestContext,
  definition: GameDefinition,
): Promise<Bootstrap> {
  const response = await request.post("/api/rooms", { data: { game: definition } });
  expect(response.status()).toBe(201);
  return response.json() as Promise<Bootstrap>;
}

async function newPage(browser: Browser): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext();
  return { context, page: await context.newPage() };
}

async function joinPlayer(page: Page, room: Bootstrap, name: string): Promise<void> {
  await page.goto(`/join/${room.roomCode}`);
  await page.getByLabel("Tên hiển thị").fill(name);
  await page.getByRole("button", { name: /Vào phòng/ }).click();
  await expect(page).toHaveURL(new RegExp(`/play/${room.roomCode}$`));
  await expect(page.getByText(`Chào ${name}!`)).toBeVisible();
}

async function answerChoice(page: Page): Promise<void> {
  await expect(page.getByRole("heading", { name: choiceItem.prompt })).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole("button", { name: /Đa-vít/ }).click();
  await page.getByRole("button", { name: /Gửi câu trả lời/ }).click();
  await expect(page.getByText("Đã ghi nhận câu trả lời")).toBeVisible();
}

async function revealAndLeaderboard(host: Page): Promise<void> {
  await host.getByRole("button", { name: "Hiện đáp án" }).click();
  await host.getByRole("button", { name: "Hiện bảng xếp hạng" }).click();
}

test.describe.configure({ mode: "serial" });

test("Scenario A — TURN_BASED gives every correct player exactly 1,000 points", async ({
  browser,
  request,
}) => {
  const room = await createRoom(request, game("TURN_BASED"));
  const host = await newPage(browser);
  const playerA = await newPage(browser);
  const playerB = await newPage(browser);
  const screen = await newPage(browser);
  try {
    await host.page.goto(room.hostUrl);
    await screen.page.goto(room.screenUrl);
    await joinPlayer(playerA.page, room, "An");
    await joinPlayer(playerB.page, room, "Bình");
    await expect(host.page.getByText("2", { exact: true }).first()).toBeVisible();
    await host.page.getByRole("button", { name: "Bắt đầu game" }).click();
    await Promise.all([answerChoice(playerA.page), answerChoice(playerB.page)]);
    await revealAndLeaderboard(host.page);
    await expect(
      playerA.page.getByRole("listitem").filter({ hasText: "An" }).getByText("1.000"),
    ).toBeVisible();
    await expect(
      playerB.page.getByRole("listitem").filter({ hasText: "Bình" }).getByText("1.000"),
    ).toBeVisible();
    await expect(screen.page.getByRole("heading", { name: "Bảng xếp hạng" })).toBeVisible();
    await host.page.getByRole("button", { name: "Hoàn tất game" }).click();
    await expect(playerA.page.getByRole("heading", { name: "Hoàn thành!" })).toBeVisible();
  } finally {
    await Promise.all([
      host.context.close(),
      playerA.context.close(),
      playerB.context.close(),
      screen.context.close(),
    ]);
  }
});

test("Scenario B — SPEED_RACE rewards both correct players and more to the faster player", async ({
  browser,
  request,
}) => {
  const room = await createRoom(request, game("SPEED_RACE"));
  const host = await newPage(browser);
  const playerA = await newPage(browser);
  const playerB = await newPage(browser);
  try {
    await host.page.goto(room.hostUrl);
    await joinPlayer(playerA.page, room, "Nhanh");
    await joinPlayer(playerB.page, room, "Chậm");
    await host.page.getByRole("button", { name: "Bắt đầu game" }).click();
    await expect(playerA.page.getByRole("heading", { name: choiceItem.prompt })).toBeVisible({
      timeout: 15_000,
    });
    await playerA.page.getByRole("button", { name: /Đa-vít/ }).click();
    await playerA.page.getByRole("button", { name: /Gửi câu trả lời/ }).click();
    await playerB.page.waitForTimeout(900);
    await answerChoice(playerB.page);
    await host.page.getByRole("button", { name: "Hiện đáp án" }).click();
    const scoreA = Number(
      (
        await playerA.page.locator(".personal-reveal > div:nth-child(2) strong").innerText()
      ).replace(/\D/gu, ""),
    );
    const scoreB = Number(
      (
        await playerB.page.locator(".personal-reveal > div:nth-child(2) strong").innerText()
      ).replace(/\D/gu, ""),
    );
    expect(scoreA).toBeGreaterThan(scoreB);
    expect(scoreB).toBeGreaterThanOrEqual(500);
  } finally {
    await Promise.all([host.context.close(), playerA.context.close(), playerB.context.close()]);
  }
});

test("Scenario B2 — MULTIPLE_CHOICE requires explicit submit and exact answer set", async ({
  browser,
  request,
}) => {
  const multipleChoice: GameDefinition = {
    title: "Nhiều đáp án E2E",
    mode: "TURN_BASED",
    defaultDurationSec: 10,
    createdClientVersion: "e2e",
    items: [
      {
        id: "multiple-1",
        type: "MULTIPLE_CHOICE",
        prompt: "Những ai là con trai của Nô-ê?",
        options: [
          { id: "shem", text: "Sem" },
          { id: "ham", text: "Cham" },
          { id: "abraham", text: "Áp-ra-ham" },
        ],
        correctOptionIds: ["shem", "ham"],
      },
    ],
  };
  const room = await createRoom(request, multipleChoice);
  const host = await newPage(browser);
  const correctPlayer = await newPage(browser);
  const wrongPlayer = await newPage(browser);
  try {
    await host.page.goto(room.hostUrl);
    await joinPlayer(correctPlayer.page, room, "Đủ Bộ");
    await joinPlayer(wrongPlayer.page, room, "Thừa Một");
    await host.page.getByRole("button", { name: "Bắt đầu game" }).click();
    await expect(
      correctPlayer.page.getByRole("heading", { name: "Những ai là con trai của Nô-ê?" }),
    ).toBeVisible({ timeout: 15_000 });

    await correctPlayer.page.getByRole("button", { name: /Sem/ }).click();
    await expect(
      correctPlayer.page.getByRole("button", { name: /Gửi câu trả lời/ }),
    ).toBeDisabled();
    await correctPlayer.page.getByRole("button", { name: /Cham/ }).click();
    await correctPlayer.page.getByRole("button", { name: /Gửi câu trả lời/ }).click();

    await wrongPlayer.page.getByRole("button", { name: /Sem/ }).click();
    await wrongPlayer.page.getByRole("button", { name: /Áp-ra-ham/ }).click();
    await wrongPlayer.page.getByRole("button", { name: /Gửi câu trả lời/ }).click();
    await host.page.getByRole("button", { name: "Hiện đáp án" }).click();

    await expect(correctPlayer.page.getByText("Chính xác!", { exact: true })).toBeVisible();
    await expect(correctPlayer.page.getByText("+1000 điểm", { exact: true })).toBeVisible();
    await expect(wrongPlayer.page.getByText("Chưa đúng", { exact: true })).toBeVisible();
  } finally {
    await Promise.all([
      host.context.close(),
      correctPlayer.context.close(),
      wrongPlayer.context.close(),
    ]);
  }
});

test("Scenario C — crossword reveals the vertical answer after the final horizontal row", async ({
  browser,
  request,
}) => {
  const crossword: GameDefinition = {
    title: "Ô chữ E2E",
    mode: "TURN_BASED",
    defaultDurationSec: 10,
    createdClientVersion: "e2e",
    items: [
      {
        id: "crossword-1",
        type: "CROSSWORD",
        title: "Nhân vật",
        horizontalDurationSec: 10,
        verticalClue: "Từ khóa dọc",
        verticalAnswer: "ÔÁÔ",
        horizontalRows: [
          {
            id: "r1",
            clue: "Môn đồ nghi ngờ",
            answer: "TÔ-MA",
            acceptedAliases: [],
            specialCellIndex: 1,
          },
          {
            id: "r2",
            clue: "Con Áp-ra-ham",
            answer: "I-SÁC",
            acceptedAliases: [],
            specialCellIndex: 2,
          },
          {
            id: "r3",
            clue: "Người đóng tàu",
            answer: "NÔ-Ê",
            acceptedAliases: [],
            specialCellIndex: 1,
          },
        ],
      },
    ],
  };
  const room = await createRoom(request, crossword);
  const host = await newPage(browser);
  const player = await newPage(browser);
  const screen = await newPage(browser);
  try {
    await host.page.goto(room.hostUrl);
    await screen.page.goto(room.screenUrl);
    await joinPlayer(player.page, room, "Ô Chữ");
    await host.page.getByRole("button", { name: "Bắt đầu game" }).click();
    const specialCells = screen.page.locator(".board-row i.special");
    await expect(specialCells).toHaveCount(3);
    const xPositions = await specialCells.evaluateAll((cells) =>
      cells.map((cell) => cell.getBoundingClientRect().left),
    );
    expect(Math.max(...xPositions) - Math.min(...xPositions)).toBeLessThanOrEqual(1);

    await expect(
      player.page.getByRole("button", { name: /Giải hàng dọc.*2.000 điểm/ }),
    ).toBeVisible({
      timeout: 15_000,
    });
    await player.page.getByRole("button", { name: /Giải hàng dọc/ }).click();
    await expect(player.page.getByText("Từ khóa dọc", { exact: true })).toBeVisible();
    await player.page.getByLabel("Đáp án hàng dọc").fill("ÔÁÔ");
    await player.page.getByRole("button", { name: "Chốt đáp án hàng dọc" }).click();
    await expect(player.page.getByText("Đã dùng lượt giải hàng dọc")).toBeVisible();
    await expect(screen.page.getByText("ÔÁÔ", { exact: true })).toHaveCount(0);

    const answers = ["TÔ-MA", "I-SÁC", "NÔ-Ê"];
    for (let index = 0; index < answers.length; index += 1) {
      await expect(player.page.getByLabel("Câu trả lời của bạn")).toBeVisible({ timeout: 15_000 });
      await player.page.getByLabel("Câu trả lời của bạn").fill(answers[index]);
      await player.page.getByRole("button", { name: /Gửi câu trả lời/ }).click();
      await host.page.getByRole("button", { name: "Hiện đáp án" }).click();
      await expect(screen.page.getByText(answers[index], { exact: true })).toBeVisible();
      if (index === 0) {
        await expect(player.page.getByText("Hàng dọc: Chính xác!")).toBeVisible();
        await expect(player.page.getByText("+2000 điểm thưởng")).toBeVisible();
      }
      if (index < answers.length - 1) {
        await expect(screen.page.getByText("ÔÁÔ", { exact: true })).toHaveCount(0);
      } else {
        await expect(screen.page.getByText("ÔÁÔ", { exact: true })).toBeVisible();
        await expect(player.page.getByText("Đáp án hàng dọc")).toBeVisible();
        await expect(player.page.getByText("ÔÁÔ", { exact: true })).toBeVisible();
      }
      await host.page.getByRole("button", { name: "Hiện bảng xếp hạng" }).click();
      await host.page
        .getByRole("button", {
          name: index === answers.length - 1 ? "Hoàn tất game" : "Câu tiếp theo",
        })
        .click();
    }
    await expect(screen.page.getByRole("heading", { name: "Kết quả chung cuộc" })).toBeVisible();
  } finally {
    await Promise.all([host.context.close(), player.context.close(), screen.context.close()]);
  }
});

test("Scenario D — reload reconnects the same player and keeps a submitted answer locked", async ({
  browser,
  request,
}) => {
  const room = await createRoom(request, game());
  const host = await newPage(browser);
  const playerA = await newPage(browser);
  const playerB = await newPage(browser);
  try {
    await host.page.goto(room.hostUrl);
    await joinPlayer(playerA.page, room, "Trở Lại");
    await joinPlayer(playerB.page, room, "Giữ Vòng");
    await host.page.getByRole("button", { name: "Bắt đầu game" }).click();
    await answerChoice(playerA.page);
    await playerA.page.reload();
    await expect(playerA.page.getByText("Đã ghi nhận câu trả lời")).toBeVisible({
      timeout: 10_000,
    });
    await expect(playerA.page.getByRole("button", { name: "Đã ghi nhận" })).toBeDisabled();
    await answerChoice(playerB.page);
    await host.page.getByRole("button", { name: "Hiện đáp án" }).click();
    await expect(playerA.page.getByText("+1000 điểm")).toBeVisible();
  } finally {
    await Promise.all([host.context.close(), playerA.context.close(), playerB.context.close()]);
  }
});

test("Scenario E — immediate deletion removes APIs and invalidates reconnect", async ({
  browser,
  request,
}) => {
  const room = await createRoom(request, game());
  const host = await newPage(browser);
  const player = await newPage(browser);
  try {
    await host.page.goto(room.hostUrl);
    await joinPlayer(player.page, room, "Tạm Thời");
    await host.page.getByRole("button", { name: /Kết thúc và xóa phòng ngay/ }).click();
    await host.page.getByRole("button", { name: "Xóa toàn bộ phòng" }).click();
    await expect(player.page.getByRole("heading", { name: "Phòng đã được xóa" })).toBeVisible();
    const metadata = await request.get(`/api/rooms/${room.roomCode}/public`);
    expect(metadata.status()).toBe(404);
    const reconnect = await request.post(`/api/rooms/${room.roomCode}/ws-ticket`, {
      headers: { Authorization: `Bearer ${room.hostToken}` },
      data: { role: "HOST" },
    });
    expect(reconnect.status()).toBe(404);
  } finally {
    await Promise.all([host.context.close(), player.context.close()]);
  }
});
