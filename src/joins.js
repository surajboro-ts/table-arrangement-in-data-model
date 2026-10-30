/**
 * Join routing. Given absolute card positions, work out the connector path and
 * badge placement for each join.
 *
 * Routing follows the Figma: cards sharing a row get a straight horizontal
 * rule between their facing edges; cards in a column get a straight vertical
 * one; anything else gets an orthogonal elbow — a horizontal run out of the
 * outer card's side, then a vertical drop into the other card's top or bottom
 * edge. The badge rides the longer segment.
 */

import { CARD_W, CARD_H } from './layouts'

const centreOf = (p) => ({ x: p.x + CARD_W / 2, y: p.y + CARD_H / 2 })

/**
 * Order tables so joined pairs sit next to each other. Only meaningful for the
 * flow-based grid arrangement, where reading order is left-to-right.
 */
export function orderTablesForDisplay(tables, joins) {
  if (!tables.length) return []

  const connected = new Set()
  joins.forEach((j) => {
    if (j.leftTable && j.rightTable) {
      connected.add(`${j.leftTable}|${j.rightTable}`)
      connected.add(`${j.rightTable}|${j.leftTable}`)
    }
  })

  const scoreOrder = (order) => {
    let s = 0
    for (let i = 0; i < order.length - 1; i++) {
      if (connected.has(`${order[i].name}|${order[i + 1].name}`)) s++
    }
    return s
  }

  // Up to 7 tables: brute-force every permutation for the most adjacent joins.
  if (tables.length <= 7) {
    let best = tables
    let bestScore = scoreOrder(tables)
    const permute = (arr, cur) => {
      if (cur.length === arr.length) {
        const s = scoreOrder(cur)
        if (s > bestScore) { bestScore = s; best = [...cur] }
        return
      }
      for (let i = 0; i < arr.length; i++) {
        if (!cur.includes(arr[i])) permute(arr, [...cur, arr[i]])
      }
    }
    permute(tables, [])
    return best
  }

  // Larger sets: greedy walk from a leaf node.
  const adj = {}
  tables.forEach((t) => { adj[t.name] = [] })
  joins.forEach((j) => {
    if (adj[j.leftTable] && !adj[j.leftTable].includes(j.rightTable)) adj[j.leftTable].push(j.rightTable)
    if (adj[j.rightTable] && !adj[j.rightTable].includes(j.leftTable)) adj[j.rightTable].push(j.leftTable)
  })
  const degrees = Object.keys(adj).map((n) => ({ n, d: adj[n].length }))
  const endNode = degrees.find((x) => x.d === 1)
  let current = endNode ? endNode.n : tables[0].name
  const visited = new Set()
  const path = []
  while (current && !visited.has(current)) {
    visited.add(current)
    path.push(current)
    current = (adj[current] || []).find((n) => !visited.has(n))
  }
  tables.forEach((t) => { if (!visited.has(t.name)) path.push(t.name) })
  return path.map((name) => tables.find((t) => t.name === name)).filter(Boolean)
}

/** Badge is 32×14; this centres it on a point. */
const badgeAt = (x, y, label) => ({ x: Math.round(x - 16), y: Math.round(y - 7), label })

/** Card rectangle, inset slightly so connectors may touch an edge. */
const rectOf = (p) => ({ x1: p.x + 1, y1: p.y + 1, x2: p.x + CARD_W - 1, y2: p.y + CARD_H - 1 })

/** Does an axis-aligned segment cross this rectangle? */
function segmentHitsRect(ax, ay, bx, by, r) {
  if (ay === by) {
    if (ay <= r.y1 || ay >= r.y2) return false
    return Math.min(ax, bx) < r.x2 && Math.max(ax, bx) > r.x1
  }
  if (ax === bx) {
    if (ax <= r.x1 || ax >= r.x2) return false
    return Math.min(ay, by) < r.y2 && Math.max(ay, by) > r.y1
  }
  return false
}

