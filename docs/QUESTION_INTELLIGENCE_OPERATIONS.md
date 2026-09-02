# Question Intelligence and YouVersion operations

This runbook covers deployment only. The 2026-09-02 production release enables standalone Scripture
lookup for KTHD/VCB (Bible 1638) and ordinary question media in `wrangler.jsonc`; all `AI_*` flags remain
`false`. Media-free manual authoring and existing media-free rooms do not depend on YouVersion, OpenAI or R2.
The builder capability-checks `/api/health` and fail-closes: disabled or unavailable integrations are
not mounted and do not issue provider requests. Manual authoring, room creation, and gameplay remain
the baseline experience.

## Standalone reference lookup (no AI)

Each question's Bible reference input, including crossword vertical and horizontal references,
has an independent YouVersion lookup controlled **only** by `SCRIPTURE_PROVIDER_ENABLED`.
After 600 ms without typing a complete address, it selects an available Vietnamese version and
requests `GET /api/scripture/lookup?versionId=...&reference=...`. Localized names/abbreviations from
the version index, accent-insensitive input, canonical USFM IDs, chapters and same-chapter verse
ranges are supported. Ambiguous/invalid addresses are rejected, never guessed.

The response is `no-store`; text is rendered as plain text with the version's attribution, held
only in component memory, and is never inserted into the game, draft, export or an AI prompt.
Switching references/questions cancels stale requests. Errors leave manual authoring usable.

To release lookup alone, verify the app/version license permits passage display, provision
`YVP_APP_KEY`, set `YVP_ALLOWED_BIBLE_IDS` to the approved IDs and enable
`SCRIPTURE_PROVIDER_ENABLED`. **Keep all `AI_*` flags false.** The current Biblica/VCB approval
does not authorize the AI quiz-generation use case; do not turn on AI just to show this lookup.
The production release enables lookup only for approved Bible ID `1638`; AI remains off.

Production prerequisites verified for this release: `YVP_APP_KEY` is an encrypted Worker secret;
`QUESTION_MEDIA_SIGNING_KEY` was independently generated and stored directly as a Worker secret;
the private `do-kinh-thanh-question-media` bucket has the `expire-temp-24h` lifecycle rule scoped
to `temp/` with one-day expiry. No local `.dev.vars` file is uploaded or committed.

## AI release blockers

Do not enable AI generation in production until all of these are recorded outside the repository:

1. YouVersion has approved the exact non-commercial application/use case.
2. At least one Vietnamese Bible ID is accessible to this App Key.
3. Its publisher/license permits bounded passage display, transmission to OpenAI with `store:false`,
   generated derivative quiz wording, attribution, and the reference/hash metadata retained here.
4. The privacy notice covers OpenAI API retention, image moderation, audio transcription, and the
   24-hour R2 lifecycle.
5. The production Turnstile widget supports both `create-room` and `question-generation` actions.
6. Golden/eval fixtures for the approved translation meet the release thresholds in the architecture
   plan. Human approval remains mandatory; no candidate is auto-published.

Run the opt-in live Bible probe only after setting local secret environment values:

```bash
bun run probe:youversion
```

The probe validates the real provider schemas for version metadata, the book index and one verse;
it prints only the version name/status, never the App Key or passage text.

## Local secrets

`.dev.vars` is local-only and gitignored. It may contain `OPENAI_API_KEY` and a development YouVersion
key. Never copy that file into a container image, Static Assets output, CI artifact, or frontend `VITE_*`
variable.

Generate independent random HMAC secrets for local testing. Do not reuse the OpenAI or YouVersion key:

```bash
openssl rand -base64 48
```

Store separate values as `PROVENANCE_SIGNING_KEY`, `GENERATION_ABUSE_HMAC_KEY`, and
`QUESTION_MEDIA_SIGNING_KEY`.

## Production secrets

Production keys are encrypted Cloudflare Worker secrets, not Wrangler vars and not GitHub build
variables. Provision each value interactively or through the approved secret-management workflow:

```bash
bunx wrangler secret put YVP_APP_KEY
bunx wrangler secret put OPENAI_API_KEY
bunx wrangler secret put PROVENANCE_SIGNING_KEY
bunx wrangler secret put GENERATION_ABUSE_HMAC_KEY
bunx wrangler secret put QUESTION_MEDIA_SIGNING_KEY
```

`wrangler secret put` creates and deploys a new Worker version. Run it only after the disabled-feature
baseline Worker exists, or use Cloudflare's versioned secret workflow/dashboard when the production
change must remain pending until a reviewed deployment. Verify names without revealing values:

```bash
bunx wrangler secret list
```

