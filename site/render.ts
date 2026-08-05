import { type Locale, SITE } from "./config";
import { alternateFor, PAGE_BY_PATH, PUBLIC_PAGES } from "./content";
import type { ContentSection, PublicPage } from "./types";

const LABELS = {
  vi: {
    skip: "Bỏ qua đến nội dung chính",
    nav: "Điều hướng chính",
    home: "Trang chủ",
    features: "Tính năng",
    how: "Cách hoạt động",
    modes: "Chế độ chơi",
    questions: "Dạng câu hỏi",
    guides: "Hướng dẫn",
    faq: "FAQ",
    language: "Ngôn ngữ",
    answer: "Tóm tắt trực tiếp",
    forWhom: "Trang này dành cho ai?",
    related: "Đọc tiếp",
    reviewed: "Rà soát lần cuối",
    breadcrumbs: "Đường dẫn trang",
    openGame: "Mở ứng dụng game",
    about: "Giới thiệu",
    editorial: "Chính sách biên tập",
    privacy: "Quyền riêng tư & dữ liệu",
    corrections: "Báo lỗi nội dung",
    product: "Sản phẩm",
    trust: "Thông tin",
  },
  en: {
    skip: "Skip to main content",
    nav: "Primary navigation",
    home: "Home",
    features: "Features",
    how: "How it works",
    modes: "Game modes",
    questions: "Question types",
    guides: "Guides",
    faq: "FAQ",
    language: "Language",
    answer: "Direct answer",
    forWhom: "Who is this page for?",
    related: "Related reading",
    reviewed: "Last reviewed",
    breadcrumbs: "Breadcrumb",
    openGame: "Open the game app",
    about: "About",
    editorial: "Editorial policy",
    privacy: "Privacy & data",
    corrections: "Report a content issue",
    product: "Product",
    trust: "Information",
  },
} as const;

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function absolute(path: string): string {
  return new URL(path, SITE.baseUrl).href;
}

function localeTag(locale: Locale): string {
  return locale === "vi" ? "vi-VN" : "en-US";
}

function ogLocale(locale: Locale): string {
  return locale === "vi" ? "vi_VN" : "en_US";
}

function pageTitle(page: PublicPage): string {
  return page.kind === "home" ? page.title : `${page.title} | ${SITE.name}`;
}

function pageCrumbs(page: PublicPage): PublicPage[] {
  const home = PAGE_BY_PATH.get(`/${page.locale}/`);
  if (!home) throw new Error(`Missing ${page.locale} homepage`);
  if (page.kind === "home") return [];
  const crumbs = [home];
  const parents = PUBLIC_PAGES.filter(
    (candidate) =>
      candidate.locale === page.locale &&
      candidate.path !== home.path &&
      candidate.path !== page.path &&
      page.path.startsWith(candidate.path),
  ).sort((left, right) => left.path.length - right.path.length);
  crumbs.push(...parents, page);
  return crumbs;
}

function breadcrumbSchema(page: PublicPage): Record<string, unknown> | undefined {
  const crumbs = pageCrumbs(page);
  if (crumbs.length === 0) return undefined;
  return {
    "@type": "BreadcrumbList",
    "@id": `${absolute(page.path)}#breadcrumb`,
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.kind === "home" ? LABELS[page.locale].home : crumb.h1,
      item: absolute(crumb.path),
    })),
  };
}

