/**
 * Canvas arrangement engines.
 *
 * Each engine takes the model's tables + joins and returns absolute positions
 * keyed by table name: { [name]: { x, y } }, in canvas pixels, top-left origin.
 *
 * The three arrangements map onto how data models are actually drawn:
 *   - grid     — no opinion about the schema; a plain wrapped grid you then
 *                rearrange by hand ("Custom layout").
 *   - force    — Fruchterman-Reingold spring embedding. Joined tables attract,
 *                all tables repel, so a star schema naturally settles with the
 *                fact table at the hub and its dimensions radiating out.
 *   - layered  — Sugiyama-style ranking. Facts occupy the top rank, their
 *                direct dimensions the next, snowflaked dimensions the next
 *                again, with a barycentre pass to reduce edge crossings. This
 *                is the conventional way to read a star/snowflake schema.
 */

export const CARD_W = 200
export const CARD_H = 120

const COL_GAP = 80
const ROW_GAP = 56
/** Extra separation between one rank of a layered layout and the next. */
const RANK_GAP = 24
const PAD = 24

/* ------------------------------------------------------------------ helpers */

/** Undirected adjacency list, name -> [name]. */
function adjacency(tables, joins) {
  const adj = {}
  tables.forEach((t) => { adj[t.name] = [] })
  joins.forEach((j) => {
    if (!adj[j.leftTable] || !adj[j.rightTable]) return
    if (!adj[j.leftTable].includes(j.rightTable)) adj[j.leftTable].push(j.rightTable)
    if (!adj[j.rightTable].includes(j.leftTable)) adj[j.rightTable].push(j.leftTable)
  })
  return adj
}

/** Shift a position map so its bounding box starts at PAD, PAD. */
function normalise(pos) {
  const names = Object.keys(pos)
  if (!names.length) return pos
  const minX = Math.min(...names.map((n) => pos[n].x))
  const minY = Math.min(...names.map((n) => pos[n].y))
  const out = {}
  names.forEach((n) => {
    out[n] = { x: Math.round(pos[n].x - minX + PAD), y: Math.round(pos[n].y - minY + PAD) }
  })
  return out
}

/**
 * Rank tables by how central they are to the schema. Degree dominates — in a
 * star schema the fact table is simply the most-joined table — with the
 * fact_/dim_ naming convention as a tie-break only.
 */
function centrality(name, adj) {
  const degree = adj[name]?.length ?? 0
  const looksLikeFact = /^f(act)?[_.]/i.test(name)
  return degree * 2 + (looksLikeFact ? 1 : 0)
}

/* --------------------------------------------------------------- grid layout */

/**
 * Wrapped grid, row-major. The column count is the one that fills the canvas
 * best — picking it from the width alone turns a 23-table model into a
 * two-wide ribbon that has to shrink to a quarter size to fit.
 */
export function gridLayout(tables, _joins, viewport = {}) {
  const n = tables.length
  if (!n) return {}
  const viewW = Math.max((viewport.width ?? 1024) - PAD * 2, CARD_W)
  const viewH = Math.max((viewport.height ?? 640) - PAD * 2, CARD_H)

  const spanW = (c) => c * CARD_W + (c - 1) * COL_GAP
  const spanH = (rows) => rows * CARD_H + (rows - 1) * ROW_GAP

  let cols = 1
  let bestScale = -1
  for (let c = 1; c <= n; c++) {
    const rows = Math.ceil(n / c)
    // How large the grid could render at — capped, since we never enlarge.
    const scale = Math.min(1, viewW / spanW(c), viewH / spanH(rows))
    if (scale > bestScale + 1e-6) { bestScale = scale; cols = c }
  }

  const pos = {}
  tables.forEach((t, i) => {
    pos[t.name] = {
      x: PAD + (i % cols) * (CARD_W + COL_GAP),
      y: PAD + Math.floor(i / cols) * (CARD_H + ROW_GAP),
    }
  })
  return pos
}

/* -------------------------------------------------------------- force layout */

/**
 * Fruchterman-Reingold. Seeded deterministically (no Math.random) so the same
 * model always settles the same way — a layout that jumped on every switch
 * would be unusable.
 */
