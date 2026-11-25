# Unify responsive device behavior

## Goal
Keep every device on the current shared site content and functionality while allowing responsive layout changes.

## Evidence and scope
- Public pages use the same HTML and JavaScript across viewport widths; no viewport-dependent JavaScript branches were found.
- CSS media queries mostly adjust grids, spacing, and sizing. Existing hidden states are largely dialog, tab, or conditional form states rather than mobile-only content removal.
- Public static CSS/JS assets currently receive a seven-day HTTP cache lifetime, and the service worker refreshes its cache using the browser's default HTTP cache behavior. That can let devices retain different releases.

## Steps
1. Add regression coverage for static executable-asset cache headers and service-worker refresh requests.
2. Make CSS/JS revalidate at the server and bypass the browser HTTP cache when the service worker refreshes assets; rotate its cache name to evict prior asset sets.
3. Run the full available test suite and inspect the final diff.
4. Validate responsive viewports and functional controls where a safe test environment permits; do not submit real orders or payment data.
5. Push to `main` only if tests pass, then verify Render is Live.

## Constraints
Preserve desktop behavior as source of truth; do not alter order, pricing, Nemer API, database, secrets, or Render configuration.

