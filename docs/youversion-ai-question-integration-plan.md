# YouVersion + AI Question Intelligence Integration Plan

Status: standalone Scripture lookup (Bible 1638) and ordinary media enabled for the 2026-09-02 production release; all optional AI flags remain disabled with separate release prerequisites

Implementation note (2026-09-02): the repository now contains the canonical Scripture/YouVersion adapter and APIs, strict OpenAI Responses provider, deterministic validation and five strategy contracts, conditional independent semantic review with at most two targeted refill attempts, a content-free quota/concurrency GenerationGate, editable builder suggestions, `MULTIPLE_CHOICE` exact-set gameplay, provenance receipts, independent validated private R2 image/MP3 flow, host-confirmed bounded media preparation timing, hash-verified `.dkt.zip` portability, and deploy-artifact secret checks. Optional YouVersion sign-in/highlights, durable user history, embeddings, camera/microphone capture, AI-created media, and cross-session personalization remain deliberately LATER decisions rather than release requirements.

### Product clarification — 2026-09-02

AI is an optional assistant, not the center of the application. Manual questions, image/audio
attachments and accountless gameplay are ordinary product features. Upload, playback, room binding
and media package import/export require only private R2, a media signing key and the media flag;
they never require an OpenAI key, a YouVersion license or any AI flag. The user attests media rights,
and deterministic file validation, signed access and expiry remain mandatory.

YouVersion reference lookup is a separate feature at each Bible reference field. Only an explicit
AI suggestion request may send selected media to OpenAI for moderation, analysis or transcription.
The AI-specific licensing, privacy and eval gates apply to that optional route, not ordinary media.
This clarification supersedes any initial-plan language below implying mandatory AI moderation
of uploads or a release dependency from ordinary media to AI. Operational enablement details are
maintained in `QUESTION_INTELLIGENCE_OPERATIONS.md`.

Repository assessed: `do-kinh-thanh-live` on 2026-09-02

Documentation researched: official YouVersion Platform and OpenAI documentation current on 2026-09-02

## 1. Executive summary

Build this as two new backend-facing boundaries that feed the existing builder rather than replacing the game engine:

1. a `ScriptureProvider` domain boundary, initially backed by the YouVersion REST API; and
2. a `QuestionIntelligenceService` that receives normalized, provider-grounded Scripture and returns validated, editable candidate questions.

YouVersion must supply Bible versions, metadata, canonical USFM references, passages, and attribution. OpenAI must only transform that supplied context into question wording, answers, distractors, explanations, difficulty proposals, and recommendations. It must never be trusted as the source of Bible text or references.

The first release should remain accountless and ephemeral. The Worker retrieves Scripture and calls OpenAI; the browser keeps suggestion state in the existing tab-scoped draft. Approved suggestions become ordinary `GameItem` objects with optional Scripture evidence and generation provenance. Existing manual questions, room creation, compiled rounds, scoring, WebSockets, and cleanup continue to work.

The requested extension adds a fifth authored type, `MULTIPLE_CHOICE`, defined as **multi-select with at least two correct options** so it is not an alias for the existing one-correct-answer `SINGLE_CHOICE`. It also adds a common question-presentation contract so every authored type can use text, an uploaded image, or uploaded sound as its prompt medium. Media may shape presentation and AI assistance, but it never replaces YouVersion evidence for scriptural claims.

Recommended MVP sequence:

- obtain a YouVersion App Key, accept the applicable licenses, and confirm at least one Vietnamese Bible for this exact App Key;
- add a backend YouVersion adapter and canonical Scripture model;
- add strict candidate schemas and deterministic validation;
- add the deterministic `MULTIPLE_CHOICE` game/runtime contract and common media-presentation contract;
- ship `SHORT_ANSWER` and `SINGLE_CHOICE` generation first;
- integrate editable suggestion cards into the existing builder;
- then add AI generation for `MULTIPLE_CHOICE`, `TRUE_FALSE`, `CROSSWORD`, and deterministic Auto Balance;
- independently add image and sound upload/playback after short-lived object storage, accessibility, rights, deterministic file validation and signed access controls are in place; no AI prerequisite.

There are two release blockers outside the repository:

- YouVersion currently requires Platform apps to be non-commercial (no ads, paywalls, or subscriptions); product ownership must confirm that this remains compatible with the roadmap.
- the selected Bible license must explicitly permit the proposed display, transient processing, transmission to an AI subprocessor, and any generated derivative question text. The public documentation does not settle those rights for every publisher.

## 2. Current architecture assessment

### 2.1 Runtime and deployment

| Concern | Current repository reality | Evidence |
| --- | --- | --- |
| Frontend | React 19, TypeScript, React Router, Vite, PWA, Tailwind plugin, Zod | `package.json`, `vite.config.ts`, `src/app/router.tsx` |
| Public website | Build-time bilingual static site (Vietnamese and English) | `site/`, `scripts/build-site.ts` |
| Game UI language | Vietnamese-only SPA strings; public content is Vietnamese and English | `src/pages/`, `src/features/`, `site/content.ts` |
| Backend | One Cloudflare Worker using native `fetch` routing | `worker/index.ts` |
| Realtime | One SQLite-backed `GameRoom` Durable Object per room; hibernatable WebSockets | `worker/GameRoom.ts`, `wrangler.jsonc` |
| Storage | Ephemeral Durable Object storage for live rooms; browser `sessionStorage` for builder drafts and role tokens; user-managed `.dkt.json` exports | `worker/GameRoom.ts`, `src/features/builder/sessionDraft.ts`, `src/features/builder/gameConfig.ts` |
| Permanent database | None. No D1, KV, R2, external database, or server quiz library | `wrangler.jsonc`, `scripts/check-free-tier.ts` |
| Authentication | No user accounts. Random HOST/SCREEN/PLAYER bearer tokens are stored as SHA-256 hashes; WebSockets use one-time tickets | `worker/room/authentication.ts`, `worker/security/crypto.ts`, `src/lib/session.ts` |
| Abuse protection | Optional Turnstile on room creation plus per-Durable-Object in-memory join/ticket windows | `src/features/security/Turnstile.tsx`, `worker/index.ts`, `worker/GameRoom.ts` |
| Background work | Durable Object alarms only for room timing and deletion; no queues, cron, workflow, or general job system | `worker/room/alarm-scheduler.ts`, `wrangler.jsonc` |
| Caching | Static Asset/PWA cache for the application shell; `/api/*` is NetworkOnly/no-store; no domain data cache | `vite.config.ts`, `worker/security/headers.ts` |
| Question media | No uploaded image/audio model, binary store, media endpoint, transcoder, or `<audio>`/question-image UI. CSP permits same-origin/data images but has no explicit `media-src`; microphone permission is disabled | `shared/game.ts`, `shared/schemas.ts`, `worker/index.ts`, `src/features/builder/ItemEditor.tsx` |
| Configuration | Wrangler vars plus encrypted Worker secrets; local `.dev.vars`; build-time `VITE_*` variables | `wrangler.jsonc`, `.dev.vars.example`, `.github/workflows/deploy.yml` |
| CI/CD | Bun, typecheck, Biome, Vitest, Cloudflare worker tests, build, free-tier audit, Lighthouse, Wrangler dry-run; production deploy from `main` | `.github/workflows/ci.yml`, `.github/workflows/deploy.yml` |
| Observability | Cloudflare platform metrics/logs only; no analytics or external monitoring SDK | `README.md`, `docs/FREE_TIER_BUDGET.md` |

### 2.2 Domain and API patterns

The repository deliberately uses small shared TypeScript contracts rather than a layered framework:

- `shared/game.ts` owns game/item/runtime-round types.
- `shared/schemas.ts` owns strict Zod ingress validation.
- `worker/room/*` owns focused compilation, scoring, ranking, auth, and state-machine logic.
- `worker/index.ts` is the HTTP router and edge security boundary.
- `worker/GameRoom.ts` is the authoritative live-room aggregate and persistence boundary.
- `src/lib/api.ts` is the typed browser API wrapper.
- `src/features/builder/*` owns creation, preview, import/export, and draft behavior.

The new design should follow this style: shared contracts, small Worker services/adapters, and thin route handlers. It should not introduce a general dependency-injection framework, ORM, or separate application server.

### 2.3 Current Bible and AI behavior

- There is no Bible API, Bible corpus, Bible version model, canonical reference parser, or provider abstraction.
- `bibleReference?: string` is optional free text on normal items, crossword rows, and crossword vertical metadata.
- Scripture accuracy is not validated. Public editorial content explicitly says the creator is responsible for references, translation rights, and theological accuracy.
- There is no OpenAI package, API key, provider abstraction, prompt registry, embedding store, or AI endpoint.
- There is no media asset abstraction. The only sound code synthesizes local feedback tones through `AudioContext`; it is not question audio.
- No Bible translation is selected or bundled by the repository. The placeholder `1 Sa-mu-ên 17:50` is an example reference, not evidence that the product uses NVB or another translation.

### 2.4 Builder, validation, and publishing flow

```text
Builder React state
  -> tab-scoped sessionStorage draft
  -> per-item Zod validity indicator
  -> optional full-screen practice preview
  -> final gameDefinitionSchema validation
  -> POST /api/rooms
  -> backend Zod validation + compileGame()
  -> ephemeral GameRoom Durable Object
  -> host starts the game
```

There is no separate draft database, reviewer identity, approval queue, or publish entity. In this product, “publish” means “approve into the builder, then create a temporary room.” AI candidates therefore need an explicit pre-merge review state, but they do not require a permanent server content-management system.

### 2.5 Scoring and multiplayer constraints

- `TURN_BASED`: every correct normal/horizontal answer scores 1,000.
- `SPEED_RACE`: correct normal/horizontal answers score 500–1,000 based on server-observed time.
- crossword vertical answers score up to 2,000, decreasing as special cells are revealed.
- each active player answers once per round; each player gets one vertical guess per crossword.
- crossword items expand to 3–10 horizontal runtime rounds; the vertical guess is a special mechanic, not a standalone `GameItem` or runtime round.
- the room caps are 50 top-level items and 100 compiled runtime rounds.

Question generation must preserve these facts. In particular, Auto Balance must budget compiled rounds, not just top-level items. `MULTIPLE_CHOICE` should remain one runtime round, and media must be referenced by compact metadata rather than sent through the 8 KiB WebSocket protocol.

### 2.6 Tests

- unit/domain: `tests/unit/domain.test.ts`
- portable config: `tests/unit/game-config.test.ts`
- UI/SEO: `tests/unit/seo.test.ts`, Playwright under `e2e/`
- Worker/Durable Object: `tests/worker/game-room.test.ts`
- performance/free-tier: `scripts/load-test.ts`, `scripts/check-free-tier.ts`, Lighthouse configuration

External YouVersion and OpenAI calls must be mocked in normal tests. Live-key checks should be explicit, opt-in release probes.

## 3. Current quiz-type matrix

| Question type | Internal identifier | Schema | UI component | Validation/runtime logic | Suitable for AI? | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Single-answer choice | `SINGLE_CHOICE` | `singleChoiceItemSchema`: 2–4 unique options, correct option ID must exist | `ItemEditor` choice branch; `Preview`; player choice buttons | Zod, `compileGame()`, exact option ID comparison | Yes, high | Conventional one-correct-answer multiple choice; distinct from the new multi-select type. |
| True/False | `TRUE_FALSE` | `trueFalseItemSchema`: statement + boolean | `ItemEditor` true/false branch; `Preview` | Zod, `compileGame()`, exact boolean comparison | Yes, medium | False statements require controlled mutation; trivial negation and partially true claims are risks. |
| Short answer | `SHORT_ANSWER` | `shortAnswerItemSchema`: canonical answer + up to 10 aliases | `ItemEditor` short-answer branch; text input preview/player | Zod; Vietnamese `normalizeAnswer`; exact canonical/alias comparison | Yes, high | Safest first strategy when the answer is an explicit entity or term in evidence. No fuzzy/AI scoring at play time. |
| Bible crossword | `CROSSWORD` | `crosswordItemSchema`: 3–10 rows; vertical grapheme count equals row count; unique clues/answers; special letters must spell vertical answer | `CrosswordEditor`; `CrosswordBoard`; practice preview | Zod; `compileGame()` emits `CROSSWORD_HORIZONTAL`; exact normalized row/vertical answers; special vertical scoring | Yes, later/high risk | Generate the whole crossword as one candidate; deterministic grid construction and Vietnamese grapheme validation are mandatory. |

### 3.1 Requested target type

| Question type | Internal identifier | Target schema | Target UI component | Target validation/runtime logic | Suitable for AI? | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Multiple-answer choice | `MULTIPLE_CHOICE` | `multipleChoiceItemSchema`: 3–6 unique options, 2–5 unique correct option IDs, and at least one incorrect option | New checkbox/multi-select branch in `ItemEditor`, `Preview`, player/screen/host views | Zod; `compileGame()` emits one `MULTIPLE_CHOICE` round; exact unordered set comparison on explicit submit | Yes, medium/high | “Choose all that apply.” No partial credit in MVP. This is intentionally distinct from existing `SINGLE_CHOICE`. |

Naming decision: retain `SINGLE_CHOICE` for exactly one correct answer and reserve `MULTIPLE_CHOICE` for multiple correct answers. Renaming `SINGLE_CHOICE` would create needless config/protocol migration and would make the requested “new type” ambiguous.

### 3.2 Target presentation matrix

| Answer type | Text prompt | Image prompt | Sound prompt | Media placement |
| --- | --- | --- | --- | --- |
| `SINGLE_CHOICE` | Yes | Yes | Yes | One shared prompt asset above text options |
| `MULTIPLE_CHOICE` | Yes | Yes | Yes | One shared prompt asset above checkbox options |
| `TRUE_FALSE` | Yes | Yes | Yes | One shared prompt asset with the proposition |
| `SHORT_ANSWER` | Yes | Yes | Yes | One shared prompt asset above text input |
| `CROSSWORD` | Yes | Yes | Yes | One top-level vertical asset and optionally one asset per horizontal row |

MVP media belongs to the **question prompt**, not individual answer options. Options/answers remain text so scoring, accessibility, and payload behavior stay bounded. Per-option images/sounds require a separate product/contract decision later.

