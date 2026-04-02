# Marble roll

**3D** marble platformer (Three.js + cannon-es). The Canvas **2D** side-runner prototype lives on git branch **`preserve/2d-side-runner`**.

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
