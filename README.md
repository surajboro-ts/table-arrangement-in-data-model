# Data model editor — Radiant build

The SpotterModel data model editor page, rebuilt on the **Radiant 3.0** component
library. Source prototype: `spottermodel-26.6-prototype-edit` (a single 5,053-line
`index.html`). The SpotterModel agent panel is intentionally out of scope.

```bash
npm install
npm run dev     # http://localhost:5178
```

## What it is

| | Prototype | This build |
|---|---|---|
| Structure | one 210KB `index.html` | React + Vite, 5 components |
| Colour | 53 hardcoded hex values | 0 — every colour is a `--rd-sys-*` token |
| Type | 11 ad-hoc `px` sizes | 0 — every string carries a `rd-*` class |
| Radius | 12 values, 6 off-scale | 0 — all `--rd-sys-radius-*` |
| Theming | light only | light + dark, free from the tokens |
| a11y | no `aria-*`, no `role`, 15 click-divs | 7 roles, 5 `aria-*` kinds, 20 real buttons |

Dark mode is live — `document.documentElement.dataset.theme = 'dark'`.

## Prototype → Radiant

| Prototype | Radiant |
|---|---|
| `.tab-group` / `.tab-pill` | `SegmentedControl` |
| `.outline-btn`, `.save-btn`, `.exit-btn`, `.filter-pill-btn` | `Button` |
| `.select-btn`, `.sort-btn` | `Select` / `Button` |
| `.search-bar`, `.col-table-search`, `.formula-search` | `SearchBar` |
| `.toggle` | `Toggle` |
| `.col-grid`, `.formula-grid` | `ObjectTable` |
| `.fg-menu-dropdown` | `Menu` + `MenuItem` |
| `.grid-icon-btn`, `.fg-more-btn`, `.mvp-card-menu` | `IconButton` |
| `showToast()` | `Toast` |
| inline SVG + `assets/*.svg` glyphs | `Icon` (189-glyph set) |
| `.empty-divider` | `Divider` tokens |

## The model

The editor boots with **Enterprise Retail Analytics** — 23 tables and 30 joins,
a fact constellation with snowflaked dimensions, out of 28 tables in the
connection. The other five are there to drag in. The left pane shows tables
already in the model on the darker gray surface token and not draggable;
the five available ones carry the raised surface and stand out.

It does not fit the canvas unscaled, which is the case the arrangements and the
hover preview have to hold up under.

### Zoom

The control lists **50% / 75% / 100%** only. Any other level — a fit, or
something reached by pinching — shows in the field itself rather than
cluttering the list.

- **Gestures.** Trackpad pinch (which arrives as ctrl + wheel) and ctrl/cmd +
  wheel both zoom, anchored on the point under the cursor so it stays put.
  Range 10%–200%. A plain wheel still pans.
- **Arrangements auto-fit.** Previewing or applying an arrangement scales the
  canvas so every table is in view, whatever zoom you were at. Un-hovering a
  preview returns you to the level you had.
- **Dragging never rezooms.** Moving or dropping a card changes the extent,
  which under a live fit would rescale the canvas mid-gesture. The level is
  pinned instead.
- **Transitions.** Zoom changes from a preview or a selection are eased over
  220ms; a pinch or a drag stays immediate, and `prefers-reduced-motion` turns
  both off.

## Table arrangement

A layout switcher sits in the sub-header between **Find** and **Join options**.
Its glyph reflects the active arrangement.

| Arrangement | Icon | Algorithm |
|---|---|---|
| **Custom layout** | `model-solid` † | Wrapped grid, columns derived from the canvas width. Every card is draggable. |
| **Force-directed** | `schema` | Fruchterman-Reingold spring embedding — joined tables attract, all tables repel. A star schema settles with the fact table at the hub and its dimensions radiating out. Deterministically seeded, then scaled to the canvas and relaxed so no two cards overlap. |
| **Layered** | `show-underlying-data` | Sugiyama-style ranking. Facts take rank 0, their direct dimensions rank 1, snowflaked dimensions rank 2, with barycentre passes to reduce edge crossings — the conventional top-down reading of a star or snowflake schema. A rank too wide for the canvas wraps onto further rows; the per-row cap is whichever lets the whole layout render largest. |