export function forceLayout(tables, joins, viewport = {}) {
  const n = tables.length
  if (!n) return {}
  if (n === 1) return { [tables[0].name]: { x: PAD, y: PAD } }

  const width = viewport.width ?? 1024
  const height = viewport.height ?? 640
  const W = Math.max(width - CARD_W - PAD * 2, 400)
  const H = Math.max(height - CARD_H - PAD * 2, 300)

  const area = W * H
  const k = Math.sqrt(area / n) // ideal edge length
  const adj = adjacency(tables, joins)

  // Seed on a circle, ordered by centrality so the hub starts near the middle.
  const ordered = [...tables].sort((a, b) => centrality(b.name, adj) - centrality(a.name, adj))
  const nodes = ordered.map((t, i) => {
    const angle = (i / n) * Math.PI * 2
    const radius = i === 0 ? 0 : Math.min(W, H) / 3
    return { name: t.name, x: W / 2 + Math.cos(angle) * radius, y: H / 2 + Math.sin(angle) * radius }
  })
  const byName = Object.fromEntries(nodes.map((nd) => [nd.name, nd]))

  const edges = joins
    .filter((j) => byName[j.leftTable] && byName[j.rightTable])
    .map((j) => [byName[j.leftTable], byName[j.rightTable]])

  const ITER = 320
  let temp = Math.min(W, H) / 4

  for (let step = 0; step < ITER; step++) {
    nodes.forEach((v) => { v.dx = 0; v.dy = 0 })

    // Repulsion between every pair.
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = nodes[i]
        const b = nodes[j]
        let dx = a.x - b.x
        let dy = a.y - b.y
        let dist = Math.hypot(dx, dy)
        if (dist < 0.01) { dx = (i - j) * 0.1 + 0.05; dy = 0.05; dist = Math.hypot(dx, dy) }
        const force = (k * k) / dist
        const ux = dx / dist
        const uy = dy / dist
        a.dx += ux * force; a.dy += uy * force
        b.dx -= ux * force; b.dy -= uy * force
      }
    }

    // Attraction along joins.
    edges.forEach(([a, b]) => {
      let dx = a.x - b.x
      let dy = a.y - b.y
      const dist = Math.max(Math.hypot(dx, dy), 0.01)
      const force = (dist * dist) / k
      const ux = dx / dist
      const uy = dy / dist
      a.dx -= ux * force; a.dy -= uy * force
      b.dx += ux * force; b.dy += uy * force
    })

    // Displace, capped by the cooling temperature, and keep inside the frame.
    nodes.forEach((v) => {
      const disp = Math.max(Math.hypot(v.dx, v.dy), 0.01)
      v.x += (v.dx / disp) * Math.min(disp, temp)
      v.y += (v.dy / disp) * Math.min(disp, temp)
      v.x = Math.max(0, Math.min(W, v.x))
      v.y = Math.max(0, Math.min(H, v.y))
    })

    temp = Math.max(temp * 0.95, 0.5)
  }

  // The simulation treats nodes as points, so scale the result to the canvas
  // and then push apart any cards that actually overlap as rectangles.
  const centres = nodes.map((v) => ({ name: v.name, x: v.x, y: v.y }))
  fitToViewport(centres, W, H)
  relaxOverlaps(centres)

  const pos = {}
  centres.forEach((c) => { pos[c.name] = { x: c.x - CARD_W / 2, y: c.y - CARD_H / 2 } })
  return normalise(pos)
}

/** Scale a set of centres so their bounding box fills the available area. */
function fitToViewport(centres, W, H) {
  if (centres.length < 2) return
  const xs = centres.map((c) => c.x)
  const ys = centres.map((c) => c.y)
  const bw = Math.max(...xs) - Math.min(...xs)
  const bh = Math.max(...ys) - Math.min(...ys)
  // Fill most of the frame, but leave a margin so no card sits flush to an edge.
  const FILL = 0.9
  const sx = bw > 1 ? (W * FILL) / bw : 1
  const sy = bh > 1 ? (H * FILL) / bh : 1
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2
  const cy = (Math.max(...ys) + Math.min(...ys)) / 2
  centres.forEach((c) => {
    c.x = cx + (c.x - cx) * sx
    c.y = cy + (c.y - cy) * sy
  })
}

/**
 * Separate overlapping cards. Treats each as a rectangle with a margin and
 * pushes colliding pairs apart along their shorter axis of overlap, which
 * keeps the graph's shape while guaranteeing readable gaps.
 */
function relaxOverlaps(centres, iterations = 240) {
  // 48px matches the connector runs in the Figma force-directed frame; the
  // vertical margin is tighter because the cards are short.
  const marginX = 48
  const marginY = 40
  const minX = CARD_W + marginX
  const minY = CARD_H + marginY

  for (let step = 0; step < iterations; step++) {
    let moved = false
    for (let i = 0; i < centres.length; i++) {
      for (let j = i + 1; j < centres.length; j++) {
        const a = centres[i]
        const b = centres[j]
        const dx = b.x - a.x
        const dy = b.y - a.y
        const overlapX = minX - Math.abs(dx)
        const overlapY = minY - Math.abs(dy)
        if (overlapX <= 0 || overlapY <= 0) continue

        moved = true
        // Resolve along whichever axis needs the smaller correction.
        if (overlapX / minX < overlapY / minY) {
          const push = (overlapX / 2 + 0.5) * (dx >= 0 ? 1 : -1)
          a.x -= push; b.x += push
        } else {
          const push = (overlapY / 2 + 0.5) * (dy >= 0 ? 1 : -1)
          a.y -= push; b.y += push
        }
      }
    }
    if (!moved) break
  }
}

/* ------------------------------------------------------------ layered layout */

/**
 * Rank by distance from the schema's fact tables, then order each rank by the
 * barycentre of its neighbours in the rank above (the standard crossing-
 * reduction heuristic). Reads as a star schema top-down, and a snowflake as
 * successive rings.
 */
