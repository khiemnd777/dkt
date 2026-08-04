# Cloudflare Free-tier budget

Checked against Cloudflare documentation on **2026-08-01**. Every capacity number below is an estimate, not a promise of exact billing or availability.

## Services used

- One Cloudflare Worker at the default `workers.dev` address.
- Workers Static Assets for the React PWA shell.
- One SQLite-backed Durable Object namespace (`GAME_ROOMS`), with one object per six-character room code.
- Durable Object WebSocket Hibernation and Alarms.
- Optional Cloudflare Turnstile Free for `POST /api/rooms`.

The application intentionally does **not** use D1, KV, R2, Queues, Workflows, Cron, Hyperdrive, Containers, Workers AI, paid Durable Object features, external databases, hosted realtime services, analytics, or paid monitoring.

## Current documented limits

Cloudflare currently documents the following Workers Free values:

- Worker requests: 100,000/day, resetting at 00:00 UTC; 10 ms CPU per Worker invocation; 128 MB memory; 3 MB compressed Worker size.
- Workers Static Assets requests: free and unlimited; 20,000 asset files per Worker version and 25 MiB per individual asset.
- Durable Objects Free compute: 100,000 billable requests/day and 13,000 GB-s/day. Incoming WebSocket messages use a 20:1 ratio for compute request billing. Outgoing messages and protocol pings are not billed as requests.
- SQLite Durable Object storage: 5 million rows read/day, 100,000 rows written/day, and 5 GB stored across the account. Each object remains additionally constrained by the platform's per-object storage limit.
- Turnstile Free: up to 20 widgets, with unlimited challenges/verification requests as currently documented.

Sources: [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [Static Assets billing](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/), [Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/), [Durable Objects limits](https://developers.cloudflare.com/durable-objects/platform/limits/), and [Turnstile plans](https://developers.cloudflare.com/turnstile/plans/).

Limits and pricing can change. Re-check the linked primary documentation before a high-traffic event.

## Why this design preserves quota

`assets.run_worker_first` contains only `/api/*`, while SPA fallback is handled by Static Assets. Opening `/`, `/create`, `/join/*`, `/play/*`, `/host/*`, `/screen/*`, or `/privacy` therefore does not invoke application Worker code.

Each browser role opens one WebSocket after initial HTTP setup. The server sends `openedAt` and `deadlineAt` once; browsers draw their own countdown. There are no HTTP polling loops and no one-second server timer broadcasts. Hibernatable sockets let the room object sleep while idle. Automatic ping/pong does not wake application code.

The room uses a small fixed-key storage layout. An answer write replaces only the compact current-submissions map and never stores raw short-answer text. Player totals are aggregated at lock, historical submissions are discarded before the next round, and outgoing event sequence numbers are reserved in 256-number leases rather than written for every outgoing message. Cleanup always calls `ctx.storage.deleteAll()`.

## Estimated daily scenarios

Assumptions: one host and one screen per room; one accepted answer per player/round; roughly four host commands per round; one client snapshot request per player/round as a conservative reconnect/gap allowance; two alarms per round plus warning/deletion; one public lookup and join per player; one ticket and WebSocket connection per role. Reconnects, retries, malformed traffic, early locks, and Cloudflare implementation details change real usage.

| Scenario | WebSocket connections | Incoming WS messages | Approx. DO billable request units | Approx. storage row writes | Alarm invocations |
| --- | ---: | ---: | ---: | ---: | ---: |
| A — 10 players × 10 rounds × 20 rooms/day | 240 | ~4,800 | ~1,600 | ~4,300 | ~440 |
| B — 30 players × 15 rounds × 100 rooms/day | 3,200 | ~96,000 | ~20,500 | ~67,000 | ~3,200 |
| C — 100 players × 30 rounds × 10 rooms/day | 1,020 | ~61,200 | ~7,800 | ~36,000 | ~620 |

These are estimates, not exact billing calculations. Scenario B approaches the daily row-write allowance once reconnects, retries, joins, cleanup deletes, and sequence leases are included; it has materially less safety margin than the recommended operating profile. Compute duration also depends on actual handler execution time and cannot be inferred from message counts alone.

## Recommended operating profile

- 10–50 players
- 10–30 runtime rounds
- one host and one presentation screen
- 15–90 minutes per active room
- modest daily room creation, watched in the Cloudflare dashboard

Hard application limits remain 100 players, 50 top-level items, 100 compiled rounds, a 512 KiB create payload, and a six-hour absolute lifetime. Those are safety ceilings, not a guarantee that many large simultaneous rooms remain within Free quotas.

## When a limit is exceeded

Static pages should remain available because they do not invoke the Worker. Dynamic room creation, joining, ticket issuance, storage, alarms, or realtime operations may return 429/5xx or temporarily fail. The UI safely handles non-JSON platform errors and presents a Vietnamese overload message.

> The application is designed to operate within Cloudflare Free plan quotas. When those quotas are exceeded, realtime room operations may temporarily fail until the quota resets or the account is upgraded.

## Monitoring and a later upgrade

In the Cloudflare dashboard, inspect Workers & Pages request/CPU metrics and Durable Objects request, duration, row-read, row-write, and stored-data metrics. Compare UTC-day usage with the estimates above before large events.

If upgrading later, the HTTP routes, one-time ticket flow, WebSocket protocol, schemas, and room lifecycle do not need to change. A Paid plan raises platform allowances; it does not require introducing a permanent database or changing the ephemeral product model.
