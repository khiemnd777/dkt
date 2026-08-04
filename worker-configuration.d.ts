declare namespace Cloudflare {
  interface Env {
    GAME_ROOMS: DurableObjectNamespace;
    ASSETS: Fetcher;
    APP_ENV: string;
    TURNSTILE_EXPECTED_ACTION: string;
    TURNSTILE_SECRET_KEY?: string;
    INDEXNOW_KEY?: string;
  }
}
