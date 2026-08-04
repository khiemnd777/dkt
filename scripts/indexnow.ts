import { SITE } from "../site/config";
import { PUBLIC_PAGES } from "../site/content";

const key = process.env.INDEXNOW_KEY?.trim();
const args = process.argv.slice(2);
const allowDeleted = args.includes("--deleted");
const submitAll = args.includes("--all");
const requested = args.filter((argument) => !argument.startsWith("--"));
const published = new Set(
  PUBLIC_PAGES.filter((page) => !page.draft && !page.noindex).map(
    (page) => new URL(page.path, SITE.baseUrl).href,
  ),
);
const operationalPath =
  /^\/(?:api|create|join|play|host|screen|room|result|preview|draft)(?:\/|$)/u;

if (!key || !/^[A-Za-z0-9_-]{8,128}$/u.test(key)) {
  console.error("INDEXNOW_KEY is missing or invalid. Configure an 8–128 character key.");
  process.exit(1);
}

if (submitAll && requested.length > 0) {
  console.error("Use either --all or an explicit URL list, not both.");
  process.exit(1);
}

const urlList = submitAll
  ? [...published]
  : requested.map((value) => new URL(value, SITE.baseUrl).href);

if (urlList.length === 0) {
  console.error(
    "Provide materially changed public paths, for example: bun run indexnow -- /vi/ /en/. Use --all only for an intentional full resubmission.",
  );
  process.exit(1);
}

for (const value of urlList) {
  const url = new URL(value);
  if (url.origin !== SITE.baseUrl || operationalPath.test(url.pathname)) {
    console.error(`Rejected non-public or operational URL: ${url.href}`);
    process.exit(1);
  }
  if (!allowDeleted && !published.has(url.href)) {
    console.error(
      `URL is not a current canonical page: ${url.href}. Use --deleted only for a real moved/deleted public URL.`,
    );
    process.exit(1);
  }
}

const response = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({
    host: new URL(SITE.baseUrl).hostname,
    key,
    keyLocation: `${SITE.baseUrl}/${key}.txt`,
    urlList,
  }),
});

console.log(`IndexNow responded ${response.status} for ${urlList.length} public URL(s).`);
if (response.status === 429 || response.status >= 500) {
  const retryAfter = response.headers.get("retry-after");
  console.warn(
    `Temporary IndexNow failure; deployment should continue.${retryAfter ? ` Retry-After: ${retryAfter}.` : ""}`,
  );
} else if (!response.ok) {
  console.error(
    "IndexNow rejected the request. Check the key file, host, and submitted canonical URLs.",
  );
  process.exitCode = 1;
}
