import { readFileSync } from 'node:fs'
import { INITIAL_MODEL } from '../src/data.js'
import { routeJoin, collisions, rectOf } from '../src/joins.js'

const pos = JSON.parse(readFileSync(process.argv[2], 'utf8'))
for (const name of ['Join 4', 'Join 10', 'Join 13']) {
  const j = INITIAL_MODEL.joins.find((x) => x.name === name)
  const a = pos[j.leftTable]; const b = pos[j.rightTable]
  const obstacles = Object.keys(pos)
    .filter((n) => n !== j.leftTable && n !== j.rightTable)
    .map((n) => rectOf(pos[n]))
  const r = routeJoin(a, b, j.name, obstacles)
  console.log(`${name}: ${j.leftTable} -> ${j.rightTable}`)
  console.log(`  node renders: ${r ? r.d : 'null'}`)
  console.log(`  hits: ${r ? collisions(r.points, obstacles) : '-'}`)
}
