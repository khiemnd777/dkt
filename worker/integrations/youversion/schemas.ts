import { z } from "zod";

const identifierSchema = z.union([z.string().min(1), z.number().int().positive()]);

export const youVersionBibleSchema = z
  .object({
    id: identifierSchema,
    abbreviation: z.string().min(1),
    localized_abbreviation: z.string().min(1).optional(),
    title: z.string().min(1).optional(),
    localized_title: z.string().min(1).optional(),
    language_tag: z.string().min(2),
    copyright: z.string().default(""),
    promotional_content: z.string().optional(),
    publisher_url: z.string().url().optional(),
    organization_id: identifierSchema.optional(),
    youversion_deep_link: z.string().url().optional(),
  })
  .passthrough();

export const youVersionBibleCollectionSchema = z
  .object({
    data: z.array(youVersionBibleSchema),
    next_page_token: z.string().min(1).nullable().optional(),
  })
  .passthrough();

const youVersionVerseSchema = z
  .object({
    id: z.string().regex(/^\d+$/u),
    passage_id: z.string().min(5),
    title: z.string().min(1),
  })
  .passthrough();

const youVersionChapterSchema = z
  .object({
    id: z.string().regex(/^\d+$/u),
    passage_id: z.string().min(5),
    title: z.string().min(1),
    verses: z.array(youVersionVerseSchema).default([]),
  })
  .passthrough();

export const youVersionBookSchema = z
  .object({
    id: z.string().regex(/^(?:[1-3][A-Z]{2}|[A-Z]{3})$/u),
    title: z.string().min(1),
    full_title: z.string().min(1).optional(),
    abbreviation: z.string().min(1),
    chapters: z.array(youVersionChapterSchema).default([]),
  })
  .passthrough();

export const youVersionIndexSchema = z
  .object({
    books: z.array(youVersionBookSchema),
  })
  .passthrough();

export const youVersionPassageSchema = z
  .object({
    id: z.string().min(5).optional(),
    content: z.string().min(1).optional(),
    text: z.string().min(1).optional(),
    reference: z.string().min(1),
    copyright: z.string().optional(),
  })
  .passthrough()
  .refine((value) => Boolean(value.content ?? value.text), "Missing passage content");

export type YouVersionBible = z.infer<typeof youVersionBibleSchema>;