export function jsonLdGraph(page: PublicPage): Record<string, unknown> {
  const canonical = absolute(page.path);
  const image = absolute(SITE.socialImages[page.locale]);
  const language = localeTag(page.locale);
  const webpageType = page.kind === "about" ? "AboutPage" : "WebPage";
  const graph: Record<string, unknown>[] = [
    {
      "@type": webpageType,
      "@id": `${canonical}#webpage`,
      url: canonical,
      name: page.title,
      headline: page.h1,
      description: page.description,
      inLanguage: language,
      isPartOf: { "@id": `${SITE.baseUrl}/#website` },
      primaryImageOfPage: { "@id": `${canonical}#primaryimage` },
      dateModified: page.dateModified,
      ...(page.datePublished ? { datePublished: page.datePublished } : {}),
      ...(pageCrumbs(page).length > 0 ? { breadcrumb: { "@id": `${canonical}#breadcrumb` } } : {}),
    },
    {
      "@type": "ImageObject",
      "@id": `${canonical}#primaryimage`,
      url: image,
      contentUrl: image,
      width: SITE.socialImageWidth,
      height: SITE.socialImageHeight,
      caption: page.ogImageAlt,
      inLanguage: language,
    },
  ];

  const breadcrumb = breadcrumbSchema(page);
  if (breadcrumb) graph.push(breadcrumb);

  if (page.kind === "home") {
    graph.unshift(
      {
        "@type": "WebSite",
        "@id": `${SITE.baseUrl}/#website`,
        url: `${SITE.baseUrl}/`,
        name: SITE.name,
        inLanguage: ["vi-VN", "en-US"],
      },
      {
        "@type": "WebApplication",
        "@id": `${SITE.baseUrl}/#application`,
        name: SITE.name,
        url: SITE.gameUrl,
        applicationCategory: "GameApplication",
        operatingSystem: "Web",
        browserRequirements: "Requires a modern browser and a network connection for live play.",
        isAccessibleForFree: true,
        description: page.summary,
        inLanguage: ["vi-VN", "en-US"],
      },
    );
  }

  if (page.kind === "guide") {
    graph.push({
      "@type": "Article",
      "@id": `${canonical}#article`,
      headline: page.h1,
      description: page.description,
      url: canonical,
      mainEntityOfPage: { "@id": `${canonical}#webpage` },
      image,
      inLanguage: language,
      datePublished: page.datePublished,
      dateModified: page.dateModified,
    });
  }

  if (page.kind === "question-type") {
    graph.push({
      "@type": "LearningResource",
      "@id": `${canonical}#learning-resource`,
      name: page.h1,
      description: page.summary,
      url: canonical,
      inLanguage: language,
      learningResourceType: "Guide",
      isAccessibleForFree: true,
    });
  }

  if (page.kind === "faq" && page.faq) {
    graph.push({
      "@type": "FAQPage",
      "@id": `${canonical}#faq`,
      mainEntity: page.faq.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: { "@type": "Answer", text: item.answer },
      })),
      inLanguage: language,
    });
  }

  return { "@context": "https://schema.org", "@graph": graph };
}