† Placeholder — Radiant's data-model glyph, reused by request until a dedicated
custom-layout icon exists. All three icons are stock Radiant; nothing was added
to the icon set.

Centrality is measured by join degree, with the `fact_`/`dim_` naming convention
as a tie-break only, so the algorithms work on models that don't follow it.

### Measured: does the hover preview thrash?

Canvas 755×568, zoom on **Fit**, grid applied. The figures are the fit-scale
while hovering each menu option:

| State | Extent | Fit scale |
|---|---|---|
| Applied — Custom grid | 1368 × 872 | **0.55** |
| Hovering Force-directed | 1512 × 1162 | **0.49** |
| Hovering Layered | 1368 × 1520 | **0.37** |
| Pointer leaves the menu | 1368 × 872 | back to **0.55** |

Sweeping the pointer down three options rescales the canvas three times.
Starting zoomed in makes it worse, since the preview always refits.

**Rank wrapping cut the worst case substantially.** Layered used to run its
widest rank in one row, which on this model meant a 2768px band:

| Layered, same canvas | Extent | Fit scale |
|---|---|---|
| Single-row ranks | 2768 × 1168 | 0.27 |
| Wrapped ranks | 1368 × 1520 | **0.37** |

Cards render 37% larger and the swing across the menu narrows from 2.0×
(0.27–0.55) to 1.5× (0.37–0.55). So part of the original thrash was the
layout's fault rather than the preview's — but a 1.5× swing is still a visible
rescale, so whether preview earns its keep at this size is still open.

One option neither side of the thread raised: **the preview could hold the
current zoom** instead of refitting, showing the new arrangement at the
existing scale and letting it overflow. The canvas would stay completely
still; you would lose "see the whole thing". That is a one-line change in
`TablesCanvas`.

### Adding a table from the left pane

The connection holds 28 tables; 23 are in the model, so five are left to drag
onto the canvas. Dropping one **places it where it was dropped** and switches
the arrangement to Custom, for the same reason dragging an existing card does:

- A preset owns every position, so it would immediately move the new table away
  from where it was put — the drop would appear not to work.
- Re-running the algorithm would also reshuffle all the *other* cards, so one
  addition would rearrange the whole canvas out from under the person.

Measured: dropping a table while in Layered flips the control to Custom, lands
the card at the drop point, and moves **none** of the 23 existing cards. The
zoom is pinned at the same moment, so the canvas cannot rescale out from under
the drop.

### How Custom is remembered

There is exactly **one** remembered custom layout, and it is always the most
recent manual arrangement:

- Dragging a card — **in any arrangement** — switches the dropdown to Custom.
  The canvas keeps the positions as they stood, with just that card moved; it
  does *not* jump back to a previously remembered custom layout.
- That result **becomes** the remembered custom layout, overwriting the old one.
- Picking an arrangement from the menu re-runs it from scratch. Picking
  **Custom layout** restores whatever is currently remembered.
- Tables added since take a grid slot; the rest hold their remembered positions.

### Menu behaviour

- **Selected option** shows its label *and* its leading glyph in brand blue.
- **Hover preview** — hovering an option lays that arrangement out and draws it
  over the canvas as dashed ghosts at 80% opacity, so you can see where the
  tables would land before committing. Dragging is suppressed while previewing.
- **Tooltips** — resting on an option for two seconds explains what the
  arrangement does. Radiant's `Tooltip` has a native `delay`, so no custom
  timer. Placed to the left rather than above, so it doesn't cover the other
  options.
- **Restore** — when a custom layout is remembered but not currently applied,
  the Custom row grows a `reset` affordance that returns you to it, tooltipped
  "Restore previous custom layout" with no dwell: you only point at an
  unlabelled glyph when you already want to know what it does.

### Connector routing

Connectors are re-routed from the live card positions and keep clear of the
other cards. Candidates are tried cheapest-first — a straight rule between
facing edges, the two orthogonal elbows, Z-routes through the gap, U-shaped
detours along a free lane — and the first that is clean wins.

