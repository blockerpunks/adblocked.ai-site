# AGENTS.md

Marketing site for **adblocked.ai**. The browser extension lives in a separate repo (`alchemydc/aegis`, `plugin/`).

## Overview

- Plain static site in `site/`: one `index.html`, `styles.css`, and small vanilla JS files. No build step, no dependencies, no package manager.
- `.github/workflows/deploy.yml` uploads `site/` to GitHub Pages on pushes to `main` that touch `site/**`. Only `site/` is published.
- Staging: https://blockerpunks.github.io/adblocked.ai-site/. Production (https://adblocked.ai) is still served from `alchemydc/aegis` until the domain is moved.
- Use relative asset paths so the site works both under the staging subpath and at the domain root.
- Local preview: `python3 -m http.server -d site 8000 --bind 127.0.0.1`

## Constraints

- No analytics, trackers, CDNs, or other external requests. The Inter font is bundled. This matches the extension's zero-telemetry promise.
- Keep `site/assets/fonts/Inter-OFL.txt` next to the font (SIL OFL requirement).
- The wordmark is exactly `[-] Adblocked AI`: ASCII `[`, `-`, `]` (`5B 2D 5D`), one space, same Inter font, size, and weight throughout. The favicons are derived from `[-]`.

## Behavior

- Install links are browser-specific (`data-install="chrome"` or `"firefox"`) and start disabled. Set `chromeWebStoreUrl` and/or `firefoxAddonsUrl` independently in `site/config.js` using verified marketplace listings. `configuredStoreUrl` checks HTTPS, official host, and listing path format; it does not verify ownership or existence. Unsupported or empty values leave only that browser disabled.
- Run regression checks with `node tests/offline-logic-tests.cjs` and `node tests/comparison-tests.cjs` (Node is needed only for checks, not for the website).
- Theme: light on first visit regardless of OS setting. The manual toggle is stored in localStorage key `adblocked-ai-theme`. `theme-init.js` loads synchronously in `<head>` to apply it before render and must stay there.
- `comparison.js` drives the before/after slider (pointer, touch, keyboard). Without JS a static 50/50 split shows. The screenshots in `site/assets/chatgpt-{before,after}.webp` were copied from the Astro site.
