import React, { useState } from 'react'
import { Button, Icon, SearchBar, Toggle, IconButton } from '../radiant/components'
import { DATASOURCE_TABLES, MODEL_META } from '../data'

function PaneHeader({ title, searchPlaceholder, query, onQuery }) {
  return (
    <div className="dme-pane__header">
      <div className="dme-pane__connection">
        <img src="assets/Snowflake.svg" width="14" height="14" alt="" />
        <span className="dme-pane__connection-name rd-caption">{MODEL_META.connection}</span>
      </div>
      <div className="dme-pane__title-row">
        <span className="dme-pane__title rd-label-content">{title}</span>
        <IconButton variant="ghost" size="small" aria-label="Change layout" icon={<Icon name="grid-view" size={16} />} />
      </div>
      <SearchBar
        wrapperClassName="dme-pane__search"
        placeholder={searchPlaceholder}
        value={query}
        onValueChange={onQuery}
      />
      <div className="dme-pane__filters">
        <Button variant="secondary" size="small" leadingIcon={<Icon name="filter" size={14} />}>Add filters</Button>
        <Button variant="tertiary" size="small" trailingIcon={<Icon name="chevron-down" size={14} />}>Sort by name</Button>
      </div>
    </div>
  )
}

function PaneFooter() {
  return (
    <div className="dme-pane__footer">
      <Toggle label="Show unselected" />
    </div>
  )
}

/** Tables tab: a flat, draggable list of every table in the datasource. */
function TablesSection({ model, onAddTable }) {
  const [query, setQuery] = useState('')
  const tables = DATASOURCE_TABLES.filter((t) => t.name.toLowerCase().includes(query.toLowerCase()))
  const inModel = new Set(model.tables.map((t) => t.name))

  return (
    <div className="dme-pane__section">
      <PaneHeader title="Tables" searchPlaceholder="Search tables" query={query} onQuery={setQuery} />
      <div className="dme-pane__list">
        {tables.map((t) => {
          const added = inModel.has(t.name)
          return (
            <button
              key={t.name}
              type="button"
              disabled={added}
              className={`dme-chip${added ? ' is-added' : ' dme-chip--draggable'}`}
              draggable={!added}
              onDragStart={
                added
                  ? undefined
                  : (e) => {
                      e.dataTransfer.setData('text/plain', t.name)
                      e.dataTransfer.effectAllowed = 'copy'
                    }
              }
              onDoubleClick={added ? undefined : () => onAddTable(t.name)}
              onKeyDown={
                added
                  ? undefined
                  : (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAddTable(t.name) } }
              }
              title={added ? `${t.name} — already in the model` : `${t.name} — drag onto the canvas, or press Enter to add`}
            >
              <Icon name="drag" size={14} className="dme-chip__grip" />
              <span className="dme-chip__label rd-body">{t.name}</span>
            </button>
          )
        })}
        {!tables.length && <div className="dme-pane__empty rd-body">No tables match “{query}”</div>}
      </div>
      <PaneFooter />
    </div>
  )
}

/** Columns tab: a table → column tree, with already-added columns dimmed out. */
function ColumnsSection({ model, onAddColumn }) {
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState(() => new Set([model.tables[0]?.name].filter(Boolean)))

  const toggle = (name) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })
  }

  return (
    <div className="dme-pane__section">
      <PaneHeader title="Columns" searchPlaceholder="Search columns" query={query} onQuery={setQuery} />
      <div className="dme-pane__list dme-pane__list--tree">
        {!model.tables.length && (
          <div className="dme-pane__empty rd-body">Add tables to your model to browse columns</div>
        )}
        {model.tables.map((t) => {
          const ds = DATASOURCE_TABLES.find((d) => d.name.toLowerCase() === t.name.toLowerCase())
          const addedCols = model.columns.find((g) => g.table === t.name)?.columns ?? []
          const cols = (ds?.columns ?? []).filter((c) => c.toLowerCase().includes(query.toLowerCase()))
          const isOpen = expanded.has(t.name)
          return (
            <div key={t.name} className="dme-tree__group">
              <button type="button" className="dme-tree__row" onClick={() => toggle(t.name)} aria-expanded={isOpen}>
                <span className={`dme-tree__chevron${isOpen ? ' is-open' : ''}`}>
                  <Icon name="chevron-right" size={12} />
                </span>
                <span className="dme-chip dme-chip--table">
                  <Icon name="drag" size={14} className="dme-chip__grip" />
                  <span className="dme-chip__label rd-body">{t.name}</span>
                </span>
              </button>
              {isOpen && (
                <div className="dme-tree__cols">
                  {cols.map((c) => {
                    const added = addedCols.includes(c)
                    return (
                      <button
                        key={c}
                        type="button"
                        disabled={added}
                        className={`dme-chip dme-chip--col${added ? ' is-added' : ' dme-chip--draggable'}`}
                        draggable={!added}
                        onDragStart={
                          added
                            ? undefined
                            : (e) => {
                                e.dataTransfer.setData(
                                  'application/x-spotter-column',
                                  JSON.stringify({ tableName: t.name, colName: c })
                                )
                                e.dataTransfer.effectAllowed = 'copy'
                              }
                        }
                        onDoubleClick={added ? undefined : () => onAddColumn(t.name, c)}
                        onKeyDown={added ? undefined : (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAddColumn(t.name, c) } }}
                        title={added ? `${c} — already in the model` : `${c} — drag onto the grid, or press Enter to add`}
                      >
                        <Icon name="drag" size={14} className="dme-chip__grip" />
                        <span className="dme-chip__label rd-body">{c}</span>
                      </button>
                    )
                  })}
                  {!cols.length && <div className="dme-pane__empty rd-caption">No columns match</div>}
                </div>
              )}
            </div>
          )
        })}
      </div>
      <PaneFooter />
    </div>
  )
}

export function LeftPane({ tab, model, hidden, onAddTable, onAddColumn }) {
  return (
    <aside className={`dme-pane${hidden ? ' is-hidden' : ''}`}>
      {tab === 'Tables' && <TablesSection model={model} onAddTable={onAddTable} />}
      {tab === 'Columns' && <ColumnsSection model={model} onAddColumn={onAddColumn} />}
    </aside>
  )
}

export default LeftPane
