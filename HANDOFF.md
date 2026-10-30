# Handing this to a developer

**This is not an HTML prototype.** The original SpotterModel prototype was a
single 5,053-line `index.html`; this is a **React 18 + Vite** app, because the
Radiant 3.0 design system is a React component library and a single HTML file
cannot use it.

## What to send

Send the **project folder**, minus `node_modules` and `dist` (both are
regenerated). That is ~1.4MB.

```bash
cd /Users/suraj.boro/Desktop/table-rearrangement
zip -r data-model-editor.zip . -x 'node_modules/*' -x 'dist/*' -x '.DS_Store'
```

To run it:

```bash
npm install
npm run dev        # http://localhost:5178
```

## If they only want to look at it

`npm run build` produces a self-contained `dist/`. Asset paths are relative, so
it works from any folder on a static host.

It does **not** open by double-clicking `dist/index.html` — the bundle is an ES
module, which browsers refuse to load over `file://`. It needs to be served:

```bash
npm run build && npx serve dist
```

## What is actually ours

| | |
|---|---|
| `src/*.js`, `src/*.jsx`, `src/app.css`, `src/components/` | ~2,600 lines — the editor |
| `src/radiant/` | 281 files, vendored Radiant 3.0 — **not ours** |
| `public/assets/` | SVGs and the avatar, lifted from the prototype |

**The Radiant copy is vendored.** If the product already depends on Radiant,
delete `src/radiant/` and repoint the imports — every import is of the form
`from './radiant/components'` or `'../radiant/components'`. One file in it is
Vite-specific: `components/Icon/Icon.tsx` loads the SVGs with
`import.meta.glob`, and on another bundler that one block needs replacing (the
library's own README gives the alternative).

Two additions were made to the vendored library, both documented in the
project README: the icon `model-solid.svg`, and nothing else — all other icons
are stock.

## Worth reading first

`README.md` covers the arrangement algorithms, how the custom layout is
remembered, the connector router, the zoom rules, and the measurements behind
the open question about whether the hover preview is worth keeping at scale.

## Not production code

It is a prototype: no tests, no error states, no data layer, and the model is a
hard-coded fixture in `src/data.js`. The parts most worth keeping are
`src/layouts.js` (the three arrangement algorithms) and `src/joins.js` (the
orthogonal connector router) — both are self-contained and framework-agnostic
apart from their imports.
