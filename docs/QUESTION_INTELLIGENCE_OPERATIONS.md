# Question Intelligence and YouVersion operations

This runbook covers deployment only. The feature flags in `wrangler.jsonc` intentionally default to
`false`; the manual game builder and existing rooms do not depend on YouVersion, OpenAI, or R2.
The builder capability-checks `/api/health` and fail-closes: disabled or unavailable integrations are
not mounted and do not issue provider requests. Manual authoring, room creation, and gameplay remain
the baseline experience.

## Release blockers

Do not enable the integration in production until all of these are recorded outside the repository:

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

The probe prints only accessible version metadata and never prints the App Key.

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
2. Provision secrets and R2 lifecycle; verify `GET /api/health` still reports all flags `false`.
3. Set `YVP_ALLOWED_BIBLE_IDS` to the approved comma-separated numeric IDs.
4. Enable `SCRIPTURE_PROVIDER_ENABLED` and run version/index/passage smoke tests.
5. Enable `AI_QUESTION_SUGGESTIONS_ENABLED` for a small audience; keep Auto Balance and media off.
6. Enable `AI_AUTO_BALANCE_ENABLED` after eval/cost review.
7. Enable `QUESTION_MEDIA_ENABLED`, then `AI_MEDIA_ANALYSIS_ENABLED`, only after moderation/transcription
   privacy and R2 lifecycle checks pass.

Rollback is immediate flag-off. Do not delete Durable Object migrations from Wrangler. Media objects
remain private and expire through lifecycle even after rollback.

## Observability without content

Generation logs contain request ID, candidate/rejection counts, and type names only. Never add prompts,
Scripture content, model output, media, transcripts, names, IP addresses, capabilities, or provider keys
to logs. Monitor provider status/rate-limit counts, generation latency and failures, R2 operations, quota
rejections, and `NO_VALID_CANDIDATES` rate. Inspect candidate content only through explicit local eval
fixtures or a separately approved review workflow.
