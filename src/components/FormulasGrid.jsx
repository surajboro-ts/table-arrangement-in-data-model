import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Icon, IconButton, Menu, MenuItem, ObjectTable, SearchBar } from '../radiant/components'

const COLUMNS = [
  { id: 'name', header: 'Formula name', type: 'text', sortable: true },
  { id: 'type', header: 'Data type', type: 'text' },
  { id: 'actions', header: '', type: 'actions', width: 56, align: 'right' },
]

function RowMenu({ name }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  return (
    <div className="dme-row-menu" ref={ref}>
      <IconButton
        variant="ghost"
        size="small"
        aria-label={`Options for ${name}`}
        icon={<Icon name="more" size={16} />}
        onClick={() => setOpen((v) => !v)}
      />
      {open && (
        <div className="dme-row-menu__pop">
          <Menu>
            <MenuItem label="Edit formula" onClick={() => setOpen(false)} />
            <MenuItem label="Delete formula" className="dme-menu-item--danger" onClick={() => setOpen(false)} />
          </Menu>
        </div>
      )}
    </div>
  )
}

export function FormulasGrid({ model }) {
  const [query, setQuery] = useState('')

  const rows = useMemo(() => {
    const q = query.toLowerCase()
    return model.formulas
      .filter((f) => f.name.toLowerCase().includes(q))
      .map((f) => ({
        id: f.name,
        cells: {
          name: { text: f.name, description: f.code, emphasis: 'strong' },
          type: 'DOUBLE',
          actions: <RowMenu name={f.name} />,
        },
      }))
  }, [model.formulas, query])

  return (
    <div className="dme-grid-wrap">
      <ObjectTable
        columns={COLUMNS}
        rows={rows}
        toolbar={
          <div className="dme-grid-toolbar">
            <SearchBar
              wrapperClassName="dme-grid-toolbar__search"
              placeholder="Search formulas"
              value={query}
              onValueChange={setQuery}
            />
          </div>
        }
      />
    </div>
  )
}

export default FormulasGrid
