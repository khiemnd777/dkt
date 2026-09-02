import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ScriptureContext, ScriptureVersion } from "../../shared/scripture";
import { ScriptureReferenceField } from "../../src/features/builder/ScriptureReferenceField";
import { api } from "../../src/lib/api";

const version: ScriptureVersion = {
  provider: "youversion",
  id: 1638,
  abbreviation: "TEST",
  localizedTitle: "Bản dịch kiểm thử",
  languageTag: "vi",
  copyright: "Test copyright",
  attribution: "Test copyright",
  deepLink: "https://www.bible.com/versions/1638",
};
const context: ScriptureContext = {
  version,
  requestedScope: {
    provider: "youversion",
    bibleVersionId: 1638,
    bookUsfm: "JHN",
    chapter: 3,
    verseStart: 16,
    verseEnd: 16,
    passageId: "JHN.3.16",
  },
  chunks: [
    {
      reference: {
        provider: "youversion",
        bibleVersionId: 1638,
        bookUsfm: "JHN",
        chapter: 3,
        passageId: "JHN.3.16",
      },
      localizedReference: "Giăng 3:16",
      content: "Nội dung giả lập để kiểm thử.",
      contentSha256: "a".repeat(64),
      attribution: "Test copyright",
    },
  ],
};

async function debounce() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(600);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(api, "scriptureVersions").mockResolvedValue({ versions: [version] });
  vi.spyOn(api, "scriptureLookup").mockResolvedValue(context);
  vi.spyOn(api, "questionSuggestions").mockRejectedValue(new Error("AI must not be called"));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("standalone YouVersion reference field", () => {
  it("keeps manual editing usable with no requests when Scripture is disabled", async () => {
    const onChange = vi.fn();
    render(<ScriptureReferenceField value="Giăng 3:16" onChange={onChange} enabled={false} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Giăng 3:17" } });
    expect(onChange).toHaveBeenCalledWith("Giăng 3:17");
    await debounce();
    expect(screen.queryByText("Tra cứu YouVersion")).toBeNull();
    expect(api.scriptureVersions).not.toHaveBeenCalled();
    expect(api.scriptureLookup).not.toHaveBeenCalled();
  });

  it("debounces reference input and shows attributed text without calling AI or editing the game", async () => {
    const onChange = vi.fn();
    const view = render(<ScriptureReferenceField value="" onChange={onChange} enabled />);
    await debounce();
    expect(api.scriptureVersions).not.toHaveBeenCalled();
    view.rerender(<ScriptureReferenceField value="Giăng 3:16" onChange={onChange} enabled />);
    expect(api.scriptureLookup).not.toHaveBeenCalled();
    await debounce();
    expect(screen.getByText(context.chunks[0].content)).toBeTruthy();
    expect(screen.getByText("Test copyright")).toBeTruthy();
    expect(screen.queryByText(/Không dùng AI.*chỉ xem tại đây/u)).toBeNull();
    expect(screen.getByRole("link").getAttribute("href")).toBe(version.deepLink);
    expect(api.scriptureLookup).toHaveBeenCalledWith(1638, "Giăng 3:16", expect.any(AbortSignal));
    expect(api.questionSuggestions).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("aborts stale requests and never displays a result for a previous reference", async () => {
    let resolveOld: (value: ScriptureContext) => void = () => undefined;
    vi.mocked(api.scriptureLookup).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve;
        }),
    );
    const view = render(
      <ScriptureReferenceField value="Giăng 3:16" onChange={() => undefined} enabled />,
    );
    await debounce();
    const signal = vi.mocked(api.scriptureLookup).mock.calls[0][2];
    view.rerender(
      <ScriptureReferenceField value="Giăng 3:17" onChange={() => undefined} enabled />,
    );
    expect(signal?.aborted).toBe(true);
    await act(async () => {
      resolveOld(context);
    });
    expect(screen.queryByText(context.chunks[0].content)).toBeNull();
  });

  it("re-fetches the selected version without keeping the previous version's text", async () => {
    const otherVersion = { ...version, id: 449, abbreviation: "OTHER" };
    vi.mocked(api.scriptureVersions).mockResolvedValue({ versions: [version, otherVersion] });
    render(<ScriptureReferenceField value="Giăng 3:16" onChange={() => undefined} enabled />);
    await debounce();
    vi.mocked(api.scriptureLookup).mockResolvedValue({
      ...context,
      version: otherVersion,
      chunks: [{ ...context.chunks[0], content: "Nội dung bản dịch kiểm thử thứ hai." }],
    });
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "449" } });
    expect(screen.queryByText(context.chunks[0].content)).toBeNull();
    await debounce();
    expect(api.scriptureLookup).toHaveBeenLastCalledWith(
      449,
      "Giăng 3:16",
      expect.any(AbortSignal),
    );
    expect(screen.getByText("Nội dung bản dịch kiểm thử thứ hai.")).toBeTruthy();
    expect(api.scriptureVersions).toHaveBeenCalledTimes(1);
  });

  it("shows a retryable error without blocking manual editing", async () => {
    vi.mocked(api.scriptureLookup).mockRejectedValueOnce(new Error("Dịch vụ tạm ngừng"));
    render(<ScriptureReferenceField value="Giăng 3:16" onChange={() => undefined} enabled />);
    await debounce();
    expect(screen.getByText(/Dịch vụ tạm ngừng/)).toBeTruthy();
    expect(screen.getByRole("textbox").hasAttribute("disabled")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Thử tra cứu lại" }));
    await debounce();
    expect(screen.getByText(context.chunks[0].content)).toBeTruthy();
  });

  it("renders upstream content as text and rejects unsafe source links", async () => {
    const unsafe = {
      ...context,
      version: { ...version, deepLink: "javascript:alert(1)" },
      chunks: [{ ...context.chunks[0], content: "<img src=x onerror=alert(1)>" }],
    };
    vi.mocked(api.scriptureLookup).mockResolvedValue(unsafe);
    const view = render(
      <ScriptureReferenceField value="Giăng 3:16" onChange={() => undefined} enabled />,
    );
    await debounce();
    expect(screen.getByText(unsafe.chunks[0].content)).toBeTruthy();
    expect(view.container.querySelector("img")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("does not request a passage if no Vietnamese version is licensed", async () => {
    vi.mocked(api.scriptureVersions).mockResolvedValue({ versions: [] });
    render(<ScriptureReferenceField value="Giăng 3:16" onChange={() => undefined} enabled />);
    await debounce();
    expect(screen.getByText(/Chưa có bản dịch tiếng Việt/)).toBeTruthy();
    expect(api.scriptureLookup).not.toHaveBeenCalled();
  });
});