The OpenAI key should be the restricted project key named `bible-quizzle`; apply the minimum project
permissions needed for Responses, Moderations, and Audio Transcriptions, and set project spend/rate
limits. Rotating production does not require changing `.dev.vars`.

## R2

The image/MP3 editor is already implemented for all question types (including crossword rows),
but is hidden when `QUESTION_MEDIA_ENABLED=false`. It is **not** a separate answer type.
Upload, preview/playback, room binding and package import/export are independent of AI and YouVersion.
The only media dependencies are `QUESTION_MEDIA_ENABLED`, the private `QUESTION_MEDIA` R2 binding and
`QUESTION_MEDIA_SIGNING_KEY`. All `AI_*` flags may remain false and `OPENAI_API_KEY` may be absent.
Uploads validate file signature/type, size, dimensions/duration, metadata and host rights attestation;
they do not send files or descriptions to OpenAI. Stored metadata records `validationStatus=PASSED`,
not semantic moderation approval. Legacy `moderationStatus=PASSED` assets remain readable only until
their existing expiry. Signed capabilities, room scoping and 24-hour access expiry are unchanged.
Before enabling uploads, verify the signing key, privacy notice and R2 lifecycle.

Only an explicit request in the optional AI assistant sends selected media to OpenAI. That route
requires both `AI_QUESTION_SUGGESTIONS_ENABLED` and `AI_MEDIA_ANALYSIS_ENABLED`, as well as OpenAI and
the normal generation prerequisites. Image moderation or audio transcription/text moderation happen
there, not during ordinary upload or gameplay. The assistant displays the submission notice at selection.

For local end-to-end media checks, set `QUESTION_MEDIA_ENABLED=true` and an independent
`QUESTION_MEDIA_SIGNING_KEY` in gitignored `.dev.vars`, keeping all `AI_*` flags false, then run:

```bash
bun run test:e2e -- e2e/question-media.spec.ts --project=chromium
```

These opt-in tests exercise actual uploads and ZIP export/re-import and skip when local media is
disabled. Unit and Worker media tests always run, with no OpenAI key and external fetch calls rejected.

Create the private buckets named in `wrangler.jsonc` before deployment:

```bash
bunx wrangler r2 bucket create do-kinh-thanh-question-media
bunx wrangler r2 bucket create do-kinh-thanh-question-media-preview
```

Apply a lifecycle rule that deletes objects under `temp/` after one day (or the smallest supported
period). There is no public bucket URL. Media delivery is same-origin through signed Worker routes.

```bash
bunx wrangler r2 bucket lifecycle add do-kinh-thanh-question-media expire-temp-24h temp/ --expire-days 1
bunx wrangler r2 bucket lifecycle add do-kinh-thanh-question-media-preview expire-temp-24h temp/ --expire-days 1
bunx wrangler r2 bucket lifecycle list do-kinh-thanh-question-media
bunx wrangler r2 bucket lifecycle list do-kinh-thanh-question-media-preview
```

The build finalizer removes the Cloudflare Vite plugin's local `.dev.vars` copy, and the free-tier
check fails if any `.dev.vars` or `.env*` file remains under `dist/`.

## Safe enablement order

1. Deploy the code and Durable Object migration while every new feature flag remains `false`.
2. To release ordinary media, provision the private R2 bucket, lifecycle and independent media signing
   key, then enable `QUESTION_MEDIA_ENABLED`. Verify upload/playback/room creation with all AI flags off.
3. Independently, to release Scripture lookup, provision `YVP_APP_KEY`, set `YVP_ALLOWED_BIBLE_IDS` to
   approved IDs, enable `SCRIPTURE_PROVIDER_ENABLED` and run version/index/passage smoke tests.
4. AI is optional and is not a prerequisite for steps 2 or 3. Only after the AI release blockers above
   are cleared, provision the AI-specific secrets and enable `AI_QUESTION_SUGGESTIONS_ENABLED` for a
   small audience. Keep Auto Balance and AI media analysis off initially.
5. Enable `AI_AUTO_BALANCE_ENABLED` after eval/cost review. Enable `AI_MEDIA_ANALYSIS_ENABLED` only
   after explicit media-to-OpenAI disclosure, licensing, moderation/transcription and privacy checks.

Rollback is immediate flag-off. Do not delete Durable Object migrations from Wrangler. Media objects
remain private and expire through lifecycle even after rollback.

## Observability without content

Generation logs contain request ID, candidate/rejection counts, and type names only. Never add prompts,
Scripture content, model output, media, transcripts, names, IP addresses, capabilities, or provider keys
to logs. Monitor provider status/rate-limit counts, generation latency and failures, R2 operations, quota
rejections, and `NO_VALID_CANDIDATES` rate. Inspect candidate content only through explicit local eval
fixtures or a separately approved review workflow.