function renderSection(section: ContentSection, index: number): string {
  const paragraphs =
    section.paragraphs?.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("") ?? "";
  const bullets = section.bullets
    ? `<ul>${section.bullets.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
    : "";
  const steps = section.steps
    ? `<ol>${section.steps.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol>`
    : "";
  return `<section class="content-section" aria-labelledby="section-${index}">
    <h2 id="section-${index}">${escapeHtml(section.title)}</h2>
    ${paragraphs}${bullets}${steps}
  </section>`;
}

function renderBreadcrumbs(page: PublicPage): string {
  const labels = LABELS[page.locale];
  const crumbs = pageCrumbs(page);
  if (crumbs.length === 0) return "";
  return `<nav class="breadcrumbs" aria-label="${labels.breadcrumbs}"><ol>${crumbs
    .map((crumb, index) => {
      const name = crumb.kind === "home" ? labels.home : crumb.h1;
      const current = index === crumbs.length - 1;
      return `<li>${current ? `<span aria-current="page">${escapeHtml(name)}</span>` : `<a href="${crumb.path}">${escapeHtml(name)}</a>`}</li>`;
    })
    .join("")}</ol></nav>`;
}

function renderFaq(page: PublicPage): string {
  if (!page.faq?.length) return "";
  return `<section class="faq-section" aria-labelledby="faq-heading">
    <h2 id="faq-heading">${page.locale === "vi" ? "Câu hỏi thường gặp" : "Frequently asked questions"}</h2>
    <div class="faq-list">${page.faq
      .map(
        (item) => `<details>
          <summary>${escapeHtml(item.question)}</summary>
          <div><p>${escapeHtml(item.answer)}</p>${
            item.href && item.hrefLabel
              ? `<p><a href="${item.href}">${escapeHtml(item.hrefLabel)}</a></p>`
              : ""
          }</div>
        </details>`,
      )
      .join("")}</div>
  </section>`;
}

function renderRelated(page: PublicPage): string {
  const labels = LABELS[page.locale];
  return `<aside class="related" aria-labelledby="related-heading">
    <h2 id="related-heading">${labels.related}</h2>
    <ul>${page.related
      .map((path) => {
        const target = PAGE_BY_PATH.get(path);
        if (!target) throw new Error(`Broken related link ${path} from ${page.path}`);
        return `<li><a href="${target.path}">${escapeHtml(target.h1)}</a></li>`;
      })
      .join("")}</ul>
  </aside>`;
}

function ctaHref(page: PublicPage): string {
  if (["privacy", "about", "host-guide"].includes(page.translationKey)) return SITE.gameUrl;
  return `${SITE.gameUrl}/create`;
}

function renderHeader(page: PublicPage, alternate: PublicPage): string {
  const labels = LABELS[page.locale];
  const prefix = `/${page.locale}`;
  return `<header class="site-header">
    <a class="brand" href="${prefix}/" aria-label="${SITE.name} — ${labels.home}">
      <img src="/icons/icon.svg" width="44" height="44" alt="" />
      <span>${SITE.name}</span>
    </a>
    <nav aria-label="${labels.nav}">
      <a href="${page.locale === "vi" ? "/vi/tinh-nang/" : "/en/features/"}">${labels.features}</a>
      <a href="${page.locale === "vi" ? "/vi/cach-hoat-dong/" : "/en/how-it-works/"}">${labels.how}</a>
      <a href="${page.locale === "vi" ? "/vi/che-do-choi/" : "/en/game-modes/"}">${labels.modes}</a>
      <a href="${page.locale === "vi" ? "/vi/dang-cau-hoi/" : "/en/question-types/"}">${labels.questions}</a>
      <a href="${page.locale === "vi" ? "/vi/huong-dan/" : "/en/guides/"}">${labels.guides}</a>
      <a href="${page.locale === "vi" ? "/vi/cau-hoi-thuong-gap/" : "/en/faq/"}">${labels.faq}</a>
    </nav>
    <div class="header-actions">
      <a class="language-link" href="${alternate.path}" hreflang="${alternate.locale}" lang="${alternate.locale}" aria-label="${labels.language}: ${alternate.locale === "vi" ? "Tiếng Việt" : "English"}">${alternate.locale === "vi" ? "VI" : "EN"}</a>
      <a class="button small" href="${SITE.gameUrl}">${labels.openGame}</a>
    </div>
  </header>`;
}

function renderFooter(page: PublicPage): string {
  const labels = LABELS[page.locale];
  const vi = page.locale === "vi";
  return `<footer class="site-footer">
    <div><a class="footer-brand" href="/${page.locale}/">${SITE.name}</a><p>${
      vi
        ? "Tự soạn, tạo phòng, cùng chơi và xóa dữ liệu tạm thời."
        : "Build, open a room, play together, and delete temporary data."
    }</p></div>
    <nav aria-label="${labels.product}">
      <strong>${labels.product}</strong>
      <a href="${vi ? "/vi/tinh-nang/" : "/en/features/"}">${labels.features}</a>
      <a href="${vi ? "/vi/huong-dan/" : "/en/guides/"}">${labels.guides}</a>
      <a href="${vi ? "/vi/cau-hoi-thuong-gap/" : "/en/faq/"}">${labels.faq}</a>
    </nav>
    <nav aria-label="${labels.trust}">
      <strong>${labels.trust}</strong>
      <a href="${vi ? "/vi/gioi-thieu/" : "/en/about/"}">${labels.about}</a>
      <a href="${vi ? "/vi/chinh-sach-bien-tap/" : "/en/editorial-policy/"}">${labels.editorial}</a>
      <a href="${vi ? "/vi/quyen-rieng-tu-va-vong-doi-du-lieu/" : "/en/privacy-and-data-lifecycle/"}">${labels.privacy}</a>
      <a href="${SITE.correctionUrl}">${labels.corrections}</a>
    </nav>
  </footer>`;
}

export function renderPage(page: PublicPage): string {
  const alternate = alternateFor(page);
  const labels = LABELS[page.locale];
  const canonical = absolute(page.path);
  const viHome = PUBLIC_PAGES.find(
    (candidate) => candidate.translationKey === page.translationKey && candidate.locale === "vi",
  );
  if (!viHome) throw new Error(`Missing Vietnamese alternate for ${page.path}`);
  const socialImage = absolute(SITE.socialImages[page.locale]);
  const schema = JSON.stringify(jsonLdGraph(page)).replaceAll("<", "\\u003c");
  const robots =
    page.noindex || page.draft
      ? "noindex,nofollow,noarchive,nosnippet"
      : "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1";
  const sections = page.sections.map(renderSection).join("");
  const alternateLocale = page.locale === "vi" ? "en_US" : "vi_VN";
  return `<!doctype html>
<html lang="${page.locale}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="theme-color" content="#10223d" />
  <title>${escapeHtml(pageTitle(page))}</title>
  <meta name="description" content="${escapeHtml(page.description)}" />
  <meta name="robots" content="${robots}" />
  <link rel="canonical" href="${canonical}" />
  <link rel="alternate" hreflang="vi" href="${absolute(viHome.path)}" />
  <link rel="alternate" hreflang="en" href="${absolute(alternateFor(viHome).path)}" />
  <link rel="alternate" hreflang="x-default" href="${absolute(viHome.path)}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="${SITE.name}" />
  <meta property="og:title" content="${escapeHtml(pageTitle(page))}" />
  <meta property="og:description" content="${escapeHtml(page.description)}" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:locale" content="${ogLocale(page.locale)}" />
  <meta property="og:locale:alternate" content="${alternateLocale}" />
  <meta property="og:image" content="${socialImage}" />
  <meta property="og:image:width" content="${SITE.socialImageWidth}" />
  <meta property="og:image:height" content="${SITE.socialImageHeight}" />
  <meta property="og:image:alt" content="${escapeHtml(page.ogImageAlt)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(pageTitle(page))}" />
  <meta name="twitter:description" content="${escapeHtml(page.description)}" />
  <meta name="twitter:image" content="${socialImage}" />
  <link rel="icon" href="/icons/favicon.ico" sizes="any" />
  <link rel="icon" type="image/svg+xml" href="/icons/icon.svg" />
  <link rel="apple-touch-icon" href="/icons/apple-touch-icon-180x180.png" />
  <link rel="stylesheet" href="/site/site.css" />
  <script type="application/ld+json">${schema}</script>
</head>
<body>
  <a class="skip-link" href="#main-content">${labels.skip}</a>
  ${renderHeader(page, alternate)}
  <main id="main-content">
    ${renderBreadcrumbs(page)}
    <article>
      <header class="page-hero${page.kind === "home" ? " home-hero" : ""}">
        <div class="hero-copy">
          <p class="eyebrow">${page.kind === "home" ? SITE.name : escapeHtml(page.title)}</p>
          <h1>${escapeHtml(page.h1)}</h1>
          <section class="answer-summary" aria-labelledby="answer-heading">
            <h2 id="answer-heading">${labels.answer}</h2>
            <p>${escapeHtml(page.summary)}</p>
          </section>
          <p class="audience"><strong>${labels.forWhom}</strong> ${escapeHtml(page.audience)}</p>
          <div class="hero-actions">
            <a class="button primary" href="${ctaHref(page)}">${escapeHtml(page.ctaLabel)}</a>
            ${page.kind === "home" ? `<a class="button secondary" href="${page.locale === "vi" ? "/vi/cach-hoat-dong/" : "/en/how-it-works/"}">${labels.how}</a>` : ""}
          </div>
        </div>
        <div class="hero-art" aria-hidden="true"><span>?</span><span>✓</span><span>★</span></div>
      </header>
      <div class="article-grid">
        <div class="article-content">${sections}${renderFaq(page)}</div>
        ${renderRelated(page)}
      </div>
      <p class="reviewed"><time datetime="${page.dateModified}">${labels.reviewed}: ${page.dateModified}</time></p>
    </article>
  </main>
  ${renderFooter(page)}
</body>
</html>`;
}

export function renderSitemap(): string {
  const entries = PUBLIC_PAGES.filter((page) => !page.draft && !page.noindex)
    .map((page) => {
      const alternate = alternateFor(page);
      const viPage = page.locale === "vi" ? page : alternate;
      const enPage = page.locale === "en" ? page : alternate;
      return `  <url>
    <loc>${absolute(page.path)}</loc>
    <lastmod>${page.dateModified}</lastmod>
    <xhtml:link rel="alternate" hreflang="vi" href="${absolute(viPage.path)}" />
    <xhtml:link rel="alternate" hreflang="en" href="${absolute(enPage.path)}" />
    <xhtml:link rel="alternate" hreflang="x-default" href="${absolute(viPage.path)}" />
  </url>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries}
</urlset>
`;
}

export function renderLlmsTxt(): string {
  const lines = [
    `# ${SITE.name}`,
    "",
    "A bilingual, account-free web application for building a Bible quiz, opening a temporary real-time room, and playing together on separate devices.",
    "Supported languages: Vietnamese (vi) and English (en).",
    "",
    `- Vietnamese homepage: ${SITE.baseUrl}/vi/`,
    `- English homepage: ${SITE.baseUrl}/en/`,
    "",
    "## Canonical public documentation",
    "",
  ];
  for (const page of PUBLIC_PAGES.filter((candidate) => candidate.kind !== "home")) {
    lines.push(`- ${page.h1}: ${absolute(page.path)}`);
  }
  lines.push(
    "",
    "## Live room boundary",
    "",
    `The interactive application is at ${SITE.gameUrl}. Live room, host, join, play, screen, result, token, and API URLs are temporary operational routes and are not part of the public documentation corpus.`,
    "",
  );
  return lines.join("\n");
}