When all of those are blocked, which happens readily once a layout is dense,
an **A\* orthogonal pathfinder** takes over. It builds a lattice from the
cards' own edges inset by 24px, then searches it with a turn penalty so the
route comes out with as few bends as the obstacles allow. It is only reached
after the simple shapes fail, so the common case stays cheap.

Routes are scored on two things: crossing a card is disqualifying, and grazing
one is merely penalised — a 1px line hard against a 1px border reads as part of
it. The badge rides the longest segment.

Every card counts as an obstacle, **including the two being joined**. Without
that, a route was free to run up the inside of its own target and double back
to enter it from the edge — and the check that was supposed to catch it skipped
those two cards, so it scored clean. Terminating on an edge is still allowed,
because the hit test requires a strict interior crossing.

Audited across all seven states (grid / force / layered, applied and previewed)
on the 23-table model: **zero connector segments pass through a card.**
`scripts/route-audit.mjs` reruns that check outside the browser:

```bash
node scripts/route-audit.mjs            # the current force layout
node scripts/route-audit.mjs pos.json   # a layout dumped from the browser
```

## Kept bespoke

Radiant has no equivalent, so these stay as the prototype drew them — rebuilt on
Radiant tokens and type classes, but structurally unchanged:

- **`.dme-table-card`** — the model-canvas table card.
- **Join rendering** (`src/joins.js`) — `orderTablesForDisplay` (permutation search
  that maximises adjacent joins) and `computeJoinGeometry` (straight rules for
  adjacent cards, staggered arches otherwise). Ported unchanged; this is domain
  logic, not UI.
- **`.dme-canvas`** — the scrolling canvas and its absolute card positioning.
- **`icons/svg/layered.svg`** — Radiant has no layers glyph, so one was added to
  the icon set, which is how its own README says to extend it. The other two
  arrangements use stock Radiant icons.
- **`EmptyState`** — the icon + title + description + suggestion-link composition.
- **Join badge** — still `assets/Join UI.svg`, as in the prototype.

## Left pane dimensions

Checked against the prototype. Matched exactly where the value is structural or
happens to land on Radiant's scale; snapped to the nearest token where the
prototype is off it.

| Element | Prototype | Here |
|---|---|---|
| Pane width | 260px | 260px |
| Chip height / padding / radius | 28 · 4 8 4 4 · 4 | same |
| Chip gap (grip → label) | 8px | `spacing-b` (8) |
| Tree chevron box | 18 × 18 | 18 × 18 |
| Tree column indent | 20px | `spacing-e` (20) |
| Header / list / footer inset | 14px | `spacing-d` (16) |
| List gap | 10px | `spacing-c` (12) |
| Connection + filter row gaps | 6px | `spacing-a` (4) |
| Grid icon button | 26 square, radius 5 | Radiant `IconButton` (24, circular) |

Two foundational bugs came out of that comparison, both worth knowing about:

- **`box-sizing` was missing.** Radiant's `reset.css` deliberately covers only
  overscroll and scrollbars, so `border-box` is not inherited from it and the
  prototype's own global rule had been dropped in the port. Anything with both
  a height and padding rendered that much too tall — buttons happened to be
  fine, since the UA defaults them to `border-box`, so it only showed on the
  `<span>` chips in the column tree.
- **Chips were being squashed.** The lists are flex columns, so the main axis
  is vertical and `flex-shrink` applies to height: once the table list grew
  past the pane, every chip collapsed from 28px to 8px. This is exactly the
  gotcha Radiant's README documents for `Divider`. They now carry
  `flex-shrink: 0`.

## Known deviations

- **Font.** Radiant specifies Geist; the prototype used Plain. This build follows
  Radiant. Plain's four font files are no longer referenced — swap
  `--rd-sys-font-family` if Plain is still the house face.
- **`gap: 80px`** on the canvas is the single off-scale value in `app.css`
  (Radiant tops out at 64px). Kept for canvas fidelity, and commented in place.
- **Filters / Parameters / Settings** were never built in the prototype; they
  render a placeholder empty state.
- **Drag and drop** works as before; chips are now also keyboard-operable
  (focus + Enter) and double-clickable.
- **Card dragging is pointer-only.** Moving a card on the canvas has no keyboard
  equivalent yet — the arrangement presets are the accessible path.
