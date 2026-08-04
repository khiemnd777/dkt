import type { Locale } from "./config";

export type PageKind =
  | "home"
  | "webpage"
  | "guide-index"
  | "guide"
  | "question-type"
  | "faq"
  | "about"
  | "editorial"
  | "privacy";

export interface ContentSection {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
  steps?: string[];
}

export interface FaqItem {
  question: string;
  answer: string;
  href?: string;
  hrefLabel?: string;
}

export interface PublicPage {
  translationKey: string;
  locale: Locale;
  path: `/${string}/`;
  kind: PageKind;
  title: string;
  description: string;
  h1: string;
  summary: string;
  audience: string;
  sections: ContentSection[];
  faq?: FaqItem[];
  related: string[];
  ctaLabel: string;
  datePublished?: string;
  dateModified: string;
  ogImageAlt: string;
  draft?: boolean;
  noindex?: boolean;
}
