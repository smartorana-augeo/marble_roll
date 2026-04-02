# Marble roll

**3D** marble platformer: **cannon-es** physics and a **Canvas 2D** world rasteriser (no external 3D engine). The older **2D** side-runner prototype lives on git branch **`preserve/2d-side-runner`**.

Static web game served over HTTP (ES modules and asset fetches require a server; opening `index.html` from the file system is not supported).

## Play online

A build is hosted on GitHub Pages:

**[https://carnationcrab.github.io/marble_roll/](https://carnationcrab.github.io/marble_roll/)**

## Run locally

From this directory (`marble_roll`), serve over HTTP (ES modules need it).

**Python** (if installed and on `PATH`):

```bash
python -m http.server 8765
```

On some systems the interpreter is `python3`, or on Windows the launcher is `py`:

```bash
python3 -m http.server 8765
py -m http.server 8765
```

**Node.js** (no Python required):

```bash
npx --yes serve -p 8765
```

Then open [http://localhost:8765/](http://localhost:8765/) in your browser.

To stop the server, press `Ctrl+C` in the terminal.

## Embedding (Encore / Grove / iframes)

The game can sit in an `<iframe>` on your site. It draws with **`canvas.getContext('2d')`**; the host page must allow canvas access (some privacy extensions block canvas reads).

**Query parameters**

| Parameter | Meaning |
|-----------|---------|
| `embed=1` | Enables embed behaviour (also auto-enabled when `window.self !== window.top`). Adds `body.embed` (hides dev controls and build line). |
| `session_uid=…` | Passed through on `postMessage` payloads (same idea as Drimify `session_uid`). |
| `autostart=1` | Skips the menu and starts a new run (useful inside a widget that should go straight to gameplay). |

**Example**

`https://your-host/marble_roll/?embed=1&session_uid=prog-user-123&autostart=1`

**`postMessage` to the parent** (`event.data.source === 'marble-roll'`)

- `type: 'ready'` — Shell loaded; menu is up unless `autostart=1`.
- `type: 'levelLoaded'` — Procgen and meshes finished for the current level; `levelIndex` is present.
- `type: 'firstInteraction'` — First gameplay input (keyboard or pointer on the canvas), for analytics parity with Drimify-style “first play”.
- `type: 'complete'` — Level goal reached. `data` mirrors DigitaService-style nesting: `data.credentials.sessionID`, `data.gameMetrics.userWon`, `data.gameMetrics.score` (run total), `data.gameMetrics.levelScore`, `data.gameMetrics.gameFinished` (true when the last level of a finite set is done).

The parent should verify `event.source` is the iframe’s `contentWindow` before acting on messages.

**Encore module wiring** — This repo is not inside the Encore tree. Host the static build over **HTTPS**, point an iframe `src` (or a small Grove module analogous to `DrimifyIframeSingleGame`) at the game URL, and optionally POST scores to your own endpoint using the `complete` payload instead of Drimify’s `SaveGamePlay` URL.