### 3.3 Inconsistencies and partial implementation

1. `verticalDurationSec` exists in `shared/game.ts`, Zod, and portable config but is not editable and is not used by the runtime. Do not make an AI strategy depend on it; either remove it in a separate cleanup or deliberately implement its semantics first.
2. Crossword row `acceptedAliases`, `bibleReference`, and `explanation` exist in types/runtime but are not editable in `CrosswordEditor`. AI-generated row evidence would be invisible unless the editor is extended.
3. A crossword top-level `bibleReference` is used for the final vertical reveal, but `CrosswordEditor` does not expose a field to edit it.
4. The crossword vertical guess is a distinct gameplay behavior but not a fifth question type. It should not appear as a separate builder item or AI type.
5. Draft validation permits unfinished values while final room validation is strict. AI candidates must satisfy the final schema before they can be approved.
6. The repository does not support fill-in-the-blank, “Who said this?”, ordering, reference matching, image questions, or standalone vertical crossword questions. They must not be silently invented by Auto Balance.
7. The target adds image/sound **presentation**, not separate `IMAGE_QUESTION` or `SOUND_QUESTION` item types. Scoring remains determined by the five answer types; media is a reusable prompt capability.

## 4. YouVersion Platform capability matrix

Official sources: [Platform overview](https://developers.youversion.com/), [API usage](https://developers.youversion.com/api-usage), [interactive API reference](https://developers.youversion.com/api), [SDK overview](https://developers.youversion.com/sdks/introduction), [authentication](https://developers.youversion.com/authentication), [sign-in APIs](https://developers.youversion.com/sign-in-apis), [error handling](https://developers.youversion.com/error-codes), and [changelog](https://developers.youversion.com/changelog).

| Capability | Use now? | Use later? | Reason | Repository impact |
| --- | --- | --- | --- | --- |
| App registration/App Key | Required | — | All API requests require `X-YVP-App-Key`; accepted licenses determine accessible Bibles | Add Worker secret/config and release verification |
| Bible collection/detail | Yes | — | Translation picker and attribution metadata | New Scripture endpoints and mapper |
| Books/chapters/verses/index | Yes | — | Canonical scope picker and deterministic reference validation | Reference/index service; metadata cache |
| Passage text | Yes | — | Authoritative generation context and evidence | Server-only retrieval; license-aware caching |
| Languages | Yes, narrow | — | Vietnamese-first picker; BCP 47 metadata | Fetch `vi`/`vi*`, do not download all display-name maps |
| Fonts | No | Maybe | Useful only if a full reader needs publisher-approved typography | No MVP impact |
| Bible audio/artwork | No | Only after separate official capability/license confirmation | The current official API reference reviewed exposes Bible text/index/metadata, fonts, organizations, licenses, VOTD, and highlights—not a general reusable Bible-audio or artwork endpoint | Question media must be user-uploaded or app-owned; do not reuse consumer-app media |
| Organizations | Metadata only | Maybe | Publisher/rightsholder display and audit | Optional mapper fields |
| Licenses API | Release gate | Ongoing | Confirms agreement/version mapping and surfaces license HTML/URI | Admin/release script; not end-user UX |
| Verse of the Day | No | Later | Not part of quiz generation scope | Could seed a future daily quiz |
| JavaScript core SDK | No for MVP runtime | Revisit | Official and typed, but direct REST is smaller and clearer for this Worker adapter | Avoid new bundle/optional `jsdom`; contract-test REST |
| React components/BibleReader | No | Later | This product augments a builder, not a reader; client SDK/auth also conflicts with the repository’s no-`localStorage` guard | No MVP client dependency |
| Sign in with YouVersion | No | Later | Product has no account model; not needed for authoritative Scripture | Would require account/session/privacy redesign |
| Highlights permission/data exchange | No | Later, only with a clear use case | `highlights` is currently the only supported data permission | Possible “quiz from my highlights”; optional account feature |
| Notes/bookmarks | No | No current capability | Official docs explicitly say not supported | Do not design contracts for them |

### 4.1 Current REST behavior to implement against

- Production API base: `https://api.youversion.com/v1` for Bible resources.
- Authentication: `X-YVP-App-Key` on every request.
- Passage example: `GET /v1/bibles/{versionId}/passages/{USFM}`.
- Passage output supports `text` or `html`, plus headings/notes options.
- Collections use `page_size` and `page_token`; endpoint-specific docs should override the general “up to 100” guidance (several current schemas cap numeric pages at 99).
- Handle `204`, `400`, `401`, `404`, `406`, `429`, `500`, and `503` explicitly.
- On `429`, honor `Retry-After` before exponential backoff; do not retry `400/401/404/406`.
- API response types expose Bible ID, abbreviation/title, BCP 47 `language_tag`, copyright/promotional text, publisher URL, organization ID, books, and YouVersion deep link.

### 4.2 Sign-in behavior as of July/August 2026

If sign-in is added later, implement the current Authorization Code + PKCE two-hop flow, preferably through the current SDK:

1. `/auth/authorize` with `response_type=code`, App Key as `client_id`, exact redirect URI, nonce, state, S256 challenge, and `openid`.
2. The first browser callback now returns only `state` and optional `granted_permissions`; it no longer contains identity parameters.
3. After validating state, navigate the browser to `/auth/callback?state=...`.
4. The second callback carries `code` + `state`.
5. Exchange at `/auth/token` using the PKCE verifier.

Supported OAuth scopes are only `openid` (required), `profile`, and `email`. Data permissions are separate; only `highlights` is currently supported. Unsupported scopes now return `400 invalid_scope`. Notes and bookmarks must not be requested.

## 5. Proposed architecture

```text
Browser: existing BuilderPage
  |
  |-- choose version + USFM scope
  |-- optionally upload image or sound prompt media
  |-- POST /api/question-suggestions (Turnstile + bounded request)
  v
Cloudflare Worker router
  |
  +--> GenerationGate Durable Object
  |      short-lived, content-free rate/cost counters
  |
  +--> ScriptureService ------------------------------+
  |      |                                            |
  |      +--> ScriptureProvider interface             |
  |              +--> YouVersionRestProvider          |
  |                       |                            |
  |                       +--> api.youversion.com      |
  |                                                    |
  +--> QuestionMediaService                            |
  |      +--> short-lived Cloudflare R2 objects        |
  |      +--> type/signature/size/rights validation   |
  |                                                    |
  +--> QuestionIntelligenceService                    |
         |                                            |
         +--> strategy registry                       |
         |      SINGLE_CHOICE / MULTIPLE_CHOICE /     |
         |      TRUE_FALSE / SHORT_ANSWER / CROSSWORD |
         |                                            |
         +--> AiModelProvider interface               |
         |      +--> OpenAI Responses API             |
         |                                            |
         +--> validation pipeline <-------------------+
                schema/reference/evidence/rules/
                ambiguity/duplicates/difficulty
  |
  v
Validated candidate envelopes
  |
  v
Builder suggestion cards -> human edit/approve
  |
  v
Existing GameItem union -> existing POST /api/rooms
  |
  v
compileGame() -> GameRoom -> existing scoring/realtime UI
```

### Why each new component belongs here

- `ScriptureProvider`: prevents YouVersion response shapes from leaking into shared game types and makes license-safe testing possible.
- `ScriptureService`: centralizes reference normalization, version allowlists, scope limits, attribution, cache policy, and retry behavior.
- `QuestionIntelligenceService`: keeps orchestration and validation out of `worker/index.ts`; one service is enough for this small repository.
- strategy registry: the five target item types have materially different contracts and failure modes.
- `AiModelProvider`: isolates OpenAI request/response details without creating a general agent framework.
- `GenerationGate`: AI has direct financial-abuse risk and the app has no accounts; Turnstile alone is not a quota ledger.
- `QuestionMediaService`: media introduces binary validation, access control, lifecycle, rights, and payload concerns that do not belong in `GameRoom` or the AI provider.
- short-lived R2: the current JSON/DO/WebSocket limits are unsuitable for binary payloads; R2 holds opaque media objects while game contracts carry small signed references.
- candidate envelope: suggestions need evidence and review status, while the live engine should continue consuming the existing `GameItem` union.

## 6. Generate-from-Scripture data flow

```text
1. Builder optionally uploads one prompt image or sound file; QuestionMediaService validates it and returns an opaque temporary asset reference
2. Builder sends version ID + canonical scope + count + allowed types + audience + optional media asset ID
3. Worker validates body size, media ownership, Turnstile, feature flags, quota, and scope (max 40 verses MVP)
4. ScriptureService checks the App-Key allowlist and validates scope against the Bible index
5. Provider retrieves version metadata/attribution and bounded passage chunks
6. Service normalizes chunks and computes SHA-256 fingerprints; no long-lived text persistence
7. If media is used for AI assistance, the server supplies a validated image to a vision-capable Responses model or transcribes validated audio first; media-derived statements are untrusted until checked against Scripture
8. Auto Balance (or explicit type selection) assigns passage chunks to eligible strategies
9. Each strategy builds a typed model request containing only supplied Scripture, approved media analysis, and constraints
10. OpenAI Responses API returns strict JSON Schema output
11. Server assigns IDs and runs schema, reference, evidence, media, business-rule, difficulty, and duplicate checks
12. Borderline/high-risk candidates receive a separate evidence-only semantic review; obvious failures are rejected
13. Response contains validated/editable candidates, warnings, evidence references, attribution, media reference, and provenance
14. Builder keeps candidate JSON in sessionStorage; binary media remains in short-lived R2; user edits and explicitly approves selected candidates
15. Approved candidates map to ordinary GameItem objects with optional evidence/provenance/media metadata
16. Existing preview and final Zod validation run
17. Room creation binds approved media to a room-scoped signed reference; existing compilation/scoring/gameplay continue with media-aware public payloads
```

No candidate becomes a room item automatically. If YouVersion or OpenAI is unavailable, existing manual builder and previously created games remain functional.

## 7. Domain and provider design

### 7.1 Canonical Scripture contracts

Add shared vendor-neutral types, conceptually:

```ts
type ScriptureProviderId = "youversion";

interface ScriptureReference {
  provider: ScriptureProviderId;
  bibleVersionId: number;
  bookUsfm: string;          // JHN
  chapter: number;           // 3
  verseStart?: number;       // absent means whole chapter
  verseEnd?: number;         // same-chapter MVP range
  passageId: string;         // canonical JHN.3 or JHN.3.16-18
}

interface ScriptureVersion {
  provider: ScriptureProviderId;
  id: number;
  abbreviation: string;
  localizedTitle: string;
  languageTag: string;
  copyright: string;
  publisherUrl?: string;
  organizationId?: string;
  deepLink?: string;
}

interface ScriptureContextChunk {
  reference: ScriptureReference;
  localizedReference: string;
  content: string;           // request-scoped only
  contentSha256: string;
}

interface ScriptureContext {
  version: ScriptureVersion;
  requestedScope: ScriptureReference;
  chunks: ScriptureContextChunk[];
}
```

MVP references should be a single chapter or same-chapter verse range. This matches official examples, keeps validation explainable, and limits prompt size. Multi-chapter/book scopes can be represented as arrays of canonical scopes later rather than inventing an ambiguous passage grammar.

### 7.2 Common question presentation and new answer contract

Do not add separate image/sound question types. Add one presentation object reusable by all five authored types:

```ts
interface QuestionPresentation {
  text: string;                // required public stem/accessibility equivalent
  media?: QuestionMediaRef;    // one primary media asset in MVP
}

type QuestionMediaRef = ImageQuestionMediaRef | AudioQuestionMediaRef;

interface MediaRefBase {
  assetId: string;             // opaque server-issued ID, never an arbitrary URL
  sha256: string;
  mimeType: string;
  byteSize: number;
  rights: {
    source: "USER_UPLOAD" | "APP_OWNED";
    attestedByHost: boolean;
    attribution?: string;
  };
}

interface ImageQuestionMediaRef extends MediaRefBase {
  kind: "IMAGE";
  width: number;
  height: number;
  publicAltText: string;
  revealDescription?: string;
}

interface AudioQuestionMediaRef extends MediaRefBase {
  kind: "AUDIO";
  durationMs: number;
  publicTranscript?: string;
  revealTranscript?: string;
}

interface BuilderMediaHandle {
  media: QuestionMediaRef;
  readCapability: string;
  deleteCapability: string;
  expiresAt: string;
}

interface MultipleChoiceItem extends BaseGameItem {
  type: "MULTIPLE_CHOICE";
  presentation: QuestionPresentation;
  options: ChoiceOption[];
  correctOptionIds: string[];
}

// Runtime additions; ordering is irrelevant and duplicates are rejected.
type MultipleChoicePlayerAnswer = {
  type: "OPTIONS";
  optionIds: string[];
};

type MultipleChoicePrivateAnswer = {
  type: "OPTIONS";
  optionIds: string[];
};
```

`QuestionMediaRef` is persisted authoring metadata, not an instruction to expose every field. The compiler projects public alt/transcript fields into `publicPayload` and reveal-only fields into `revealPayload`. `BuilderMediaHandle` capabilities are session-only secrets and never become `GameItem`, provenance, export, logs, or room public state. Room creation exchanges the builder handle for a room-scoped signed URL represented only in the compiled public media payload.

Migrate existing prompt-bearing fields incrementally: add optional `presentation` to normal items, crossword rows, and the crossword vertical prompt, while retaining `prompt`/`statement`/row `clue`/`verticalClue` as the text source for v1/v2 compatibility. `title` remains crossword display context, not the question stem. A canonical helper such as `getQuestionPresentation(itemOrRow, role?)` supplies `{ text: legacyField, media }` to the compiler. Do not immediately rename every legacy text field.

For `MULTIPLE_CHOICE`, add `MULTIPLE_CHOICE` to `RuntimeRoundKind`, use 3–6 options, at least two and at most `options.length - 1` correct IDs, unique IDs/text, and exact unordered-set scoring. The compiled `publicPayload` carries options plus compact media display metadata; the private answer carries only the correct set. The player selects checkboxes and presses Submit; selecting an option must not answer immediately. No partial credit in MVP because it complicates scoring, makes guessing strategy dominant, and diverges from the existing binary correctness model.

Image alt text and audio transcripts are public prompt equivalents, not answer metadata. If a faithful accessible equivalent would disclose the answer, the editor must reject the media-only design or require equivalent visible question text; do not hide essential information only from non-screen-reader users. Reveal-only descriptions/transcripts remain in private/reveal payloads.

### 7.3 Media gameplay and timing semantics

- Image and sound bytes are prefetched through signed HTTP URLs, never WebSockets. A round must not become answerable until its media is ready on the authoritative host/screen or a bounded fallback activates.
- Sound questions use `playbackPolicy: "BEFORE_ANSWER_TIMER"` in MVP. The server broadcasts `mediaStartAt` and computes `answerOpenedAt = mediaStartAt + durationMs`; existing `durationSec` begins after that timestamp. Early answers are rejected. This keeps `SPEED_RACE` from rewarding a client whose audio started early.
- Require a one-time “Enable sound” user gesture in the lobby because browsers may block autoplay. If playback cannot start, the host can retry or activate the public transcript/text equivalent; the question does not silently consume its timer.
- All clients use server timestamps, but the host/screen remains the canonical group presentation. Player devices may expose the same audio and transcript for remote/accessibility use; replay is allowed uniformly after initial playback and does not reset server timing.
- Image load failure falls back to the validated public alt/equivalent text before answer timing starts. A media-only item with neither decoded media nor a valid public equivalent is skipped/rejected, never scored.
- `durationSec` remains answer time. The editor shows total round time (`audio duration + answer duration`) and warns about long quizzes.

These rules add a small media-prepare event/state to the realtime protocol, not a new scoring formula or answer type.

### 7.4 Provider boundary

```ts
interface ScriptureProvider {
  listVersions(input: { languageRanges: string[] }): Promise<ScriptureVersion[]>;
  getVersion(versionId: number): Promise<ScriptureVersion>;
  getIndex(versionId: number): Promise<ScriptureIndex>;
  getPassage(reference: ScriptureReference): Promise<ScriptureContextChunk>;
  validateReference(reference: ScriptureReference): Promise<ReferenceValidation>;
}
```

Do not expose raw YouVersion fields to React or `GameItem`. `YouVersionRestProvider` maps and validates upstream JSON immediately with Zod. A fake provider supplies deterministic test Scripture.

### 7.5 Passage chunking

The verse-list endpoint exposes verse identities, while Bible text comes from the passage endpoint. For generation, enumerate valid verse IDs from the index and retrieve labeled chunks of approximately 3–8 verses. This gives the model explicit evidence boundaries without one request per verse. Re-fetch a candidate’s exact cited range during evidence validation, deduplicating identical ranges within the request.

### 7.6 AI provider boundary

```ts
interface AiModelProvider {
  generateStructured<T>(input: {
    model: string;
    schemaName: string;
    schema: JsonSchema;
    instructions: string;
    data: unknown;
    image?: { mimeType: "image/jpeg" | "image/png" | "image/webp"; bytes: ArrayBuffer };
    reasoningEffort: "low" | "medium" | "high";
  }): Promise<AiStructuredResult<T>>;
}

interface AudioTranscriptionProvider {
  transcribe(input: {
    audio: ArrayBuffer;
    mimeType: "audio/mpeg";
    language: "vi";
    contextTerms: string[]; // bounded proper-name hints from validated Scripture metadata
  }): Promise<{ transcript: string; model: string; durationMs: number; requestId?: string }>;
}
```

Use native Worker `fetch` to the OpenAI Responses API, `store: false`, strict JSON Schema Structured Outputs, explicit timeouts, and no model tools/web access. This preserves the repository’s small bundle and avoids parsing prose. The provider records the returned model, response/request ID, latency, and usage but never logs Scripture/question content.

Current official OpenAI documentation says the Responses API accepts text and image input, while purpose-built transcription models accept audio input. Therefore:

- validated images may be passed as image input to the configured vision-capable generation/review model;
- sound files are transcribed in a separate bounded step with `gpt-transcribe` (or a configured evaluated successor), then the structured question model receives transcript plus audio metadata;
- the transcription model never produces the final question contract because its model page does not support Structured Outputs;
- no image generation, text-to-speech, Realtime session, web tool, or arbitrary external file URL is required for this feature.

Sources: [Responses API create reference](https://developers.openai.com/api/reference/cli/resources/responses/methods/create), [current model catalog](https://developers.openai.com/api/docs/models), and [GPT-Transcribe](https://developers.openai.com/api/docs/models/gpt-transcribe).

Official OpenAI guidance currently positions `gpt-5.6-sol` for flagship capability, `gpt-5.6-terra` for a balance of intelligence and cost, and `gpt-5.6-luna` for high-volume cost-sensitive work. See [model guidance](https://developers.openai.com/api/docs/guides/latest-model), [model catalog](https://developers.openai.com/api/docs/models), [Responses API](https://developers.openai.com/api/docs/guides/migrate-to-responses), and [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs).

Recommended model policy:

- default generation: `gpt-5.6-terra`, `low` reasoning; test `medium` for crossword/hard questions;
- conditional high-risk review: `gpt-5.6-sol`, `low` or `medium` reasoning;
- `gpt-5.6-luna`: only for affordance classification/ranking after evals prove it meets recall targets; never the only correctness reviewer.

Model IDs, reasoning effort, and prompt/strategy versions must be environment/config values and recorded per candidate.

## 8. Database and persisted-contract changes

### 8.1 Permanent database

Do not add D1 or a permanent quiz database for the MVP. That would conflict with the current accountless, delete-after-play product and is unnecessary for editable suggestions. Binary question media does require a new object store, but it must be short-lived rather than a permanent content library.

### 8.2 GenerationGate Durable Object

Add one SQLite-backed Durable Object class and namespace for abuse/cost counters only:

```text
namespace: GENERATION_GATES
object name: HMAC(dayBucket + clientGenerationId + coarse IP), sharded by hash
keys:
  quota:window -> { startedAt, count }
  quota:day    -> { day, count }
alarm:
  deleteAll after <= 26 hours
```

It must not store Scripture, prompts, questions, names, raw IPs, or OpenAI/YouVersion credentials. If a Cloudflare rate-limiting product that is available on the chosen plan can provide the same guarantees, it can replace this object; do not rely on isolate-local maps for a billable endpoint.

### 8.3 Approved item metadata

Add two optional fields to normal items and crossword rows/top-level vertical metadata:

```ts
interface ScriptureEvidenceMetadata {
  provider: "youversion";
  bibleVersionId: number;
  versionAbbreviation: string;
  passageId: string;
  evidencePassageIds: string[];
  localizedReference: string;
  attribution: string;
  sourceContentSha256: string; // hash of ordered passageId + NFC/plain-text content tuples
  containsExactQuotation: boolean;
}

interface GenerationProvenance {
  source: "AI_ASSISTED";
  provider: "openai";
  model: string;
  promptVersion: string;
  strategyVersion: string;
  generatedAt: string;
  validatedAt: string;
  humanApprovedAt: string;
  confidence: number; // 0..1, calibrated by evals
  validationReceipt?: string; // HMAC of canonical approved payload
}
```

Do not persist source passage text. The SHA-256 value is a fingerprint for traceability, not a way to reconstruct text. Exact quotation already present in a question remains part of that question and must be limited and attributed according to its license.

### 8.4 Short-lived question media in R2

Add one private R2 binding, `QUESTION_MEDIA`, because base64 in game JSON/DO/WebSockets would violate existing 512 KiB/8 KiB limits and external URLs would create SSRF, availability, privacy, and rights problems.

```text
object key: quarantine/{yyyy-mm-dd}/{uploadId} while validating
            temp/{yyyy-mm-dd}/{assetId} only after promotion
custom metadata: ownerBucketHmac, sha256, kind, mimeType, byteSize,
                 width/height or durationMs, createdAt, expiresAt,
                 validationStatus, rightsSource
lifecycle: delete quarantine/temp objects after 1 day (or the smallest supported bucket rule)
room access: room-scoped HMAC URL expires no earlier than room expiry
```

The server must never trust client-provided object metadata. The implemented upload validates bytes in memory before storing under `temp/`; no failed upload receives a read route. Upload is complete only after content signature/type, byte size, dimensions/duration and rights attestation pass. This path never calls AI. Never accept a client-selected R2 key or remote URL.

Suggested MVP limits, configurable in `shared/limits.ts`:

- one primary media object per question or crossword row;
- image: JPEG/PNG/WebP, <=2 MiB, <=4096x4096, no SVG, no animated format;
- sound: MP3 only for predictable browser compatibility, <=5 MiB and <=60 seconds;
- no camera or microphone capture in MVP—file upload only, so the current restrictive Permissions Policy can remain;
- room-wide media bytes capped independently from the 512 KiB JSON body.

If safe image decoding/re-encoding and metadata stripping cannot be done within the chosen Cloudflare path, use an approved managed image transformation service or defer image upload. Do not ship raw SVG, retain EXIF/geolocation, or guess MIME type from filename.

### 8.5 Portable config/package version

Keep `.dkt.json` format version 2 for media-free games and introduce a versioned `.dkt.zip` package for portable games containing media:

- parser accepts v1 and migrates in memory with metadata absent;
- serializer writes v2 JSON when no media exists;
- package contains `game.json` plus `media/{assetId}.{safeExtension}` and a manifest of hashes/sizes/MIME types;
- package media IDs are archive-local; import uploads validated bytes, receives new server asset IDs/capabilities, and rewrites references in memory;
- import validates ZIP paths, decompression ratio, member count, hashes, and media constraints before uploading objects;
- manually authored items may omit both new fields;
- strict schemas continue rejecting unknown fields;
- no backfill is required because there is no server quiz library;
- never export expiring room URLs or upload capability tokens.
- never rely on an exported server `assetId` remaining live.

### 8.6 Live room storage

`GameRoom` storage keys and deletion behavior remain unchanged apart from compact media references. `compileGame()` should carry only the compact reference/attribution/media ID needed for public display and reveal. Binary bytes, upload capabilities, full validation diagnostics, and model response data must not enter room storage.

## 9. Internal API changes

All new APIs live on the game host, use JSON, return `Cache-Control: no-store` to browsers, and are feature-flagged.

### 9.1 Scripture browsing

```http
GET /api/scripture/versions?language=vi
GET /api/scripture/versions/{versionId}/index
GET /api/scripture/passage?versionId=449&passageId=JHN.3.16-18
```

The passage response contains normalized reference, text for preview, version label, attribution, and deep link. It never exposes the App Key. The version endpoint returns only Bibles accessible to the configured App Key and optional server allowlist.

### 9.2 Media upload and delivery

```http
POST /api/question-media
Content-Type: multipart/form-data

GET /api/question-media/{assetId}?token={shortLivedCapability}
GET /api/rooms/{roomCode}/media/{assetId}?token={roomScopedSignature}
DELETE /api/question-media/{assetId}
```

Upload accepts one file plus structured `kind`, accessibility metadata, and rights attestation. The Worker streams the bounded body to the private R2 binding, validates authoritative metadata, and returns an opaque `QuestionMediaRef` plus builder-scoped capability. Delete is idempotent and requires the builder capability. Room creation verifies ownership/status/hash and produces room-scoped media URLs; public game state never receives builder upload/delete capability.

Media responses set the exact allowlisted `Content-Type`, `Content-Length`, `Content-Disposition: inline`, `X-Content-Type-Options: nosniff`, private/no-store caching until rights policy is approved, byte-range support for audio, and CSP-compatible same-origin URLs. Return `404` for invalid/expired signatures without revealing asset existence.

### 9.3 Generate candidates

```http
POST /api/question-suggestions
Content-Type: application/json

{
  "scriptureScope": {
    "provider": "youversion",
    "bibleVersionId": 449,
    "passageId": "EXO.1"
  },
  "count": 8,
  "types": "AUTO_BALANCE",
  "difficulty": "MIXED",
  "audience": "YOUTH",
  "locale": "vi",
  "mediaAssetId": "optional-opaque-id",
  "existingItems": [/* compact fingerprints/references, not full private draft */],
  "turnstileToken": "...",
  "clientGenerationId": "random-session-id"
}
```

Limits for MVP:

- 1–10 requested candidates;
- at most 40 verses or one bounded chapter;
- allowed locale initially `vi`;
- audience is a closed enum, not arbitrary instructions;
- optional topic is plain text <= 120 characters and is treated as untrusted data;
- generation request body <= 64 KiB; binary media uses the separate upload endpoint;
- maximum two targeted refill attempts, never unbounded regeneration.

Response:

```json
{
  "requestId": "opaque-id",
  "scope": { "bibleVersionId": 449, "passageId": "EXO.1" },
  "version": { "abbreviation": "NVB", "attribution": "..." },
  "candidates": [],
  "rejectedCount": 2,
  "warnings": [],
  "usage": { "candidateCount": 8 }
}
```

Do not expose tokens or provider cost details to the public response.

### 9.4 Approval

Do not add `/question-suggestions/{id}/approve` in the MVP because candidates are not server-persisted. Approval is a local builder action that converts the already server-validated candidate to `GameItem`.

The response may include a `validationReceipt` signed with `PROVENANCE_SIGNING_KEY`. `POST /api/rooms` verifies the receipt when an item claims AI validation; an invalid/missing receipt either downgrades the item to manually authored provenance or rejects the provenance fields, never the underlying valid manual question.

### 9.5 Error contract

Add stable application codes such as:

- `SCRIPTURE_VERSION_UNAVAILABLE`
- `SCRIPTURE_REFERENCE_INVALID`
- `SCRIPTURE_LICENSE_UNAVAILABLE`
- `SCRIPTURE_PROVIDER_RATE_LIMITED`
- `QUESTION_GENERATION_RATE_LIMITED`
- `QUESTION_GENERATION_UNAVAILABLE`
- `NO_VALID_CANDIDATES`
- `QUESTION_MEDIA_INVALID`
- `QUESTION_MEDIA_EXPIRED`
- `QUESTION_MEDIA_UNSAFE`
- `QUESTION_MEDIA_RIGHTS_REQUIRED`

Return a safe Vietnamese message plus retry metadata where relevant. Never relay raw provider bodies.

## 10. AI structured output schema

The model output should be smaller than the server candidate envelope. The server, not the model, assigns IDs, states, timestamps, provider metadata, and validation results.

```ts
interface ModelQuestionProposal {
  type:
    | "SINGLE_CHOICE"
    | "MULTIPLE_CHOICE"
    | "TRUE_FALSE"
    | "SHORT_ANSWER"
    | "CROSSWORD";
  payload: ModelPayloadForType;
  presentation: {
    text: string;
    useProvidedMedia: boolean; // model cannot invent asset IDs or URLs
    publicAccessibilityText?: string;
  };
  evidence: Array<{
    passageId: string;
    supportingExcerpt: string;
    claimSupported: string;
  }>;
  proposedDifficulty: {
    label: "EASY" | "MEDIUM" | "HARD";
    featureReasons: string[];
  };
  explanation: string;
  uncertaintyNotes: string[];
}

interface QuestionCandidateEnvelope {
  schemaVersion: 1;
  candidateId: string;
  state: "GENERATED" | "VALIDATED" | "NEEDS_REVIEW" | "REJECTED";
  type: GameItem["type"];
  proposedItem: GameItem;
  media?: QuestionMediaRef;
  evidence: ScriptureEvidenceMetadata;
  generation: {
    provider: "openai";
    model: string;
    responseId?: string;
    promptVersion: string;
    strategyVersion: string;
    generatedAt: string;
  };
  validation: {
    overall: "PASS" | "WARN" | "FAIL";
    checks: Array<{
      code: string;
      kind: "DETERMINISTIC" | "AI_ASSISTED";
      outcome: "PASS" | "WARN" | "FAIL";
      message: string;
    }>;
  };
  difficulty: {
    label: "EASY" | "MEDIUM" | "HARD";
    score: number;
    reasons: string[];
  };
  confidence: number;
  validationReceipt?: string;
}
```

Structured Output schema requirements:

- `additionalProperties: false` throughout;
- discriminated `type` branches;
- bounded array/string sizes consistent with existing Zod limits;
- no IDs supplied by the model;
- no raw HTML;
- no URLs, base64 media, R2 keys, or model-created asset IDs;
- no free-form Bible version/reference outside `evidence[].passageId`;
- refusal/incomplete responses handled separately from schema success.

## 11. Question strategy matrix

### 11.1 Summary

| Type | Required context | Passage fit | Primary deterministic checks | Semantic checks | Initial rollout |
| --- | --- | --- | --- | --- | --- |
| `SHORT_ANSWER` | One explicit fact/entity in 1–5 verses | Direct facts, names, places, numbers with stable wording | answer/alias validity; reference exists; evidence excerpt exact; normalized aliases unique | only one expected answer; translation/transliteration clarity | First |
| `SINGLE_CHOICE` | One provable answer plus context for distractors | Direct facts in 1–8 verses | one marked correct; 2–4 unique options; evidence exact; correct answer grounded | no alternate correct distractor; no broader-context loophole | First |
| `MULTIPLE_CHOICE` | A closed set of 2+ provable answers plus at least one safe non-member | Lists, groups, attributes, or events whose complete answer set is explicit in 2–12 verses | 3–6 unique options; 2+ correct IDs; exact-set answer; every correct grounded; every distractor rejected | completeness of the correct set; no implied/translation-dependent member | Second |
| `TRUE_FALSE` | One atomic fact; for false, a controlled mutation | Short factual passages | boolean; mutation field; source claim/excerpt; no quotation rewrite | atomicity, non-triviality, no partial truth | Second |
| `CROSSWORD` | 3–10 independent grounded answers plus a valid vertical term | Chapter/topic with many concrete entities/terms | all row answers grounded; grapheme/grid constraints; unique answers/clues; compiled-round budget | clue ambiguity; spelling/transliteration; vertical theme | Last |

### 11.2 `SHORT_ANSWER`

1. Input: one labeled passage chunk, version metadata, locale, audience, difficulty target.
2. AI task: select one objective answer explicitly supported by the chunk; write a concise prompt; propose only orthographic/transliteration aliases.
3. Output: prompt, canonical answer, aliases, evidence range/excerpt, explanation, difficulty features.
4. Deterministic validation: final Zod schema; canonical answer length; unique normalized aliases; cited range in scope; excerpt equals provider text after NFC/whitespace normalization; content hash; answer or approved surface form occurs in evidence for easy/direct candidates.
5. Semantic validation: check that the prompt has one expected answer and does not require outside theology or an unstated translation convention.
6. Failure: multiple named entities satisfy it, answer is a phrase not present/derivable from evidence, reference invented, alias changes identity, or exact play-time matching would be unfair.
7. Confidence: high only when the answer is explicit, unique within scope, and every accepted alias is explainable.
8. Difficulty: easy = direct single-verse entity; medium = relation across 2–4 verses; hard = precise contextual relationship, never obscurity alone.
9. Passage length: 1–5 verses preferred; longer scope must be narrowed to evidence.
10. Editor: show canonical answer, aliases, evidence, and a warning that play-time scoring remains exact.

### 11.3 `SINGLE_CHOICE`

1. Input: one factual passage chunk and an answer-entity inventory from the scope.
2. AI task: create one question with one supported answer and 1–3 plausible same-category distractors.
3. Output: prompt, correct option text, distractor texts, evidence, distractor rationale (server-only), explanation, difficulty features.
4. Deterministic validation: 2–4 unique options after normalization; correct answer is present exactly once; reference/excerpt validation; existing `singleChoiceItemSchema`; IDs assigned server-side.
5. Semantic validation: search for any reading under which a distractor is also correct; require distractors to match entity type/time/context without contradicting supplied Scripture in a misleading way.
6. Failure: “all/none of the above,” two valid answers, answer revealed grammatically, distractor from another translation name that aliases the correct answer, or question needs outside doctrine.
7. Confidence: high when one atomic claim supports the answer and every distractor has a documented rejection reason.
8. Difficulty: raise difficulty through contextual similarity and evidence span, not trick wording.
9. Passage length: 1–8 verses preferred.
10. Editor: “Generate better distractors” is a type-specific regeneration that preserves prompt, answer, evidence, and provenance lineage.

### 11.4 `MULTIPLE_CHOICE`

1. Input: one bounded passage with an explicit closed set, answer-entity inventory, and optional validated question media.
2. AI task: write “choose all that apply” wording; propose 3–6 same-category options with 2–5 correct members and at least one incorrect member.
3. Output: prompt, option texts, correct-option positions (server maps to IDs), per-option evidence/rejection rationale, explanation, difficulty features, and media-use intent.
4. Deterministic validation: unique option text/IDs; correct IDs are unique and belong to options; at least two correct and one incorrect; every correct option has provider evidence; exact unordered-set scoring; existing final compiler/protocol limits.
5. Semantic validation: the answer universe is closed by the wording/scope, all correct members are included, and no distractor becomes correct under reasonable translation/context.
6. Failure: “select all people in the Bible” or another open universe; incomplete list; a distractor is a synonym/transliteration of a correct option; “all/none of the above”; media carries an uncited fact needed to answer.
7. Confidence: capped by the least-supported correct member and strongest distractor; high requires an explicit enumerated or clearly bounded set.
8. Difficulty: evidence span, number of options/correct members, and same-category similarity; never difficulty by unclear selection instructions.
9. Passage length: 2–12 verses preferred; larger chapters must be narrowed to a closed evidence range.
10. Editor/player: show per-option grounding in the editor; use checkboxes and an explicit Submit action; reveal all correct options together; no partial-credit UI in MVP.

### 11.5 `TRUE_FALSE`

1. Input: one atomic provider-grounded claim and its evidence.
2. AI task: either restate it faithfully as true or mutate exactly one controlled slot (entity, location, number, action, sequence) to create a false statement.
3. Output: statement, boolean, original true claim, mutation descriptor or `null`, evidence, explanation, difficulty features.
4. Deterministic validation: cited range/excerpt; false proposal must identify exactly one changed slot; true proposal must not mark a paraphrase as an exact quotation; final Zod schema.
5. Semantic validation: the statement is atomic, fully true/false in the supplied context, and not merely a trivial “not” insertion.
6. Failure: partly true compound statement, denomination-dependent conclusion, false only because context was removed, or wording that changes translation nuance.
7. Confidence: high when the claim maps to one evidence sentence and the mutation has one unambiguous correction.
8. Difficulty: easy = obvious direct fact; medium = similar entity/number; hard = context or chronology supported within scope.
9. Passage length: 1–6 verses preferred.
10. Editor: show “what was changed” for false candidates and evidence side by side.

### 11.6 `CROSSWORD`

1. Input: a chapter or bounded multi-chunk context with at least 3 grounded, distinct answer terms.
2. AI task: propose a coherent vertical keyword and 3–10 row answers/clues, each with evidence. It must not be responsible for final cell indices.
3. Output: title, vertical clue/answer/evidence, row clue/answer/aliases/evidence, difficulty features.
4. Deterministic validation: Vietnamese grapheme splitting via existing `answerCells`; normalize answers; unique row clues/answers; each row contains the required vertical grapheme; deterministic solver chooses `specialCellIndex`; vertical length equals row count; all references/excerpts validate; runtime rounds remain <=100; final `crosswordItemSchema` and `compileGame()` pass.
5. Semantic validation: each clue has one answer, spelling is consistent with the selected translation, aliases do not collide, and the vertical clue is objectively supported or clearly labeled as a theme rather than a quotation.
6. Failure: no valid grid, repeated answer, ambiguous transliteration, clue needs doctrine outside the passage, exact word not supported, or more than two solver retries.
7. Confidence: the candidate confidence is the minimum row confidence, reduced for multiple valid spellings and thematic vertical answers.
8. Difficulty: row difficulty plus grid position; do not make difficulty depend on obscure punctuation/diacritics stripped by scoring.
9. Passage length: usually a chapter or 15–40 verses; not suitable for a single sparse verse.
10. Editor: expose the currently hidden row aliases/references/explanations and top-level vertical reference; visualize evidence per row; let the user replace a row and re-run the deterministic grid solver.

### 11.7 Image and sound prompt strategy for every type

Media is a cross-cutting prompt input, not an answer type. Each of the five strategies must implement the same additional rules:

1. Input: one server-validated `QuestionMediaRef`; images may also supply a bounded vision analysis, while sound supplies a bounded transcript and acoustic metadata.
2. AI task: decide whether the media materially improves the question, describe the exact observable evidence it uses, and write a prompt whose scriptural claim is still grounded in YouVersion.
3. Output: `useProvidedMedia`, public accessibility text, media-observation claims, and the ordinary type-specific payload; never an asset ID/URL.
4. Deterministic validation: asset ownership/status/hash/type/size/dimensions/duration; question has text or media; public accessibility equivalent; media reference is attached only by the server.
5. Semantic validation: question is answerable from the presented media plus cited Scripture; accessibility text does not change the correct answer; media analysis is not mistaken for Scripture.
6. Failure: illegible image, silent/corrupt audio, unsafe content, rights not attested, answer visible in filename/metadata, transcript/alt text leaks the answer, or media-dependent claim conflicts with Scripture.
7. Confidence: overall confidence is the minimum of type confidence, media-quality confidence, and Scripture evidence confidence.
8. Difficulty: media recognition burden may add at most one calibrated factor; poor quality, volume, color dependence, or inaccessible design never counts as legitimate difficulty.
9. Suitability: image questions favor maps, objects, scenes, or app-owned illustrations; sound favors spoken clue/reading or app-owned effects. Neither justifies copying unlicensed art/audio or long Scripture recordings.
10. UI/editor: preview exactly as players see/hear it; replace/remove media; edit alt/transcript; show duration/size/rights/expiry; keyboard-operable playback; replay policy consistent across players.

For crosswords, media attaches to the top-level vertical prompt or an individual row via the same presentation contract; each compiled horizontal round carries only its relevant row media reference.

## 12. Recommendation and Auto Balance

### 12.1 What can be recommended with current product data

The system can assess current-draft structure: type mix, difficulty mix, passage/chapter coverage, repeated answers, repeated references, and cognitive variety. It cannot identify a user’s historical weak areas or “recently unused” passages across sessions because the product deliberately stores no account history. Those capabilities require a future opt-in persistent content/user model.

### 12.2 Deterministic Auto Balance algorithm

1. Validate and chunk Scripture scope.
2. Produce a typed “passage affordance” record per chunk: explicit entities, direct speech, numbers, sequences, density of distinct grounded terms, and ambiguity warnings. Use deterministic extraction where possible and a bounded structured AI classifier for semantic features.
3. Compute strategy eligibility:
   - short answer requires an explicit unique answer;
   - single choice requires one answer plus safe distractor space;
   - multiple-answer choice requires a closed set with at least two members plus a safe non-member;
   - true/false requires one atomic mutable fact;
   - crossword requires 3–10 compatible distinct terms and round capacity.
4. Build a target difficulty distribution. Default `MIXED`: 40% easy, 40% medium, 20% hard, rounded deterministically.
5. Enforce diversity constraints:
   - no normal type exceeds 40% when at least three types are eligible;
   - combined `SINGLE_CHOICE` + `MULTIPLE_CHOICE` should not exceed 50%, and `MULTIPLE_CHOICE` alone should not exceed 25%, unless fewer types are eligible;
   - at most one crossword per generation request;
   - true/false at most 30%;
   - no identical normalized answer;
   - no evidence range used more than twice unless scope is very small;
   - total compiled rounds <= remaining room capacity.
   - media is used only when it adds pedagogical value, passes validation, and does not make more than a configurable share of the quiz modality-dependent (initially 30%).
6. Score type/chunk assignments:

```text
score = 3*passageSuitability
      + 2*newTypeCoverage
      + 2*newChapterCoverage
      + targetDifficultyFit
      + cognitiveVariety
      - 3*answerRepetition
      - 2*referenceOveruse
      - ambiguityRisk
      - runtimeRoundCostPenalty
```

7. Select assignments greedily with backtracking for crossword/round constraints.
8. Batch proposals by strategy so each uses its specialized schema/prompt.
9. Validate all candidates; fill failed slots with at most two targeted retries.
10. Rank surviving candidates by validation result, calibrated confidence, coverage gain, and edit burden.

The LLM judges passage affordances and drafts content; it does not choose the final mix or waive constraints.

If the user supplies one media asset, Auto Balance may apply it only to the candidate whose evidence and type fit it best; it must not duplicate the same image/sound across unrelated candidates merely to satisfy variety.

### 12.3 Existing-quiz recommendations

Given a draft, return actionable suggestions such as:

- “4 of 6 items are short-answer; add one `SINGLE_CHOICE` item from EXO.3.1-6.”
- “The same answer appears three times.”
- “This crossword adds eight runtime rounds and would exceed the 100-round cap.”
- “All questions cite chapter 1; chapter 2 is uncovered.”
- “No hard candidate passed validation; keep the current mix instead of forcing one.”

## 13. Validation architecture

| Stage | Owner | Required result |
| --- | --- | --- |
| 1. Model-output schema | strict JSON Schema + server Zod | Exact type branch; bounded fields; no extras |
| 2. Canonical reference | ScriptureService/index | Version accessible; USFM exists; evidence is inside requested scope |
| 3. Evidence integrity | YouVersion re-fetch + hashes | Exact excerpt matches provider; quotation is not silently altered |
| 4. Media integrity | QuestionMediaService; opt-in AI media-input helper | Owned, unexpired, hash/type/size/accessibility/rights checks pass; moderation is additional only when submitted to AI |
| 5. Type business rules | strategy validator + existing schemas/compiler | Current/target item schema and runtime constraints pass; exact-set rules for `MULTIPLE_CHOICE` |
| 6. Difficulty | deterministic feature scorer | Explainable score/label; model label cannot override |
| 7. Semantic ambiguity | conditional independent AI review | No alternate/missing correct answer, context trap, or interpretive claim presented as fact |
| 8. Duplicate/similarity | deterministic fingerprints | No exact/paraphrased fact, repeated media, or reference overuse above thresholds |
| 9. Human approval | existing builder UI | Explicit edit/accept; candidate never auto-publishes |

Suggested candidate state transitions:

```text
GENERATED -> VALIDATED -> NEEDS_REVIEW -> human approve -> ordinary GameItem
     |            |             |
     +----------> REJECTED <-----+
```

`APPROVED` and `PUBLISHED` are UI/event states, not server candidate rows, because no candidate database exists.

### 13.1 Hallucination/failure threat model

| Risk | Mitigation |
| --- | --- |
| Invented verse | Accept only canonical IDs in supplied scope; validate against index and re-fetch evidence |
| Wrong speaker | Do not generate speaker questions unless the passage explicitly attributes speech; current item types do not need a special speaker strategy |
| Wrong chronology | Require all sequence claims to be supported by bounded context; semantic review for hard chronology |
| Incorrect answer | Evidence excerpt + strategy rule + conditional independent review + human approval |
| Two valid single-choice answers | same-category distractor audit; reject on any plausible alternate answer |
| Missing/extra multi-select answer | closed-universe wording; per-option evidence; set-completeness review; exact-set server scoring |
| Theology as objective fact | default `SCRIPTURAL_FACT`; reject interpretive/doctrinal claims; a future explicit interpretive mode needs labels and different review |
| Translation mismatch | one version per candidate; store version ID; aliases checked against selected locale/translation |
| Paraphrase shown as quotation | `containsExactQuotation`; exact quotes copied from provider and byte/NFC checked; otherwise visibly label paraphrase |
| Removed context | evidence scope and context-warning check; show evidence in editor |
| Vietnamese name/transliteration ambiguity | aliases are explicit; collision detection after current normalization; warn/reject unclear spellings |
| Duplicate questions/facts | normalized hashes, fact/reference fingerprints, token similarity, answer/reference usage limits |
| Model uses training memory | system instruction says supplied context is the only evidence; references restricted to an enum/list; re-fetch validation |
| Prompt injection | Scripture/user topic placed in delimited data, no tools, strict schema, bounded fields; instructions never interpolated from user text |
| Malicious provider HTML | use text format for AI; if HTML is displayed, sanitize/transform through a tested path; never `dangerouslySetInnerHTML` raw upstream content |
| Malicious or mislabeled upload | private R2; signature/magic-byte validation; strict MIME allowlist; no SVG; safe image re-encode/metadata stripping; bounded audio; `nosniff` delivery |
| Media answer leakage | discard filenames/EXIF; review alt/transcript/caption; reveal-only metadata stays private until reveal |
| Copyright/privacy violation in media | explicit rights attestation, short TTL, report/delete path, no arbitrary remote URLs, and documented takedown process; separate consent and moderation for opt-in AI processing |
| Media unavailable mid-round | validate object at room creation; room-scoped URL valid through room lifetime; preload metadata; text/accessibility fallback; fail question before start rather than during scoring |

### 13.2 Difficulty model

Compute a feature score rather than accepting the model label:

- evidence span: 0 for one verse, 1 for 2–4, 2 for 5+;
- reasoning hops: 0 direct, 1 relation, 2 chronology/multi-claim;
- answer salience: 0 primary entity, 1 secondary detail, 2 low-frequency detail;
- distractor similarity (`SINGLE_CHOICE`): 0 distinct, 1 same class, 2 same class/context;
- set complexity (`MULTIPLE_CHOICE`): 0 for 2-of-3 explicit set, 1 for 2–3 of 4–5, 2 for larger/cross-verse sets;
- ambiguity/transliteration burden: 0 none, 1 one safe alias, 2 multiple forms;
- crossword row/grid burden: average row score plus 0–2 grid factor.
- media recognition burden: 0 clear/supplemental, 1 necessary but accessible, 2 means reject rather than label hard when quality/accessibility is poor.

Proposed thresholds: 0–2 easy, 3–5 medium, 6+ hard. Calibrate thresholds against human ratings before release. A hard label must never compensate for low confidence.

### 13.3 Duplicate detection

Use three local fingerprints first:

1. `textHash = SHA256(type + normalized prompt + normalized answers)`
2. `factFingerprint = SHA256(versionId + sorted evidence IDs + normalized canonical answer + strategy fact key)`
3. token 3-gram Jaccard similarity over Vietnamese-normalized prompts, with a conservative threshold established by evals.

Track reference and answer frequency in the current draft/request. Do not add embeddings/vector infrastructure while the product has no persistent question library. Revisit embeddings only when there are thousands of durable approved questions and deterministic false-negative rates are measured.

## 14. YouVersion licensing findings

### 14.1 Confirmed by current official documentation

1. An app must register on the Platform Portal and use its App Key. The App Key determines which Bible versions are accessible.
2. Appropriate license agreements must be accepted before accessible Bibles are returned for use.
3. The Licenses API exposes license metadata, license HTML/URI, Bible IDs, agreement timestamp, and the agreeing Platform user when queried with the applicable developer context.
4. When Bible text is displayed, the version’s copyright attribution must be shown according to its license. See [Copyright & Attribution](https://developers.youversion.com/sdks/javascript/guides/copyright-and-attribution).
5. Current YouVersion Platform onboarding requirements state non-commercial use: no advertisements, paywalls, or subscriptions. Failure to meet the requirements can remove Platform access. See [How to sign up for Platform](https://help.youversion.com/l/en/article/72ghg45c41-how-to-sign-up-for-platform).
6. The API/SDK provides copyright, promotional content, publisher URL, organization ID, and deep link fields to support compliant display.
7. YouVersion publicly describes Platform as licensed access supplied with publishing partners; availability in the consumer Bible App is not the same as availability to a particular developer App Key.

### 14.2 Requires confirmation from YouVersion and/or the publisher

The current public general documentation does not establish one universal answer for:

- maximum passage/verse display amounts per version;
- browser, edge, Durable Object, or long-term cache TTLs for copyrighted text;
- persistent storage or redistribution of full verses/passages in `.dkt.json` files;
- whether sending Bible text to OpenAI as a subprocessor is permitted;
- whether generated questions, distractors, summaries, or explanations are considered derivatives subject to special terms;
- whether content may be used in a future commercial product;
- required attribution placement for gameplay, exports, and generated derivative text;
- whether exact quotations may persist after a license/version becomes unavailable.
- whether a selected translation permits text-to-speech, uploaded readings, or synchronized audio; do not infer audio rights from text API access.

Before production, send YouVersion a written description of this precise data flow: “retrieve bounded passage -> transmit to OpenAI with `store:false` -> generate editable quiz questions -> persist canonical references, hashes, small quotations, and provenance -> display attribution.” Obtain written approval or version-specific license confirmation.

OpenAI’s current API data controls state that API data is not used for training by default unless the customer opts in, but default abuse-monitoring logs can retain customer content for up to 30 days, and the Responses API can retain application state by default. Use `store:false`; evaluate Zero Data Retention eligibility; and include this retention in both the YouVersion license question and user-media consent/privacy review. Image bytes, audio bytes, and transcripts are customer content too. See [OpenAI data controls](https://platform.openai.com/docs/models/default-usage-policies-by-endpoint).

### 14.3 Storage rule until clarified

Fail conservatively:

- persist references, metadata, attribution, generation provenance, and hashes;
- do not persist full provider passages in Durable Objects, browser caches, PWA caches, logs, or config files;
- use provider text request-scoped for generation;
- display only the minimum exact quotation needed by an approved item, with attribution;
- disable AI generation for a version whose license status/terms are unknown.

Question images and sounds have a separate rights chain from Scripture. MVP media must be user-uploaded with an explicit rights attestation or app-owned/commissioned. Do not treat Bible.com artwork, publisher cover art, YouVersion branding, consumer-app audio, or third-party recordings as reusable merely because related text/version metadata is API-accessible. Generated TTS or image assets are out of MVP until Scripture license, model-provider terms, voice/personality rights, and durable media storage are approved.

## 15. Vietnamese Bible findings

The repository currently uses no declared Bible translation. It contains manual examples and free-text references only.

The official consumer [YouVersion Vietnamese versions page](https://www.bible.com/vi/versions) currently shows these text Bibles:

| Consumer Bible ID | Abbreviation | Title | Publisher/rightsholder shown | Developer availability |
| ---: | --- | --- | --- | --- |
| 19 | BD2011 | Kinh Thánh Tiếng Việt, Bản Dịch 2011 | Bible Society Vietnam / rights text credits Rev. Dr. Bau Dang | **REQUIRES LIVE APP-KEY VERIFICATION** |
| 205 | BPT | Thánh Kinh: Bản Phổ thông | Bible League International | **REQUIRES LIVE APP-KEY VERIFICATION** |
| 1638 | KTHD | Kinh Thánh Hiện Đại | Biblica, Inc. | **REQUIRES LIVE APP-KEY VERIFICATION** |
| 449 | NVB | Kinh Thánh Bản Dịch Mới | Vietnamese Bible, INC | **REQUIRES LIVE APP-KEY VERIFICATION** |
| 193 | VIE1925 | Kinh Thánh Tiếng Việt 1925 | Bible Society Vietnam | **REQUIRES LIVE APP-KEY VERIFICATION** |
| 151 | VIE2010 | Kinh Thánh Tiếng Việt Bản Hiệu Đính 2010 | Bible Society Vietnam | **REQUIRES LIVE APP-KEY VERIFICATION** |

These IDs and publishers prove consumer catalog visibility only. They do not prove third-party Platform licensing.

### 15.1 Exact live verification procedure

After registering this application and accepting applicable licenses:

1. Store its key as a Worker/local secret; never commit it.
2. Call `GET https://api.youversion.com/v1/bibles` with `X-YVP-App-Key`, filtering with the current documented `language_ranges[]=vi*` form and requesting only needed fields.
3. Paginate until `next_page_token` is absent.
4. Record returned IDs, abbreviations, titles, `language_tag`, organization IDs, copyright, publisher URL, and deep links.
5. For each desired ID—especially 449/NVB—call `GET /v1/bibles/{id}` and a small non-production passage probe.
6. Call `GET /v1/licenses?bible_id={id}` and inspect the returned license HTML/URI and agreement metadata in the authenticated developer context.
7. Confirm the Bible contains the required USFM books/index.
8. Save a dated release artifact containing metadata and hashes, not Bible text.
9. Repeat before launch and whenever license/version availability changes.

Do not make NVB the default until that procedure passes. The UI should use a server-configured allowed-version list and have no hard-coded assumption that consumer Bible ID 449 is accessible.

## 16. Security plan

### 16.1 Secrets and egress

- `wrangler secret put YVP_APP_KEY`
- `wrangler secret put OPENAI_API_KEY`
- `wrangler secret put PROVENANCE_SIGNING_KEY`
- optionally `wrangler secret put GENERATION_ABUSE_HMAC_KEY`
- `wrangler secret put QUESTION_MEDIA_SIGNING_KEY`
- bind a private `QUESTION_MEDIA` R2 bucket; R2 credentials are not sent to the browser.
- add only non-secret flags/model IDs/allowed Bible IDs to Wrangler vars.
- make YouVersion/OpenAI calls only from the Worker.
- use constant allowlisted origins and endpoints; never accept a provider URL from the client.
- redact `Authorization`, `X-YVP-App-Key`, Scripture text, prompts, answers, and model output from logs/errors.
- keep the R2 bucket private; expose only opaque IDs and scoped HMAC capabilities; never expose object keys, account credentials, or public bucket listing.

Although YouVersion describes the App Key as a public application key in some browser/data-exchange flows, server-side calls are still the correct choice here: they centralize quotas, licensing allowlists, cache policy, AI grounding, and abuse protection.

### 16.2 Request abuse and cost controls

- separate Turnstile action `generate-questions`; verify hostname/action server-side;
- separate Turnstile action `upload-question-media`; verify before accepting bytes or issuing a capability;
- exact quota in `GenerationGate`: example starting policy 3 generations/5 minutes and 20/day per privacy-preserving client/IP bucket, plus a global emergency ceiling;
- body, candidate-count, verse-count, and timeout limits;
- one active generation per bucket;
- no arbitrary user-supplied provider/model/prompt;
- no arbitrary media URL, filename-derived content type, SVG, oversized image, or over-duration audio;
- model token/output caps;
- no automatic retry after client disconnect;
- global feature flag/kill switch and allowed-version list;
- return 429 with retry time without exposing quota internals.

### 16.3 Prompt injection and output safety

- construct stable developer instructions and separate untrusted topic/Scripture as structured data;
- disable tools and web search;
- require strict JSON Schema;
- validate all strings again with Zod/plain-text rules;
- never execute or render model HTML/Markdown;
- exact quotations come from the provider, not the model output;
- reject interpretive/theological claims by default.
- treat image pixels, EXIF, audio, transcript, alt text, and filename as untrusted content; never allow them to alter developer instructions.

### 16.4 Browser and media delivery security

- add `media-src 'self' blob:` when sound questions ship and `blob:` to `img-src` for validated local preview; keep/remove `data:` only according to existing asset needs;
- use `blob:` only for local preview and revoke object URLs promptly; production playback uses same-origin signed media URLs;
- retain `microphone=()` and `camera=()` because MVP uses file upload, not capture;
- never put builder upload/delete capabilities in room public state, URLs copied into exports, logs, or WebSocket messages;
- rate-limit upload count/bytes separately from AI calls and room creation;
- support a report/takedown and immediate object revocation path even before the normal lifecycle deletion.

## 17. Caching and rate-limit plan

### 17.1 Local persistence policy

| Data | Persist? | Proposed location/TTL |
| --- | --- | --- |
| Bible/version/language/license metadata | Yes, if terms permit | Worker Cache API 6–24h; release artifact contains metadata only |
| Book/chapter/verse index | Yes, if terms permit | Worker Cache API up to 7 days; invalidate by version/license allowlist change |
| Full passage text | No until confirmed | Request memory only; optional edge TTL 5–15 minutes only with written permission |
| Normalized generation context | No | Request memory only |
| Source hashes/references/attribution | Yes | Approved item/config; room ephemeral |
| Candidate diagnostics | Tab only | `sessionStorage`, cleared with draft/room creation |
| Raw OpenAI response | No | Validate then discard; retain only provenance/usage metadata |
| Uploaded question media | Temporarily | Private R2, <=24h builder lifecycle; room-scoped access valid through room expiry; no PWA cache |
| Media transcript/vision analysis | Only if approved into item | Compact accessibility/validation metadata; never retain raw provider response |

PWA and browser responses for Scripture and suggestions remain `no-store`; they must never enter Workbox precache/runtime cache.

Media playback may use short private browser caching only if the signed URL cannot outlive the room and rights policy allows it. Range responses must include the same authorization checks. Do not add `/api/question-media/*` or `/api/rooms/*/media/*` to Workbox runtime caching.

### 17.2 Cache keys and invalidation

Include provider, version ID, passage ID, format, headings/notes flags, `Accept-Language`, and a license-policy/config version. Purge/bump the namespace when a Bible is removed from `YVP_ALLOWED_BIBLE_IDS`, license agreement changes, or mapping contract changes.

### 17.3 Retries and circuit behavior

- timeout YouVersion calls at approximately 8–10 seconds and OpenAI generation at a measured bounded threshold;
- retry idempotent YouVersion GETs at most twice for network/500/503 with jitter;
- honor `Retry-After` exactly for 429 and do not hammer the upstream;
- no retry for 400/401/404/406;
- short isolate-local circuit (for example three transient failures -> 30 seconds open) is sufficient initially; do not add distributed circuit state without evidence;
- fail closed for new generation while leaving manual builder/gameplay intact.
- do not automatically retry non-idempotent uploads; use a client-generated idempotency key and confirm object hash/status before reuse.

## 18. Observability plan

Use structured Cloudflare logs and existing dashboards first; do not add a client analytics SDK.

| Area | Metrics/log fields | Content restrictions |
| --- | --- | --- |
| YouVersion | request count, operation, version ID, status class, 429 count, latency, retry count, cache hit/miss | no App Key, passage text, or full URL query if it contains sensitive data |
| OpenAI | generation count, strategy, configured/returned model, latency, input/output/reasoning tokens, status, retry count | no prompt, Scripture, question, answer, or raw response |
| Media | upload/serve/delete count, kind, byte/duration buckets, file-validation failures, expiry, range-response status, delivery latency; AI moderation failures only for opt-in analysis | no filename, pixels/audio, transcript, alt text, signed URL, or ownership capability |
| Validation | pass/warn/reject by check code/type, candidate yield, duplicate/ambiguity/reference rejection | IDs and aggregate counts only |
| Product quality | candidate approval count, regenerate count, edit-distance bucket, type/difficulty mix | requires a privacy-reviewed content-free event; no text |
| Operations | Turnstile failure, quota rejection, upstream availability, feature flag state | privacy-preserving bucket only |

Because approval/editing currently happens only in the browser, “human edit rate” and “approval rate” are unavailable without a new content-free telemetry endpoint. Treat that as an explicit, privacy-reviewed follow-up rather than claiming it exists. Incorrect-answer reports likewise remain user feedback unless a durable report system is deliberately added.

Alert/release thresholds to establish after baseline traffic:

- YouVersion 429 >1% or 5xx >2% in 15 minutes;
- AI transport/schema failure >3%;
- validation rejection >40% by strategy;
- media file-validation failure changes materially from baseline or room playback errors exceed 1%; AI moderation failures are monitored separately;
- human approval <50% or heavy-edit >30%;
- p95 generation latency above the agreed UX limit;
- cost/day reaches 70% of the configured budget ceiling.

## 19. Test strategy

### 19.1 Unit tests

- USFM parsing/canonicalization and same-chapter range rules;
- provider-response Zod mapping;
- version allowlists and license state;
- chunking and source hashes;
- every strategy’s model-output-to-`GameItem` mapper;
- `MULTIPLE_CHOICE` correct-ID cardinality, unordered exact-set scoring, and explicit-submit state;
- common text/image/audio presentation fallback and private/public media metadata split;
- media prefetch/start/answer-open timestamp rules and early-answer rejection in both game modes;
- crossword deterministic special-cell solver with Vietnamese graphemes;
- difficulty features/thresholds;
- text/fact/reference duplicate fingerprints;
- validation receipt signing/verification;
- v1 -> v2 portable config migration.
- media-free JSON and media package manifest/hash/path validation.

### 19.2 Integration/contract tests

- YouVersion adapter with stubbed `fetch`: success, 204, pagination, 400/401/404/406, 429 + `Retry-After`, 500/503, timeout, malformed JSON, schema drift;
- OpenAI adapter with stubbed Responses API: strict success, refusal, incomplete, malformed schema, rate limit, timeout, returned model/usage;
- Worker endpoints with Turnstile, GenerationGate, feature flags, body/scope limits, and no-store/security headers;
- R2 media endpoint with fake binding: type/signature mismatch, size/dimension/duration limits, duplicate upload idempotency, expired/forged capability, range reads, delete, and room binding;
- image input and audio-transcription adapters with stubbed OpenAI responses; transcript never bypasses structured question validation;
- contract fixtures must be synthetic or use an explicitly license-approved/public-domain excerpt.

### 19.3 Golden/eval tests

For a small approved Scripture fixture set, assert properties rather than a single phrasing:

- evidence IDs exist and excerpts match;
- one correct `SINGLE_CHOICE` answer and no duplicate options;
- complete multi-select answer set with every correct option grounded and every incorrect option rejected;
- short answer has one exact expected answer;
- false statement contains one controlled mutation;
- crossword rows/grid compile;
- no interpretive claim;
- difficulty features match human labels within an agreed tolerance.

Maintain separate Vietnamese fixtures covering diacritics, `Đ/đ`, hyphenation, names with multiple common transliterations, and grapheme cells.

Maintain synthetic/app-owned media fixtures: clear/blurred/oversized/animated/mislabeled images; normal/silent/corrupt/over-duration MP3; alt/transcript answer leakage; accessible equivalent; removed/expired object. Fixtures must not copy Bible.com or publisher media.

### 19.4 Failure and regression tests

- invalid/invented verse;
- version removed after selection;
- two valid `SINGLE_CHOICE` answers;
- missing/extra `MULTIPLE_CHOICE` answers and order-independent submission;
- ambiguous short answer;
- wrong speaker/chronology;
- translation mismatch and altered quotation;
- duplicate/paraphrased fact;
- scope too large;
- YouVersion 429/unavailable;
- OpenAI unavailable/refusal/malformed output;
- quota/Turnstile failure;
- old manual `.dkt.json` import and room play unchanged;
- candidate metadata never leaks private answers before reveal;
- malicious SVG/polyglot, EXIF leakage, media capability replay, range-request abuse, expired object, and media unavailable at round start;
- old media-free `.dkt.json`, new `.dkt.zip`, and room payload size/WebSocket non-regression.

### 19.5 Live probes

Normal CI must not use external APIs. Add explicit scripts that run only with secrets in a protected environment:

- `verify-youversion-license-and-versions`
- `smoke-question-generation` using one allowed public-domain/license-approved passage

Never print passage text or keys in CI logs.

## 20. Migration and rollout plan

### 20.1 NOW / NEXT / LATER

| Horizon | Product capability | Why it belongs there |
| --- | --- | --- |
| **NOW** | Legal/App-Key gate; Vietnamese version verification; vendor-neutral Scripture contracts; server-side version/index/passage access; deterministic `MULTIPLE_CHOICE` and common media-aware presentation contracts; evidence validation; `SHORT_ANSWER` and `SINGLE_CHOICE` suggestions; editable approval UX; optional provenance; Turnstile/quota/kill switch | Establishes authoritative content and backward-compatible game contracts before adding binary storage or higher-risk generation. |
| **NEXT** | Private short-lived R2 media pipeline; image/sound builder/playback/accessibility; AI image analysis and bounded audio transcription; AI `MULTIPLE_CHOICE`; controlled `TRUE_FALSE`; complete crossword editor/strategy; difficulty calibration; recommendations; Auto Balance; content-free quality telemetry | Depends on validated storage/rights/security and production evidence; these strategies and media paths have higher ambiguity, accessibility, cost, or runtime risk. |
| **LATER** | AI-created images or text-to-speech; camera/microphone capture; YouVersion sign-in and highlights-based generation; BibleReader; Verse of the Day; durable quiz/user history; cross-session weak-area or recently-unused recommendations; embeddings; async generation/transcoding jobs | Each requires a separately validated need, new privacy/account/storage infrastructure, larger corpus/latency evidence, or licensing/voice/media-rights confirmation. |

“Recently unused passages” and personal weak-area recommendations are deliberately LATER: current `sessionStorage` drafts and ephemeral rooms provide no reliable cross-session history.

### 20.2 Phased delivery

#### Phase A — legal and platform foundation

- register the exact app/use case;
- confirm non-commercial compatibility;
- accept and archive applicable licenses;
- run live Vietnamese version verification;
- obtain written answer about AI subprocessors, retention, derived questions, caching, and attribution.

Exit gate: at least one allowed Vietnamese version and approved data-flow policy.

#### Phase B — Scripture domain/provider

- add canonical contracts/reference parser;
- add server-side REST adapter, version/index/passage endpoints, metadata cache, errors, and tests;
- add version/scope picker and attribution preview under a feature flag.

Exit gate: live-key smoke and mocked contract suite pass.

#### Phase C — validation foundation and safe strategies

- add GenerationGate + Turnstile action;
- add OpenAI provider/strict schemas;
- add validation pipeline;
- implement `SHORT_ANSWER`, then `SINGLE_CHOICE`;
- implement the non-AI `MULTIPLE_CHOICE` compiler/protocol/player path so its scoring semantics are proven before generation;
- return editable candidates without server persistence.

Exit gate: golden/eval thresholds, cost/latency budget, and zero auto-publish.

#### Phase D — builder/provenance compatibility

- integrate suggestion drawer/cards/evidence;
- add v2 config migration and optional approved provenance;
- show attribution when provider text appears;
- verify all legacy fixtures/e2e flows.

#### Phase E — question media foundation

- activate the common presentation/media contracts with private short-lived R2 upload/delivery;
- add image/sound builder controls, accessibility equivalents, room-scoped playback, and portable media packages;
- add vision analysis and separate audio transcription only after rights/moderation/privacy gates pass.

#### Phase F — all target types

- add AI `MULTIPLE_CHOICE` with closed-set validation;
- add controlled `TRUE_FALSE`;
- expose missing crossword row metadata in editor;
- add deterministic crossword solver/strategy;
- keep unsupported quiz formats out.

#### Phase G — recommendation and Auto Balance

- implement deterministic optimizer;
- add existing-draft balance/coverage recommendations;
- add calibrated difficulty and targeted “easier/harder/better distractors” actions.

#### Phase H — optional YouVersion user features

- evaluate “quiz from my highlights” as the only clear current account use case;
- only then design sign-in, token storage, privacy, and `highlights` data exchange;
- consider BibleReader/VOTD independently.

### 20.3 Feature flags and rollback

```text
SCRIPTURE_PROVIDER_ENABLED
AI_QUESTION_SUGGESTIONS_ENABLED
AI_AUTO_BALANCE_ENABLED
QUESTION_MEDIA_ENABLED
AI_MEDIA_ANALYSIS_ENABLED
YVP_ALLOWED_BIBLE_IDS
OPENAI_GENERATION_MODEL
OPENAI_REVIEW_MODEL
```

Rollback is flag-off. Existing manual builder and rooms require no provider. Do not make provider availability a prerequisite for opening/playing already-authored games.

## 21. ADR-style decisions

### ADR-1: YouVersion direct REST vs official SDK

- Context: official JavaScript/React SDKs exist and support serverless, but this Worker needs a small set of backend operations and has strict bundle/free-tier checks. Current SDK HTML transformation can dynamically require `jsdom` on the server.
- Options: React SDK in browser; JavaScript core in Worker; native REST adapter.
- Decision: native REST from the Worker behind `ScriptureProvider`.
- Why: smallest bundle, server-side quota/licensing control, no client coupling/localStorage, exact endpoint/error behavior, easy stubbing.
- Trade-offs: maintain Zod response contracts/retries and track upstream changes manually.
- Revisit when: official core bundle is measured within budget and removes meaningful adapter maintenance, or BibleReader becomes a product feature.

### ADR-2: backend vs frontend YouVersion calls

- Decision: backend only for this feature.
- Why: AI must receive exactly the validated provider context; backend centralizes allowed versions, caching, Retry-After, observability, and abuse controls.
- Trade-off: additional Worker requests/latency.

### ADR-3: reference-first vs local Scripture persistence

- Decision: reference-first; no full passage persistence until written license confirmation.
- Why: matches the current ephemeral product and minimizes licensing/data-retention risk.
- Trade-off: generation needs upstream availability; existing approved questions still play.

### ADR-4: one AI call vs staged pipeline

- Decision: specialized generation call per strategy group, deterministic validation, and conditional independent AI review.
- Why: avoids a giant universal prompt and limits expensive review to ambiguity-prone candidates.
- Trade-off: more orchestration and occasionally multiple calls.

### ADR-5: deterministic validation vs LLM judge

- Decision: deterministic checks are authoritative for schema, reference, quotation, grid, and runtime rules; AI review may only warn/reject semantic ambiguity.
- Why: an LLM cannot establish that a reference exists or override exact game rules.
- Trade-off: some factual relationships remain human-reviewed.

### ADR-6: synchronous vs async generation

- Decision: bounded synchronous request for MVP (<=10 candidates, <=40 verses), with cancellation/timeout UX.
- Why: no job infrastructure or account ownership exists; avoids polling/queue/database complexity.
- Trade-off: request latency is visible.
- Revisit when: p95 exceeds UX target, requests need larger chapters/batches, or reliable resume-after-navigation becomes necessary. A TTL `QuestionGenerationJob` Durable Object is the next step, not D1 by default.

### ADR-7: embeddings vs fingerprints

- Decision: hashes/fact keys/token similarity now; no embeddings.
- Why: current duplicate universe is one draft/request, not a large permanent library.
- Revisit when: durable approved corpus reaches measured scale and simpler methods miss material duplicates.

### ADR-8: YouVersion sign-in now vs later

- Decision: later.
- Why: authoritative Bible API does not require end-user sign-in; the app has no account model; current SDK auth relies on browser persistence that conflicts with repository policy.
- Revisit when: an opt-in highlights-based quiz flow has validated user value.

### ADR-9: `MULTIPLE_CHOICE` meaning and scoring

- Context: the existing `SINGLE_CHOICE` is already a conventional one-answer multiple-choice question; the requested new identifier must have distinct behavior.
- Options: alias/rename `SINGLE_CHOICE`; allow one-or-more answers with the new type; define `MULTIPLE_CHOICE` as two-or-more correct answers.
- Decision: `MULTIPLE_CHOICE` is an exact-set multi-select type with at least two correct and one incorrect option; no partial credit in MVP.
- Why: unambiguous author/player behavior, preserves old schemas, and reuses the current binary scoring/ranking model.
- Trade-offs: explicit Submit UI and protocol changes; a missed/extra selection makes the whole answer incorrect.
- Revisit when: user tests demonstrate that calibrated partial credit improves gameplay without incentivizing indiscriminate selection.

### ADR-10: media as a presentation capability vs item types

- Context: every answer type must support questions presented with an image or sound.
- Options: create `IMAGE_QUESTION`/`SOUND_QUESTION`; duplicate media fields in five schemas; add one common presentation/media contract.
- Decision: common optional presentation media on each authored item/row; answer type continues to determine input and scoring.
- Why: prevents a combinatorial union (`IMAGE_MULTIPLE_CHOICE`, etc.), keeps compiler/scoring ownership clear, and provides one security/accessibility path.
- Trade-offs: legacy prompt fields require a compatibility helper until a future schema cleanup.
- Revisit when: a media interaction has genuinely different answer mechanics rather than merely presenting the prompt.

### ADR-11: binary media storage and AI analysis

- Context: the repository has no object store, the room body is capped at 512 KiB, WebSockets at 8 KiB, and external URLs are unsafe/unreliable.
- Options: base64 in JSON/DO; hotlink arbitrary URLs; permanent public bucket; short-lived private R2; browser-only blobs.
- Decision: short-lived private R2 with opaque asset IDs, builder/room-scoped capabilities, lifecycle deletion, and compact references; no bytes over WebSockets.
- Why: works with the Cloudflare deployment and ephemeral product while preserving payload, access, and cleanup boundaries.
- Trade-offs: a new paid/quota-bearing service, upload/rights/moderation operations, portable ZIP format, and expiry UX.
- Revisit when: the product adds permanent accounts/libraries or requires server-side transcoding. Vision uses Responses image input; sound is transcribed first by a purpose-built model, then enters the same structured pipeline.

## 22. File-level change map

The exact names can shift during implementation, but ownership should remain this narrow.

### CREATE

| Path | Purpose |
| --- | --- |
| `shared/scripture.ts` | Vendor-neutral references, versions, evidence, attribution types |
| `shared/question-intelligence.ts` | Request/candidate/status/difficulty/provenance types |
| `shared/question-intelligence-schemas.ts` | Strict Zod request/candidate schemas |
| `shared/question-media.ts` | Common image/audio reference, rights, accessibility, and lifecycle contracts |
| `worker/scripture/reference.ts` | USFM parse/canonicalize/scope helpers |
| `worker/scripture/service.ts` | Allowlist, chunking, caching policy, validation orchestration |
| `worker/integrations/youversion/rest-provider.ts` | REST auth, endpoints, retries, Zod mapping |
| `worker/integrations/youversion/schemas.ts` | Upstream contract schemas |
| `worker/question-intelligence/service.ts` | End-to-end candidate orchestration |
| `worker/question-intelligence/provider.ts` | Minimal AI provider interface |
| `worker/integrations/openai/responses-provider.ts` | Responses API + Structured Outputs adapter |
| `worker/question-intelligence/strategies/*.ts` | Five specialized strategies and prompt/schema versions |
| `worker/question-intelligence/validation/*.ts` | Evidence, ambiguity, difficulty, duplicate, receipt checks |
| `worker/GenerationGate.ts` | Content-free short-lived quota ledger |
| `worker/security/generation-abuse.ts` | Turnstile/quota/client-bucket helpers |
| `worker/question-media/service.ts` | Upload validation, object lifecycle, ownership/room capability binding |
| `worker/question-media/signatures.ts` | Builder/room-scoped HMAC capability helpers |
| `worker/question-media/image-validation.ts` | Signature/dimension/animation/metadata safety checks |
| `worker/question-media/audio-validation.ts` | MP3 signature/duration/quality checks |
| `src/features/scripture/ScriptureScopePicker.tsx` | Version/book/chapter/passage selection |
| `src/features/builder/AiSuggestionsPanel.tsx` | Generate controls and candidate list |
| `src/features/builder/AiCandidateCard.tsx` | Editable payload, evidence, status, approval |
| `src/features/builder/questionSuggestions.ts` | Candidate state/mapping/session persistence |
| `src/features/builder/QuestionMediaEditor.tsx` | Upload, replace/remove, rights, alt/transcript, expiry UX |
| `src/features/media/QuestionMedia.tsx` | Shared safe image/audio renderer and playback behavior |
| `tests/unit/scripture-reference.test.ts` | Canonical reference tests |
| `tests/unit/question-strategies.test.ts` | Strategy/validation/difficulty/duplicate tests |
| `tests/worker/question-suggestions.test.ts` | Endpoint/provider/quota integration tests |
| `tests/worker/question-media.test.ts` | Fake-R2 upload, capabilities, range delivery, expiry/deletion tests |
| `tests/unit/multiple-choice.test.ts` | Schema/compiler/exact-set scoring/protocol tests |
| `tests/fixtures/youversion/*.json` | Synthetic/license-approved API fixtures |
| `tests/fixtures/openai/*.json` | Structured response/refusal/error fixtures |
| `scripts/verify-youversion-access.ts` | Opt-in release verification; secrets required |

### MODIFY

| Path | Change |
| --- | --- |
| `shared/game.ts` | New `MULTIPLE_CHOICE`, `OPTIONS` player/private answer, common media references, optional evidence/provenance, compact runtime attribution |
| `shared/schemas.ts` | Multi-select cardinality, media/presentation, and backward-compatible optional fields with strict validation |
| `shared/errors.ts` | Stable Scripture/generation error codes |
| `shared/limits.ts` | Scope/candidate/request plus image/audio/room-media limits |
| `worker/env.ts` | YouVersion/OpenAI/media/provenance signing secrets, bindings, and flags |
| `worker/index.ts` | Thin new API routing; no prompts/business logic |
| `worker/room/round-compiler.ts` | Compile multi-select exact-set answers; carry compact reference/attribution/media ID only |
| `worker/room/scoring.ts` | Exact unordered set comparison for `OPTIONS`; scoring points remain binary/unchanged |
| `worker/GameRoom.ts` | Accept one explicit multi-select submission; bind compact room media metadata; no bytes or AI calls |
| `worker/room/state-machine.ts` | Bounded media-prepare/start/fallback transition before answer timing; existing lifecycle remains authoritative |
| `wrangler.jsonc` | feature vars, `GENERATION_GATES`, private `QUESTION_MEDIA` R2 binding/lifecycle documentation, safe migration |
| `.dev.vars.example` | variable names only, never values |
| `.github/workflows/deploy.yml` | ensure production secrets/vars exist; optional protected live probe |
| `src/lib/api.ts` | scripture/suggestion/media upload/delete client methods |
| `src/pages/BuilderPage.tsx` | mount Scripture/AI panel; merge approved items |
| `src/features/builder/ItemEditor.tsx` | multi-select branch; shared media editor; evidence/provenance badge; missing crossword row metadata fields |
| `src/features/builder/gameConfig.ts` | v1/v2 JSON reader plus media-package manifest/import/export |
| `src/features/builder/sessionDraft.ts` | v2/candidate draft state plus expiring session-only media handles (never exported) |
| `src/features/builder/Preview.tsx` | multi-select and exact image/audio/accessibility preview |
| `src/pages/HostRoomPage.tsx` | multi-select state plus compact source/media attribution on reveal/display |
| `src/pages/PlayerRoomPage.tsx` | checkbox/submit answer plus accessible image/audio playback |
| `src/pages/ScreenRoomPage.tsx` | multi-select/media round presentation and reveal |
| `src/styles/app.css` | builder suggestion/evidence states and responsive layout |
| `tests/fixtures/games.ts` | legacy + grounded fixtures |
| `tests/unit/domain.test.ts` | provenance/runtime non-leakage/compile tests |
| `tests/unit/game-config.test.ts` | v1 compatibility, v2 JSON round-trip, and media-package validation |
| `tests/worker/game-room.test.ts` | grounded/manual coexistence and private-answer behavior |
| `src/features/realtime/*` | new `OPTIONS` answer payload and multi-select client state; media remains URL metadata only |
| `scripts/check-free-tier.ts` | allow/verify the intended second DO and one lifecycle-managed R2 media bucket; retain bundle/quota checks and forbid unplanned stores |
| `README.md` and privacy/editorial docs | document optional AI flow, data handling, licensing, and manual fallback |

### UNCHANGED IN RESPONSIBILITY

| Path | Why |
| --- | --- |
| `worker/room/ranking.ts` | no recommendation concern belongs in ranking |
| `worker/room/authentication.ts` | generation does not create user accounts |
| `src/pages/JoinRoomPage.tsx` | joining is unrelated |
| `src/features/crossword/alignment.ts` | reuse current layout behavior; do not replace it |
| public SSG architecture under `site/` | only documentation copy changes, not rendering architecture |

## 23. Risks and open questions

### BLOCKER

1. Does the product commit to YouVersion’s current non-commercial requirement for the foreseeable roadmap?
2. Which Vietnamese Bibles are returned for this application’s live App Key after license acceptance?
3. Do the selected licenses permit sending bounded Bible text to OpenAI, default/ZDR retention characteristics, generated derivatives, and the proposed display/export behavior?
4. What attribution text and placement does each selected publisher require?
5. What media rights/moderation/takedown policy will the product enforce, and is short-lived R2 operational/cost ownership approved?
6. Will uploaders explicitly consent to image/audio transmission to OpenAI for analysis/transcription, and do the chosen retention/privacy controls cover binary media?

### HIGH

1. No user accounts make AI cost abuse materially easier; GenerationGate + Turnstile + global ceiling are release requirements.
2. Vietnamese names/transliterations can collide under the current diacritic/punctuation normalization.
3. Crossword generation has a high rejection/edit burden and can unexpectedly consume many runtime rounds.
4. Upstream docs/changelog are evolving quickly; contract fixtures and release verification must catch changes.
5. OpenAI semantic review is not proof of scriptural truth; human approval remains mandatory.
6. Synchronous latency may be unacceptable on slow/provider-limited requests.
7. Audio/image questions can exclude users or create unfair modality differences unless public accessibility equivalents and consistent playback/replay rules are enforced.
8. User-uploaded media creates copyright, privacy, harmful-content, EXIF, and takedown obligations absent from the current text-only product.
9. Multi-select exact-set questions have higher incomplete-answer ambiguity; closed-universe validation must meet its eval threshold before AI rollout.

### MEDIUM

1. Metadata/passages need a cache policy that is both license-compliant and useful across edge locations.
2. Model/pricing changes can shift quality/cost; configuration and evals must gate changes.
3. Optional provenance expands `.dkt.json` and room payloads; stay under 512 KiB and 100 rounds.
4. Public website is bilingual but game UI is Vietnamese; English generation should wait for end-to-end localization.
5. Validation receipts become invalid if signing-key rotation has no key ID/overlap plan.
6. R2 expiry can break saved browser drafts or delayed room creation; the builder must display expiry and support re-upload/package recovery.
7. Image vision and audio transcription add separate cost/latency/rate-limit/failure modes.

### LOW

1. Fonts, Organizations, and VOTD may tempt unrelated scope growth.
2. A full BibleReader could duplicate rather than strengthen the existing builder experience.
3. Exact version metadata can change; always prefer live provider metadata over hard-coded labels.
4. Media replay/preload choices can affect competitive timing even when scoring logic is unchanged.

## 24. Implementation backlog

### Task 0 — legal/app registration gate (S)

- Objective: prove the use case is permitted and select allowed Vietnamese versions.
- Files/modules: no production code; add `docs/youversion-license-decision.md` and dated metadata artifact later.
- Dependencies: product owner, YouVersion/publisher response.
- Acceptance: non-commercial decision; App Key; accepted license; written answers on AI/cache/derivatives/attribution and any Scripture audio/TTS implications; live NVB/alternatives matrix; separate user-media rights/moderation/takedown decision.
- Tests: manual live-key procedure recorded.

### Task 1 — canonical Scripture contracts and parser (M)

- Objective: parse/canonicalize/validate MVP USFM scopes without vendor response leakage.
- Files: `shared/scripture.ts`, `worker/scripture/reference.ts`, unit tests.
- Dependencies: Task 0 for allowed shapes, not live network.
- Acceptance: chapter/single/range round-trips; invalid/cross-chapter input rejected; Unicode/plain-text limits.
- Tests: table-driven parser and boundary cases.

### Task 2 — YouVersion REST provider (M)

- Objective: list versions, retrieve metadata/index/passages, map errors, and honor Retry-After.
- Files: `worker/integrations/youversion/*`, `worker/env.ts`, `.dev.vars.example`.
- Dependencies: Task 1.
- Acceptance: no raw response leaks; app key server-only; timeouts/retries bounded; all upstream statuses mapped.
- Tests: stubbed fetch contract suite and malformed schema cases.

### Task 3 — ScriptureService and read APIs (M)

- Objective: enforce allowed versions/scope, chunk passages, attach attribution/fingerprints, and expose builder-safe endpoints.
- Files: `worker/scripture/*`, `worker/index.ts`, `shared/errors.ts`, `src/lib/api.ts`.
- Dependencies: Task 2.
- Acceptance: Vietnamese picker data from live App Key; no-store browser responses; no persistent passage text.
- Tests: endpoint, pagination, chunking, allowlist, cache-policy tests.

### Task 4 — live version/license verification script (S)

- Objective: automate the release gate without logging Scripture/secrets.
- Files: `scripts/verify-youversion-access.ts`, package script, protected deploy documentation.
- Dependencies: Tasks 0–3.
- Acceptance: reports IDs/metadata/license status; non-zero exit if required version/passage unavailable.
- Tests: mock mode; protected live run.

### Task 5 — GenerationGate and AI abuse controls (M)

- Objective: make billable generation safe in an accountless app.
- Files: `worker/GenerationGate.ts`, `worker/security/generation-abuse.ts`, `wrangler.jsonc`, Turnstile component, free-tier audit.
- Dependencies: quota/product budget decision.
- Acceptance: per-window/day/global limits, one concurrent request, content-free storage, <=26h deletion, friendly 429.
- Tests: concurrency, expiry, replay, feature kill switch.

### Task 6 — OpenAI structured provider (M)

- Objective: wrap the Responses API behind the minimal provider interface.
- Files: `worker/question-intelligence/provider.ts`, `worker/integrations/openai/responses-provider.ts`, env/config.
- Dependencies: Task 5; legal approval to transmit selected text.
- Acceptance: strict schema, `store:false`, no tools, timeout/output cap, usage metadata, redacted errors.
- Tests: success/refusal/incomplete/malformed/429/5xx/timeout fixtures.

### Task 7 — validation/difficulty/duplicate foundation (L)

- Objective: implement the multi-stage pipeline and receipts independent of any one strategy.
- Files: `worker/question-intelligence/validation/*`, shared candidate schemas.
- Dependencies: Tasks 1–3 and 6.
- Acceptance: deterministic checks cannot be overridden by AI; calibrated status/confidence; no raw text persistence.
- Tests: threat-model cases, fingerprints, receipt tampering, difficulty features.

### Task 8 — common presentation and `MULTIPLE_CHOICE` game contract (L)

- Objective: add the fifth authored type and optional image/audio presentation references without AI or binary storage.
- Files: `shared/game.ts`, `shared/schemas.ts`, compiler/scoring, `GameRoom`, realtime contracts, editor/preview/player/screen/host branches.
- Dependencies: none beyond current game contracts; coordinate optional provenance fields from Task 7.
- Acceptance: legacy four types unchanged; `MULTIPLE_CHOICE` has 3–6 options, 2+ correct and 1+ incorrect; exact unordered-set scoring; one explicit Submit; no answer IDs leak; presentation helper preserves legacy text fields.
- Tests: schema cardinality, missing/extra/order-independent selections, one-submission enforcement, both game modes, old fixtures/protocol behavior.

### Task 9 — short-answer strategy (M)

- Objective: generate the safest explicit-answer candidates.
- Files: strategy module/schema/prompt version and tests.
- Dependencies: Tasks 7–8.
- Acceptance: one objective answer; valid aliases; evidence exact; final schema passes; optional presentation metadata is server-assigned only.
- Tests: Vietnamese aliases, collisions, ambiguity rejection, golden eval.

### Task 10 — single-choice strategy (M)

- Objective: produce one correct answer and audited distractors for existing `SINGLE_CHOICE`.
- Files: strategy module/schema/prompt version and tests.
- Dependencies: Tasks 7–8.
- Acceptance: 2–4 unique options; no alternate correct answer in eval set; distractor regeneration preserves evidence/answer.
- Tests: double-correct, alias collision, grammatical giveaway, golden eval.

### Task 11 — text-first builder suggestion UX (L)

- Objective: add Generate Suggestions without creating a chatbot or auto-publishing.
- Files: Scripture picker, suggestion panel/card/state, `BuilderPage`, API wrapper, CSS.
- Dependencies: Tasks 3, 5, 9, 10.
- Acceptance: scope/difficulty/count/types; loading/cancel/error; editable evidence cards; explicit selection/approval; mobile/keyboard accessible; manual fallback.
- Tests: React unit + Playwright generate/edit/approve/manual-fallback flows.

### Task 12 — v2 config/provenance/attribution (M)

- Objective: preserve grounded metadata while old configs/games keep working.
- Files: shared game/schemas, JSON config migrator, compiler, reveal UI, docs.
- Dependencies: Tasks 8 and 11.
- Acceptance: v1 imports; v2 media-free round-trip; manual items omit metadata; attribution visible where required; payload under limits.
- Tests: unit/worker/e2e regression suite.

### Task 13 — private media upload/storage/delivery (L)

- Objective: safely store and serve short-lived question images/sounds without using game JSON, DO state, WebSockets, or arbitrary URLs for bytes.
- Files: `shared/question-media.ts`, `worker/question-media/*`, `worker/index.ts`, `worker/env.ts`, `wrangler.jsonc`, limits/errors, fake-R2 tests.
- Dependencies: media rights/operations decision; Task 8 contracts; no OpenAI or YouVersion dependency.
- Acceptance: private R2; opaque IDs; builder/room HMAC capabilities; signature/type/size/dimension/duration checks; rights attestation; validation state; range audio; lifecycle/takedown deletion; no SVG/EXIF/key leakage; works with all AI flags off and no OpenAI key.
- Tests: fake-R2 upload/serve/delete/expiry, forged/replayed token, MIME polyglot, range abuse, idempotency, room lifetime.

### Task 14 — media builder, runtime, accessibility, and package UX (L)

- Objective: make every type/row usable with one image or sound prompt while preserving portable authoring.
- Files: `QuestionMediaEditor`, shared media renderer, all question editors/previews/room views, room compiler/state machine/realtime timing, CSS, CSP, `gameConfig` ZIP package handling.
- Dependencies: Tasks 8, 12, 13.
- Acceptance: upload/replace/remove; rights and expiry shown; public alt/transcript equivalent; keyboard audio controls; canonical prefetch/`mediaStartAt`/post-audio answer timing and fallback; consistent replay; room URL survives game; `.dkt.zip` hash/path-safe round-trip; media-free JSON unchanged.
- Tests: five-type media matrix on mobile/desktop; accessibility checks; expired/revoked asset; ZIP traversal/bomb/hash mismatch; no PWA caching.

### Task 15 — AI image analysis and audio transcription (L)

- Objective: let validated media inform suggestions without treating it as Scripture or allowing it to control prompts.
- Files: AI provider input types, media analysis/transcription adapters, validation/eval fixtures, generation endpoint.
- Dependencies: Tasks 6–7 and 13–14; privacy/retention approval for media.
- Acceptance: Responses image input only for validated images; bounded `gpt-transcribe` step for MP3; transcript/analysis separated from Scripture evidence; no Structured Outputs assumption for transcription; no raw media/provider response retained or logged.
- Tests: stubbed clear/poor/unsafe images, normal/silent/corrupt audio, prompt injection in pixels/transcript, answer-leaking accessibility metadata, provider timeout/429.

### Task 16 — AI `MULTIPLE_CHOICE` strategy (M)

- Objective: generate complete, closed-set multi-select candidates for the Task 8 engine contract.
- Files: strategy/schema/validator/UI evidence mapping and tests.
- Dependencies: Tasks 7–8 and 11; Task 15 only when media-assisted generation is enabled.
- Acceptance: 3–6 unique options; 2+ grounded correct members; 1+ rejected distractor; closed-universe wording; exact-set contract; per-option evidence; no all/none option.
- Tests: incomplete set, extra plausible member, translation alias collision, open-universe prompt, golden eval with text and media variants.

### Task 17 — true/false strategy (M)

- Objective: add atomic true claims and one-slot false mutations.
- Files: strategy/validator/UI affordance/tests.
- Dependencies: Tasks 7–8 and initial eval feedback; Task 15 for media-assisted variants.
- Acceptance: mutation audit shown; no compound/interpretive/trivial-negation candidates pass.
- Tests: partial-truth, context-loss, and media-conflict corpus.

### Task 18 — crossword editor completion and strategy (L)

- Objective: make all existing crossword metadata/presentation editable, then generate solvable grounded crosswords.
- Files: `ItemEditor`, crossword strategy/solver, media renderer, schemas/compiler tests.
- Dependencies: Tasks 7–8 and 14; explicit decision on unused `verticalDurationSec`.
- Acceptance: every row grounded; deterministic grid; 3–10 rows; runtime cap; aliases/references/media editable; preview compiles.
- Tests: Vietnamese graphemes, repeated letters, no-grid, row/media replacement, 100-round boundary.

### Task 19 — Auto Balance and recommendations (L)

- Objective: choose a diverse type/difficulty/reference/modality mix deterministically.
- Files: recommendation/optimizer modules and builder controls.
- Dependencies: Tasks 9, 10, 16–18 and calibrated evals.
- Acceptance: documented constraints/objective; choice-type/modality caps; never forces ineligible type/media/hard question; refill bounded; explains choices.
- Tests: sparse/dense scope, small/large counts, existing duplicate-heavy drafts, media/no-media, round capacity.

### Task 20 — observability, eval gate, and staged rollout (M)

- Objective: make Scripture, AI, media quality/cost/availability measurable and safely enable production.
- Files: structured logging helpers, dashboards/runbook docs, CI/release scripts, feature vars.
- Dependencies: all MVP/NEXT tasks selected for a release.
- Acceptance: redacted metrics; separate AI/transcription/R2 ceilings; quality/accessibility thresholds; canary versions; kill-switch drill; manual/media-free builder unaffected during provider outage.
- Tests: log-redaction, feature-flag rollback, media revocation, production smoke with approved passage/app-owned media.

### Task 21 — optional YouVersion sign-in/highlights discovery (L, later)

- Objective: validate “generate from my highlights” before building accounts.
- Files: separate ADR/prototype only at first.
- Dependencies: user research, privacy/account/storage design.
- Acceptance: clear product value and current PKCE/highlights contract; no assumption of notes/bookmarks.
- Tests: current two-hop callback, state/nonce/PKCE, token expiry/revocation, permission denial.

## 25. Cost and performance estimate

Cost originates from OpenAI input/output/reasoning tokens and retries, optional image input and audio transcription, R2 storage/class operations/egress, and any managed image normalization/moderation service. YouVersion publishes the Platform/API as free but still rate-limits App Keys and does not publish a numeric per-app quota in the docs reviewed.

A bounded request with 2,000–6,000 input tokens and 2,000–4,000 output/reasoning tokens would cost approximately, using prices shown in the current model catalog:

- `gpt-5.6-terra` ($2/M input, $12/M output): about $0.028–$0.060 per generation call;
- `gpt-5.6-sol` ($4/M input, $20/M output): about $0.048–$0.104 per call;
- a second semantic review adds its own tokens and can roughly double the AI portion.
- `gpt-transcribe` is currently listed at $0.0045 per audio minute; a 60-second cap makes the direct transcription component small, but upload, retry, moderation, and downstream generation still apply. See [GPT-Transcribe](https://developers.openai.com/api/docs/models/gpt-transcribe).

These are planning ranges, not a quote; actual reasoning tokens, model pricing, caching, retries, and output length must be measured.

Cost/latency controls:

1. retrieve and normalize Scripture once per request;
2. chunk and reuse it across candidate strategies in memory;
3. generate multiple candidates of the same type in one structured call;
4. validate deterministically before paying for semantic review;
5. review only WARN/high-risk candidates;
6. cap candidate count, scope, output tokens, and retries;
7. avoid extended prompt caching until license/retention is approved;
8. collect edit/approval yield before upgrading model/reasoning effort;
9. use a cheaper affordance classifier only after evals establish recall;
10. never call AI during gameplay or answer scoring.
11. deduplicate uploads by SHA-256 within the builder capability while preventing cross-user existence disclosure;
12. resize/normalize images once, cap audio at 60 seconds, and do not transcribe media that fails deterministic quality/moderation checks;
13. pass an image/transcript only to the candidate strategy that uses it, not every generation call;
14. serve bytes directly from private R2 through authorized streaming/range responses and keep them out of DO/WebSocket payloads;
15. track storage-days, operations, delivered bytes, vision input, and transcription minutes as separate budget dimensions.

The result keeps YouVersion as the Scripture authority, AI as a bounded authoring assistant, and the existing builder/game engine as the product.