export function layeredLayout(tables, joins, viewport = {}) {
  if (!tables.length) return {}
  const width = viewport.width ?? 1024
  const adj = adjacency(tables, joins)

  // Rank 0 = the most central table of each connected component.
  const rank = {}
  const remaining = new Set(tables.map((t) => t.name))

  while (remaining.size) {
    const root = [...remaining].sort((a, b) => centrality(b, adj) - centrality(a, adj) || a.localeCompare(b))[0]
    const queue = [root]
    rank[root] = 0
    remaining.delete(root)
    while (queue.length) {
      const cur = queue.shift()
      ;(adj[cur] ?? []).forEach((nb) => {
        if (!remaining.has(nb)) return
        rank[nb] = rank[cur] + 1
        remaining.delete(nb)
        queue.push(nb)
      })
    }
  }

  // Group into ranks.
  const ranks = []
  Object.keys(rank).forEach((name) => {
    const r = rank[name]
    ;(ranks[r] ||= []).push(name)
  })
  ranks.forEach((r) => r.sort((a, b) => a.localeCompare(b)))

  // Barycentre passes: order each rank by the mean index of its parents above.
  for (let pass = 0; pass < 4; pass++) {
    for (let r = 1; r < ranks.length; r++) {
      const above = ranks[r - 1]
      const indexOf = Object.fromEntries(above.map((nm, i) => [nm, i]))
      ranks[r] = [...ranks[r]].sort((a, b) => {
        const bary = (nm) => {
          const parents = (adj[nm] ?? []).filter((p) => p in indexOf)
          if (!parents.length) return Number.MAX_SAFE_INTEGER
          return parents.reduce((s, p) => s + indexOf[p], 0) / parents.length
        }
        return bary(a) - bary(b) || a.localeCompare(b)
      })
    }
  }

  // Lay the ranks out. A rank wider than the canvas wraps onto further rows
  // rather than running off the side — a fact table with eight dimensions
  // would otherwise produce a band several times the width of the viewport,
  // which then has to shrink to a quarter size to fit.
  const viewW = Math.max(width - PAD * 2, CARD_W)
  const viewH = Math.max((viewport.height ?? 640) - PAD * 2, CARD_H)
  const spanW = (c) => c * CARD_W + (c - 1) * COL_GAP

  /** Rows, width and height the whole layout takes at a given per-row cap. */
  const measure = (cap) => {
    let rows = 0
    let widest = 1
    ranks.forEach((names) => {
      rows += Math.ceil(names.length / cap)
      widest = Math.max(widest, Math.min(cap, names.length))
    })
    return {
      w: spanW(widest),
      h: rows * CARD_H + (rows - 1) * ROW_GAP + (ranks.length - 1) * RANK_GAP,
    }
  }

  // Pick the cap that lets the whole thing render largest.
  const widestRank = Math.max(...ranks.map((r) => r.length), 1)
  let cap = widestRank
  let bestScale = -1
  for (let c = 1; c <= widestRank; c++) {
    const { w, h } = measure(c)
    const scale = Math.min(1, viewW / w, viewH / h)
    if (scale > bestScale + 1e-6) { bestScale = scale; cap = c }
  }

  const canvasWidth = Math.max(viewW, measure(cap).w)
  const pos = {}
  let y = PAD

  ranks.forEach((names) => {
    for (let i = 0; i < names.length; i += cap) {
      const row = names.slice(i, i + cap)
      const rowWidth = spanW(row.length)
      const startX = PAD + (canvasWidth - rowWidth) / 2
      row.forEach((name, j) => {
        pos[name] = { x: startX + j * (CARD_W + COL_GAP), y }
      })
      y += CARD_H + ROW_GAP
    }
    // Extra breathing room between one rank and the next.
    y += RANK_GAP
  })

  return pos
}

/* ------------------------------------------------------------------ registry */

export const ARRANGEMENTS = [
  {
    id: 'custom',
    label: 'Custom layout',
    // Placeholder: this is Radiant's data-model glyph, reused here by request
    // until a dedicated custom-layout icon exists.
    icon: 'model-solid',
    run: gridLayout,
    description:
      'Your own arrangement. Drag any table to place it — the layout is remembered until you move something again.',
  },
  {
    id: 'force',
    label: 'Force-directed',
    icon: 'schema',
    run: forceLayout,
    description:
      'Positions tables based on their relationships. Tables with more foreign keys between them pull closer together, so related groups cluster naturally.',
  },
  {
    id: 'layered',
    label: 'Layered',
    icon: 'show-underlying-data',
    run: layeredLayout,
    description:
      'Ranks tables by how they join. Fact tables sit on the top layer with their dimensions below, so a star schema reads top-down.',
  },
]

export function runArrangement(id, tables, joins, viewport) {
  const entry = ARRANGEMENTS.find((a) => a.id === id) ?? ARRANGEMENTS[0]
  return entry.run(tables, joins, viewport)
}
