import { describe, expect, it } from "vitest";
import { CONTACT_CHANNELS } from "../../shared/contact";
import { PUBLIC_ROBOTS, SITE } from "../../site/config";
import { alternateFor, PAGE_BY_PATH, PUBLIC_PAGES } from "../../site/content";
import { jsonLdGraph, renderLlmsTxt, renderPage, renderSitemap } from "../../site/render";

function documentFor(path: string): Document {
  const page = PAGE_BY_PATH.get(path);
  if (!page) throw new Error(`Missing test page ${path}`);
  return new DOMParser().parseFromString(renderPage(page), "text/html");
}

describe("static SEO and AIEO publishing gates", () => {
  it("publishes complete, unique, JavaScript-independent HTML for every locale route", () => {
    const titles = new Set<string>();
    const canonicals = new Set<string>();
    for (const page of PUBLIC_PAGES) {
      const document = documentFor(page.path);
      expect(document.documentElement.lang).toBe(page.locale);
      expect(document.title.length).toBeGreaterThan(20);
      expect(titles.has(document.title)).toBe(false);
      titles.add(document.title);
      expect(document.querySelector('meta[name="description"]')?.getAttribute("content")).toBe(
        page.description,
      );
      expect(document.querySelector("h1")?.textContent).toBe(page.h1);
      expect(document.querySelector("main")?.textContent?.trim().length).toBeGreaterThan(250);
      expect(document.querySelector('meta[name="robots"]')?.getAttribute("content")).toContain(
        "index,follow",
      );
      expect(document.querySelector('script[type="module"]')).toBeNull();
      const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute("href");
      expect(canonical).toBe(new URL(page.path, SITE.baseUrl).href);
      expect(canonicals.has(canonical ?? "")).toBe(false);
      canonicals.add(canonical ?? "");
      expect(document.querySelector('meta[property="og:image"]')?.getAttribute("content")).toMatch(
        /^https:\/\/dokinhthanh\.io\.vn\/social\//u,
      );
    }
  });

  it("creates reciprocal vi/en/x-default relationships", () => {
    for (const page of PUBLIC_PAGES) {
      const alternate = alternateFor(page);
      const document = documentFor(page.path);
      const links = new Map(
        Array.from(document.querySelectorAll('link[rel="alternate"][hreflang]')).map((link) => [
          link.getAttribute("hreflang"),
          link.getAttribute("href"),
        ]),
      );
      expect(links.get(alternate.locale)).toBe(new URL(alternate.path, SITE.baseUrl).href);
      const vi = page.locale === "vi" ? page : alternate;
      expect(links.get("x-default")).toBe(new URL(vi.path, SITE.baseUrl).href);
      expect(alternateFor(alternate).path).toBe(page.path);
    }
  });

  it("keeps all crawlable internal links valid and all IDs unique", () => {
    const publicAssets = ["/icons/", "/site/", "/social/"];
    for (const page of PUBLIC_PAGES) {
      const document = documentFor(page.path);
      const ids = Array.from(document.querySelectorAll("[id]"), (element) => element.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const anchor of document.querySelectorAll<HTMLAnchorElement>("a[href]")) {
        const href = anchor.getAttribute("href") ?? "";
        if (!href.startsWith("/") || href.startsWith("//")) continue;
        expect(
          PAGE_BY_PATH.has(href) || publicAssets.some((prefix) => href.startsWith(prefix)),
          `${page.path} has broken link ${href}`,
        ).toBe(true);
        expect(anchor.textContent?.trim().length).toBeGreaterThan(0);
      }
      for (const image of document.querySelectorAll("img")) {
        expect(image.hasAttribute("alt")).toBe(true);
        expect(image.hasAttribute("width")).toBe(true);
        expect(image.hasAttribute("height")).toBe(true);
      }
      expect(document.querySelector('a[href="#main-content"]')).not.toBeNull();
      expect(document.querySelectorAll("nav[aria-label]").length).toBeGreaterThan(1);
      expect(
        document.querySelector(`a[href="${SITE.correctionUrl}"]`)?.textContent?.trim().length,
      ).toBeGreaterThan(0);
      for (const channel of CONTACT_CHANNELS) {
        const contactLink = document.querySelector<HTMLAnchorElement>(
          `.footer-contact a[href="${channel.href}"]`,
        );
        expect(contactLink?.textContent?.trim()).toBe(channel.label);
        expect(contactLink?.getAttribute("aria-label")).toContain(channel.handle);
        if (channel.href.startsWith("https://")) {
          expect(contactLink?.getAttribute("target")).toBe("_blank");
          expect(contactLink?.getAttribute("rel")).toContain("noopener");
        }
      }
    }
  });

  it("emits parseable JSON-LD that matches visible page entities", () => {
    for (const page of PUBLIC_PAGES) {
      const document = documentFor(page.path);
      const blocks = document.querySelectorAll<HTMLScriptElement>(
        'script[type="application/ld+json"]',
      );
      expect(blocks.length).toBe(1);
      const parsed = JSON.parse(blocks[0].textContent ?? "") as {
        "@graph": Array<Record<string, unknown>>;
      };
      expect(parsed).toEqual(jsonLdGraph(page));
      expect(
        parsed["@graph"].some((node) => node.headline === page.h1 || node.name === page.h1),
      ).toBe(true);
      const serialized = JSON.stringify(parsed);
      expect(serialized).not.toContain("AggregateRating");
      expect(serialized).not.toContain("reviewCount");
      expect(serialized).not.toContain('"author"');
    }
  });

  it("generates a valid canonical-only sitemap with reciprocal alternates", () => {
    const xml = renderSitemap();
    const document = new DOMParser().parseFromString(xml, "application/xml");
    expect(document.querySelector("parsererror")).toBeNull();
    const urls = Array.from(document.getElementsByTagName("url"));
    expect(urls.length).toBe(PUBLIC_PAGES.length);
    const locations = urls.map((entry) => entry.getElementsByTagName("loc")[0]?.textContent ?? "");
    expect(new Set(locations).size).toBe(locations.length);
    for (const location of locations) {
      expect(location.startsWith(`${SITE.baseUrl}/`)).toBe(true);
      expect(location).not.toContain("game.dokinhthanh.io.vn");
      expect(location).not.toMatch(/\/(?:create|join|play|host|screen)\//u);
    }
    for (const entry of urls) {
      expect(entry.getElementsByTagName("lastmod")[0]?.textContent).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
      expect(entry.getElementsByTagNameNS("http://www.w3.org/1999/xhtml", "link").length).toBe(3);
    }
  });

  it("publishes explicit crawler policy and a bounded llms content map", () => {
    expect(PUBLIC_ROBOTS).toContain("User-agent: OAI-SearchBot\nAllow: /");
    expect(PUBLIC_ROBOTS).toContain("User-agent: OAI-SearchBot\nAllow: /\nDisallow: /api/");
    expect(PUBLIC_ROBOTS).toContain("User-agent: GPTBot\nDisallow: /");
    expect(PUBLIC_ROBOTS).toContain(`Sitemap: ${SITE.baseUrl}/sitemap.xml`);
    expect(PUBLIC_ROBOTS).not.toContain("User-agent: *\nDisallow: /");
    const llms = renderLlmsTxt();
    expect(llms).toContain(`${SITE.baseUrl}/vi/`);
    expect(llms).toContain(`${SITE.baseUrl}/en/`);
    expect(llms).toContain("temporary operational routes");
    expect(llms).not.toMatch(/\/(?:join|play|host|screen)\/[A-Z2-9]{6}/u);
  });
});
