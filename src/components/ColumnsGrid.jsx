import React, { useMemo, useState } from 'react'
import { Button, ObjectTable, SearchBar } from '../radiant/components'

const COLUMNS = [
  { id: 'select', type: 'checkbox' },
  { id: 'name', header: 'Column name', type: 'text', width: 200, sortable: true },
  { id: 'table', header: 'Source table name', type: 'text', width: 180 },
  { id: 'source', header: 'Source column name', type: 'text', width: 200 },
  { id: 'desc', header: 'Description', type: 'text', width: 260 },
  { id: 'ai', header: 'AI context', type: 'text', width: 260 },
]

export function ColumnsGrid({ model, descOverrides = {}, aiContext = {} }) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(() => new Set())

  const rows = useMemo(() => {
    const out = []
    model.columns.forEach((g) => {
      (g.columns ?? []).forEach((c) => {
        const key = `${g.table}.${c}`.toLowerCase()
        out.push({
          id: key,
          selected: selected.has(key),
          cells: {
            name: { text: c, emphasis: 'strong' },
            table: g.table,
            source: c,
            desc: descOverrides[key] ?? '—',
            ai: aiContext[key] ?? '—',
          },
        })
      })
    })
    const q = query.toLowerCase()
    return q ? out.filter((r) => r.id.includes(q)) : out
  }, [model.columns, query, selected, descOverrides, aiContext])

  const toggleRow = (id) =>
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const toggleAll = () =>
    setSelected((prev) => (prev.size === rows.length ? new Set() : new Set(rows.map((r) => r.id))))

  return (
    <div className="dme-grid-wrap dme-grid-wrap--columns">
      <ObjectTable
        columns={COLUMNS}
        rows={rows}
        selectable
        onToggleRow={toggleRow}
        onToggleAll={toggleAll}
        toolbar={
          <div className="dme-grid-toolbar">
            <SearchBar
              wrapperClassName="dme-grid-toolbar__search"
              placeholder="Search"
              value={query}
              onValueChange={setQuery}
            />
            <Button variant="secondary" size="small">Model CSV import</Button>
          </div>
        }
        selectionActions={() => (
          <>
            <Button variant="tertiary" size="small">Set AI context</Button>
            <Button variant="tertiary" size="small">Remove</Button>
          </>
        )}
      />
    </div>
  )
}

export default ColumnsGrid
