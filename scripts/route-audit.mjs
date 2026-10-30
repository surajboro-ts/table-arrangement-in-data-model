import { readFileSync } from 'node:fs'
import { INITIAL_MODEL } from '../src/data.js'
import { runArrangement } from '../src/layouts.js'
import { routeJoin, routeAStar, collisions, rectOf, centreOf } from '../src/joins.js'

const file = process.argv[2]
const pos = file
  ? JSON.parse(readFileSync(file, 'utf8'))
  : runArrangement('force', INITIAL_MODEL.tables, INITIAL_MODEL.joins, { width: 764, height: 576 })

let bad = 0
for (const j of INITIAL_MODEL.joins) {
  const a = pos[j.leftTable]
  const b = pos[j.rightTable]
  if (!a || !b) continue
  // Ground truth: a connector must not cross ANY card, its own endpoints
  // included. Terminating on an edge is allowed by the strict-interior test.
  const obstacles = Object.keys(pos).map((n) => rectOf(pos[n]))

  const routed = routeJoin(a, b, j.name, obstacles)
  const hits = routed ? collisions(routed.points, obstacles) : -1
  if (hits > 0) {
    bad++
    const astar = routeAStar(rectOf(a), rectOf(b), centreOf(a), centreOf(b), obstacles)
    const blocked = obstacles
      .map((r, i) => ({ r, n: Object.keys(pos)[i] }))
      .filter(({ r }) => collisions(routed.points, [r]) > 0)
      .map(({ n }) => n)
    console.log(`\n${j.name}: ${j.leftTable} -> ${j.rightTable}`)
    console.log(`  chosen: ${routed.points.length} pts, cuts through ${blocked.join(', ')}`)
    console.log(`  A*:     ${astar ? `${astar.length} pts, hits ${collisions(astar, obstacles)}` : 'NULL — no path found'}`)
  }
}
console.log(`\njoins with a crossing: ${bad} / ${INITIAL_MODEL.joins.length}`)