/** How many other cards a polyline passes through. */
function collisions(points, obstacles, pad = 0) {
  let hits = 0
  for (let i = 0; i < points.length - 1; i++) {
    const [ax, ay] = points[i]
    const [bx, by] = points[i + 1]
    obstacles.forEach((r) => {
      const box = pad
        ? { x1: r.x1 - pad, y1: r.y1 - pad, x2: r.x2 + pad, y2: r.y2 + pad }
        : r
      if (segmentHitsRect(ax, ay, bx, by, box)) hits++
    })
  }
  return hits
}

/** Breathing room a connector should keep from a card it is not attached to. */
const CLEARANCE = 8

/**
 * Crossing a card is unacceptable; grazing its border merely looks wrong, since
 * a 1px line hard against a 1px border reads as part of it. Score both, with
 * crossings dominating, so a route that keeps its distance wins.
 */
function routeCost(points, obstacles) {
  const crossings = collisions(points, obstacles)
  if (crossings) return crossings * 1000
  return collisions(points, obstacles, CLEARANCE)
}

const toPath = (points) =>
  points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${Math.round(x)} ${Math.round(y)}`).join(' ')

/** Midpoint of the longest segment — where the badge reads most clearly. */
function badgeForPoints(points, label) {
  let best = null
  let bestLen = -1
  for (let i = 0; i < points.length - 1; i++) {
    const [ax, ay] = points[i]
    const [bx, by] = points[i + 1]
    const len = Math.abs(bx - ax) + Math.abs(by - ay)
    if (len > bestLen) { bestLen = len; best = [(ax + bx) / 2, (ay + by) / 2] }
  }
  return best ? badgeAt(best[0], best[1], label) : null
}

/**
 * Route one join between two positioned cards, avoiding the other cards.
 *
 * Candidates are tried in order of visual preference — a straight rule, then
 * the two orthogonal elbows, then an arch over the top — and the first one
 * that hits nothing wins. If they all hit something, the cleanest is used.
 */
/** Clearance kept between a connector and the card it is routing around. */
const DETOUR = 24
/** Cap on detour lanes tried per join, nearest first — keeps routing cheap. */
const MAX_LANES = 12

/**
 * Free lanes along one axis: the midpoints of the gaps between the cards'
 * occupied bands, plus a lane just clear of each end. Running down the middle
 * of a gap keeps a connector visibly off the cards, where hugging an edge at
 * a reduced zoom reads as overlapping it.
 */
function freeLanes(intervals) {
  if (!intervals.length) return []
  const sorted = [...intervals].sort((p, q) => p[0] - q[0])
  const merged = [sorted[0].slice()]
  for (const [lo, hi] of sorted.slice(1)) {
    const last = merged[merged.length - 1]
    if (lo <= last[1]) last[1] = Math.max(last[1], hi)
    else merged.push([lo, hi])
  }
  const lanes = [merged[0][0] - DETOUR, merged[merged.length - 1][1] + DETOUR]
  for (let i = 0; i < merged.length - 1; i++) {
    lanes.push((merged[i][1] + merged[i + 1][0]) / 2)
  }
  return lanes
}

/**
 * U-shaped detours: step out of A, travel along a clear lane past whatever is
 * in the way, then come back in to B.
 */
function detourCandidates(ar, br, ca, cb, obstacles) {
  const out = []
  const nearest = (vals, to) =>
    [...new Set(vals)].sort((p, q) => Math.abs(p - to) - Math.abs(q - to)).slice(0, MAX_LANES)

  // Horizontal lanes — for pairs that need to get past something sideways.
  const leaveRight = ca.x < cb.x
  const aSideX = leaveRight ? ar.x2 : ar.x1
  const bSideX = leaveRight ? br.x1 : br.x2
  const aOutX = leaveRight ? aSideX + DETOUR : aSideX - DETOUR
  const bOutX = leaveRight ? bSideX - DETOUR : bSideX + DETOUR
  const lanesY = nearest(
    freeLanes(obstacles.map((r) => [r.y1, r.y2])),
    (ca.y + cb.y) / 2,
  )
  for (const y of lanesY) {
    out.push([
      [aSideX, ca.y], [aOutX, ca.y], [aOutX, y], [bOutX, y], [bOutX, cb.y], [bSideX, cb.y],
    ])
  }

  // Vertical lanes — the same idea, for pairs stacked above one another.
  const below = ca.y < cb.y
  const aEdgeY = below ? ar.y2 : ar.y1
  const bEdgeY = below ? br.y1 : br.y2
  const aOutY = below ? aEdgeY + DETOUR : aEdgeY - DETOUR
  const bOutY = below ? bEdgeY - DETOUR : bEdgeY + DETOUR
  const lanesX = nearest(
    freeLanes(obstacles.map((r) => [r.x1, r.x2])),
    (ca.x + cb.x) / 2,
  )
  for (const x of lanesX) {
    out.push([
      [ca.x, aEdgeY], [ca.x, aOutY], [x, aOutY], [x, bOutY], [cb.x, bOutY], [cb.x, bEdgeY],
    ])
  }

  return out
}


/**
 * Orthogonal pathfinder, used when every simple shape is blocked.
 *
 * Builds a lattice from the cards' own edges (each inset by DETOUR, so routes
 * keep clear of them), then A*s across it. Nodes carry their travel direction
 * so turns can be penalised and the result comes out with as few bends as the
 * obstacles allow. Only reached in dense layouts, where it is the difference
 * between a clean route and a line through a card.
 */
function routeAStar(ar, br, ca, cb, obstacles) {
  const clear = (ax, ay, bx, by) => !obstacles.some((r) => segmentHitsRect(ax, ay, bx, by, r))

  // Leave and enter on the facing sides, with a stub out to the first lane.
  const horizontal = Math.abs(ca.x - cb.x) >= Math.abs(ca.y - cb.y)
  let startEdge; let startNode; let endEdge; let endNode
  if (horizontal) {
    const right = ca.x < cb.x
    startEdge = [right ? ar.x2 : ar.x1, ca.y]
    startNode = [right ? ar.x2 + DETOUR : ar.x1 - DETOUR, ca.y]
    endEdge = [right ? br.x1 : br.x2, cb.y]
    endNode = [right ? br.x1 - DETOUR : br.x2 + DETOUR, cb.y]
  } else {
    const down = ca.y < cb.y
    startEdge = [ca.x, down ? ar.y2 : ar.y1]
    startNode = [ca.x, down ? ar.y2 + DETOUR : ar.y1 - DETOUR]
    endEdge = [cb.x, down ? br.y1 : br.y2]
    endNode = [cb.x, down ? br.y1 - DETOUR : br.y2 + DETOUR]
  }

  const uniq = (vals) => [...new Set(vals.map((v) => Math.round(v)))].sort((a, b) => a - b)
  const xs = uniq([
    startNode[0], endNode[0],
    ...obstacles.flatMap((r) => [r.x1 - DETOUR, r.x2 + DETOUR]),
  ])
  const ys = uniq([
    startNode[1], endNode[1],
    ...obstacles.flatMap((r) => [r.y1 - DETOUR, r.y2 + DETOUR]),
  ])
  if (xs.length * ys.length > 20000) return null // guard against pathological sizes

  const xi = new Map(xs.map((v, i) => [v, i]))
  const yi = new Map(ys.map((v, i) => [v, i]))
  const sx = xi.get(Math.round(startNode[0]))
  const sy = yi.get(Math.round(startNode[1]))
  const tx = xi.get(Math.round(endNode[0]))
  const ty = yi.get(Math.round(endNode[1]))
  if (sx == null || sy == null || tx == null || ty == null) return null

  const TURN = 60
  const key = (x, y, d) => `${x},${y},${d}`
  const h = (x, y) => Math.abs(xs[x] - xs[tx]) + Math.abs(ys[y] - ys[ty])

  const open = [{ x: sx, y: sy, d: horizontal ? 'h' : 'v', g: 0, f: h(sx, sy) }]
  const best = new Map([[key(sx, sy, horizontal ? 'h' : 'v'), 0]])
  const cameFrom = new Map()
  let goal = null

  while (open.length) {
    open.sort((a, b) => a.f - b.f)
    const cur = open.shift()
    if (cur.x === tx && cur.y === ty) { goal = cur; break }
    const curKey = key(cur.x, cur.y, cur.d)
    if (cur.g > (best.get(curKey) ?? Infinity)) continue

    const steps = [
      [cur.x - 1, cur.y, 'h'], [cur.x + 1, cur.y, 'h'],
      [cur.x, cur.y - 1, 'v'], [cur.x, cur.y + 1, 'v'],
    ]
    for (const [nx, ny, nd] of steps) {
      if (nx < 0 || ny < 0 || nx >= xs.length || ny >= ys.length) continue
      if (!clear(xs[cur.x], ys[cur.y], xs[nx], ys[ny])) continue
      const g = cur.g + Math.abs(xs[nx] - xs[cur.x]) + Math.abs(ys[ny] - ys[cur.y]) + (nd === cur.d ? 0 : TURN)
      const nk = key(nx, ny, nd)
      if (g >= (best.get(nk) ?? Infinity)) continue
      best.set(nk, g)
      cameFrom.set(nk, { ...cur })
      open.push({ x: nx, y: ny, d: nd, g, f: g + h(nx, ny) })
    }
  }
  if (!goal) return null

  const lattice = []
  let node = goal
  while (node) {
    lattice.unshift([xs[node.x], ys[node.y]])
    node = cameFrom.get(key(node.x, node.y, node.d))
  }

  // Stitch the edge stubs on and drop redundant collinear points.
  const pts = [startEdge, ...lattice, endEdge]
  const out = [pts[0]]
  for (let i = 1; i < pts.length; i++) {
    const [px, py] = out[out.length - 1]
    const [cx, cy] = pts[i]
    if (px === cx && py === cy) continue
    if (out.length >= 2) {
      const [qx, qy] = out[out.length - 2]
      const collinear = (qx === px && px === cx) || (qy === py && py === cy)
      if (collinear) { out[out.length - 1] = [cx, cy]; continue }
    }
    out.push([cx, cy])
  }
  // Only axis-aligned output is usable.
  for (let i = 0; i < out.length - 1; i++) {
    if (out[i][0] !== out[i + 1][0] && out[i][1] !== out[i + 1][1]) return null
  }
  return out
}

function routeJoin(a, b, label, obstacles) {
  const ca = centreOf(a)
  const cb = centreOf(b)
  const candidates = []

  const ar = { x1: a.x, y1: a.y, x2: a.x + CARD_W, y2: a.y + CARD_H }
  const br = { x1: b.x, y1: b.y, x2: b.x + CARD_W, y2: b.y + CARD_H }

  // Decide from the rectangles, not the centres. Two cards offset by less than
  // a card height are still side by side, and routing them as a diagonal would
  // drive the horizontal run straight through the card it is heading for.
  const xOverlap = Math.min(ar.x2, br.x2) - Math.max(ar.x1, br.x1)
  const yOverlap = Math.min(ar.y2, br.y2) - Math.max(ar.y1, br.y1)
  const sideBySide = xOverlap <= 0 && yOverlap > 0
  const stacked = yOverlap <= 0 && xOverlap > 0
  const diagonal = xOverlap <= 0 && yOverlap <= 0

  if (sideBySide) {
    // Straight rule down the middle of the shared band, edge to edge.
    const y = (Math.max(ar.y1, br.y1) + Math.min(ar.y2, br.y2)) / 2
    const [L, R] = a.x <= b.x ? [ar, br] : [br, ar]
    candidates.push([[L.x2, y], [R.x1, y]])
  }

  if (stacked) {
    const x = (Math.max(ar.x1, br.x1) + Math.min(ar.x2, br.x2)) / 2
    const [T, B] = a.y <= b.y ? [ar, br] : [br, ar]
    candidates.push([[x, T.y2], [x, B.y1]])
  }

  if (diagonal) {
    // Separated on both axes, so both elbows are safe: each leg runs outside
    // the other card's span and stops on an edge.
    const leaveRight = ca.x < cb.x
    const below = ca.y < cb.y
    const aSideX = leaveRight ? ar.x2 : ar.x1
    const aEdgeY = below ? ar.y2 : ar.y1
    const bSideX = leaveRight ? br.x1 : br.x2
    const bEdgeY = below ? br.y1 : br.y2

    candidates.push([[aSideX, ca.y], [cb.x, ca.y], [cb.x, bEdgeY]])
    candidates.push([[ca.x, aEdgeY], [ca.x, cb.y], [bSideX, cb.y]])

    // Z-routes through the gap between the two cards. An elbow turns on a card's
    // centre line, which in a dense grid often lands on a neighbour; turning in
    // the empty lane between them usually does not.
    const laneX = (aSideX + bSideX) / 2
    candidates.push([[aSideX, ca.y], [laneX, ca.y], [laneX, cb.y], [bSideX, cb.y]])
    const laneY = (aEdgeY + bEdgeY) / 2
    candidates.push([[ca.x, aEdgeY], [ca.x, laneY], [cb.x, laneY], [cb.x, bEdgeY]])
  }

  // Nothing simple is clear: step around the obstruction through a clear lane.
  // Only worth computing once the direct shapes have failed.
  let best = null
  let bestHits = Infinity
  const consider = (pts) => {
    const cost = routeCost(pts, obstacles)
    if (cost < bestHits) { bestHits = cost; best = pts }
    return cost === 0
  }

  for (const pts of candidates) if (consider(pts)) return finish(best, label)

  for (const pts of detourCandidates(ar, br, ca, cb, obstacles)) {
    if (consider(pts)) return finish(best, label)
  }

  // Last resort: arch clear of both cards, over the top or under the bottom.
  // Clamped so an arch above the first row still has room to draw.
  const archTop = Math.max(8, Math.min(ar.y1, br.y1) - 28)
  if (consider([[ca.x, ar.y1], [ca.x, archTop], [cb.x, archTop], [cb.x, br.y1]])) {
    return finish(best, label)
  }
  const archBottom = Math.max(ar.y2, br.y2) + 28
  if (consider([[ca.x, ar.y2], [ca.x, archBottom], [cb.x, archBottom], [cb.x, br.y2]])) {
    return finish(best, label)
  }

  // Every simple shape is blocked — find a real route rather than settle.
  const found = routeAStar(ar, br, ca, cb, obstacles)
  if (found && consider(found)) return finish(best, label)

  if (!best) return null

  return finish(best, label)
}

function finish(points, label) {
  const badge = badgeForPoints(points, label)
  return badge ? { d: toPath(points), badge, points } : null
}

/**
 * Build the connector geometry for every join, plus the canvas extent needed
 * to hold the cards and their connectors.
 */
export function computeJoinGeometry(positions, joins, tables) {
  const paths = []
  const badges = []
  let extentX = 0
  let extentY = 0

  ;(joins ?? []).forEach((j) => {
    const a = positions[j.leftTable]
    const b = positions[j.rightTable]
    if (!a || !b) return
    const obstacles = Object.keys(positions)
      .filter((n) => n !== j.leftTable && n !== j.rightTable)
      .map((n) => rectOf(positions[n]))
    const routed = routeJoin(a, b, j.name, obstacles)
    if (!routed) return
    paths.push(routed.d)
    badges.push(routed.badge)
    routed.points.forEach(([x, y]) => { extentX = Math.max(extentX, x); extentY = Math.max(extentY, y) })
  })

  const names = (tables ?? []).map((t) => t.name).filter((n) => positions[n])
  names.forEach((n) => {
    extentX = Math.max(extentX, positions[n].x + CARD_W)
    extentY = Math.max(extentY, positions[n].y + CARD_H)
  })

  return { paths, badges, width: extentX ? extentX + 24 : 0, height: extentY ? extentY + 24 : 0 }
}
