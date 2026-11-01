# Favourite Actors

Personal catalogue of favourite actors, plotted as a star chart — a static site, plain HTML/CSS/JS — no dependencies.

## What it is

- Actors, each shown as a glowing "star" (portrait or initials sigil) scattered across a spiral star chart.<br>
- Tap/click a star to open a card with the actor's portrait, links out to IMDb / TMDb / Wikipedia / Grokipedia, and the shows/films of theirs that make them a favourite.<br>
- Hovering or focusing a star reveals their name in a floating label.<br>
- A twinkling canvas starfield drifts behind everything, and each star gently drifts in place — both respect `prefers-reduced-motion`.

## Stack

Plain HTML/CSS/JS — no dependencies, no package.json, no build tooling.

- `index.html` — page shell only; the star chart is rendered into an empty `#stage` container at runtime
- `actors.json` — the actor entries (name, initials, photo, imdb/tmdb/wiki/grokipedia links, and a `favs` list of titles + URLs) — edit this to add/change an actor, not the HTML
- `styles.css` — layout, cosmic theming, the starfield/drift animation, the card overlay
- `script.js` — draws the canvas starfield, lays out the spiral, renders each star, and drives the actor card overlay
- `images/` — portraits + link icons (`imdb.png`, `tmdb.png`, `wikipedia.png`, `grokipedia.png`, plus `icon.png` favicon)
- `fonts/` — GarudaFight (headings, initials sigils), used via `@font-face`

## Design (styles.css)

- Deep void/nebula palette (`--void`, `--deep`, `--nebula`, `--glow`, `--lilac`, `--starlight`) with a gold accent, evoking a night sky lit from within — portraits get a soft purple glow, hovered stars get a gold ring.
- **GarudaFight** for the title, and for the initials shown on actors without a photo (a "sigil" — a radial-gradient orb with their initials).
- Each star (`.node-wrap`) drifts continuously via a randomised `@keyframes drift`, and separately scales in on load, staggered per star.
- A hovered/focused star's name label sits above every neighbouring star: `.node-wrap:hover`/`:focus-within` gets `z-index: 9999`, needed because the drift animation's `transform` gives each star its own local stacking context, so the label would otherwise still lose to nearby stars purely by DOM order.
- The actor card overlay scales in from the exact star that was clicked (`transform-origin` set from the click position via `--ox`/`--oy` custom properties), with a blurred backdrop behind it.
- Collapses gracefully on small screens (`@media max-width: 480px`) and honours `prefers-reduced-motion` throughout.

## Behaviour (script.js)

- **Starfield background**: a `<canvas>` of twinkling stars, resized to the viewport, animated via `requestAnimationFrame` — skipped (static) under `prefers-reduced-motion`.
- **Spiral layout**: stars are placed with a golden-angle (Fermat/sunflower) spiral — each actor's position uses `angle = i * 137.50776°` and `radius = R0 + C * sqrt(i)`, so stars fill the chart from the centre outward with no manual coordinates. Star size shrinks slightly with distance from centre.
- **Constellation arcs**: a single SVG path traces a line through every star's position, drawn once behind the stars.
- **Data-driven rendering**: stars are built entirely from `actors.json` — no actor is hand-written in `index.html`.
- **Photo vs. sigil**: an actor with a `photo` gets a circular portrait; one without gets a glowing initials sigil instead.
- **Card overlay** (`openCard`): populates the portrait, name, a row of IMDb/TMDb/Wikipedia/Grokipedia icon links (falling back to a plain "G" mark if no Grokipedia icon asset exists), and a `Favourites` list — the shows/films of theirs that qualify them.
- **Staggered entrance**: each star fades/scales in with a small delay proportional to its index, capped at 480ms, so the chart doesn't pop in all at once.
- **Accessibility**: stars are real `<button>`s with `aria-label`s, the card overlay is a `role="dialog"` with focus moved to its close button on open and `Escape` wired to close it.

## Adding an actor

Add an entry to `actors.json` (with a portrait in `images/`, or omit `photo` to fall back to an initials sigil) — no HTML editing needed. Give them an `imdb`/`tmdb`/`wiki`/`grokipedia` link and a `favs` list of `{ t, u }` (title + URL) for the shows/films that make them a favourite. The "N actors · N favourites" stat in `index.html`'s medallion is a hand-set string, not computed — update it manually when the counts change.

## Admin (internal)

`admin.html` is a password-gated form for adding/editing an actor's entry, backed by Cloudflare Pages Functions in `functions/`. Fill every field manually; for the photo, click "Search images" (Brave Search), click a thumbnail to open it full-size, then "Crop & use this image" to pan/zoom it into a square crop (exported client-side via `<canvas>`, proxied same-origin through `functions/api/image-proxy.js` so cross-origin images don't taint the canvas). Saving sends the cropped JPEG straight to the backend — no server-side fetch of the original URL — deriving its filename key from the actor's name (strip all non-alphanumeric characters, e.g. "Catherine Zeta-Jones" → `CatherineZetaJones`), and commits `actors.json`, the `ASSETS` entry in `script.js`, and the new image file to `main` in one commit via the GitHub API. Not linked from the public site; disallowed in `robots.txt`.

Requires these Cloudflare Pages environment variables (set as **Secrets** in the dashboard, not plaintext):

- `AUTH` — the login password (also used to sign the session cookie)
- `BRAVE_API_KEY` — from the [Brave Search API](https://api.search.brave.com/)
- `GITHUB_TOKEN` — a PAT (fine-grained, scoped to this repo, Contents: Read & write)

`functions/api/save-actor.js` hardcodes the repo as `megzjudge/favactors` on `main` — update those constants if the repo is renamed or moved.

## License

MIT — see [LICENSE](LICENSE).
