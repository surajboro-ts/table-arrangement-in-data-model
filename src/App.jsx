import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Button, Icon, SegmentedControl, Select, Toast,
} from './radiant/components'
import { DATASOURCE_TABLES, INITIAL_MODEL, MODEL_META, TABS } from './data.js'
import LeftPane from './components/LeftPane'
import TablesCanvas from './components/TablesCanvas'
import ColumnsGrid from './components/ColumnsGrid'
import FormulasGrid from './components/FormulasGrid'
import EmptyState from './components/EmptyState'
import ArrangementMenu from './components/ArrangementMenu'

const PANE_TABS = new Set(['Tables', 'Columns'])

export default function App() {
  const [tab, setTab] = useState('Tables')
  const [model, setModel] = useState(INITIAL_MODEL)
  const [toast, setToast] = useState(null)
  const [arrangement, setArrangement] = useState('custom')
  /** The arrangement being hovered in the menu, previewed on the canvas. */
  const [previewArrangement, setPreviewArrangement] = useState(null)
  /** True once a custom layout has been remembered and can be restored. */
  const [hasCustomLayout, setHasCustomLayout] = useState(false)
  /** Canvas zoom: 'fit', or a percentage as a string. */
  const [zoom, setZoom] = useState('fit')
  /** The scale actually in effect, so Fit can show what it resolved to. */
  const [scale, setScale] = useState(1)

  /**
   * Choosing an arrangement always brings the whole model into view, whatever
   * zoom you were at. Only a menu choice does this — a switch to Custom caused
   * by dragging leaves your zoom alone, since rescaling mid-drag is horrible.
   */
  const chooseArrangement = (id) => { setArrangement(id); setZoom('fit') }

  /**
   * Fit reports the level it resolved to, and a level reached by pinching is
   * added to the list so the control always shows where you actually are.
   */
  /**
   * The list stays short — 50/75/100. Any other level (Fit, or something
   * reached by pinching) has no matching option, so Radiant's Select falls
   * through to the placeholder, which carries the live percentage.
   */
  const zoomOptions = useMemo(
    () => [
      { value: '50', label: '50%' },
      { value: '75', label: '75%' },
      { value: '100', label: '100%' },
    ],
    [],
  )
  const [dragOver, setDragOver] = useState(false)

  const hasTables = model.tables.length > 0
  const hasColumns = model.columns.some((g) => g.columns?.length)
  const paneHidden = !PANE_TABS.has(tab) || (tab === 'Columns' && !hasTables)

  const notify = (msg) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 2600)
  }

  const addTable = useCallback((name) => {
    setModel((m) => {
      if (m.tables.some((t) => t.name.toLowerCase() === name.toLowerCase())) return m
      if (!DATASOURCE_TABLES.some((d) => d.name.toLowerCase() === name.toLowerCase())) return m
      return { ...m, tables: [...m.tables, { name, desc: '' }] }
    })
  }, [])

  const removeTable = useCallback((name) => {
    setModel((m) => ({
      ...m,
      tables: m.tables.filter((t) => t.name !== name),
      joins: m.joins.filter((j) => j.leftTable !== name && j.rightTable !== name),
      columns: m.columns.filter((g) => g.table !== name),
    }))
  }, [])

  const addColumn = useCallback((tableName, colName) => {
    setModel((m) => {
      const group = m.columns.find((g) => g.table === tableName)
      if (group?.columns.includes(colName)) return m
      const columns = group
        ? m.columns.map((g) => (g.table === tableName ? { ...g, columns: [...g.columns, colName] } : g))
        : [...m.columns, { table: tableName, columns: [colName] }]
      return { ...m, columns }
    })
  }, [])

  // The canvas handles its own drop and stops propagation, so the stage never
  // sees it and would keep the drag-over outline. `dragend` fires on the drag
  // source at the end of every drag, successful or not, so it is the reliable
  // place to clear it.
  useEffect(() => {
    const clear = () => setDragOver(false)
    window.addEventListener('dragend', clear)
    window.addEventListener('drop', clear)
    return () => {
      window.removeEventListener('dragend', clear)
      window.removeEventListener('drop', clear)
    }
  }, [])

  const onTablesDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const name = e.dataTransfer.getData('text/plain')
    if (name) addTable(name)
  }

  const onColumnsDrop = (e) => {
    const raw = e.dataTransfer.getData('application/x-spotter-column')
    setDragOver(false)
    if (!raw) return
    e.preventDefault()
    try {
      const { tableName, colName } = JSON.parse(raw)
      if (tableName && colName) addColumn(tableName, colName)
    } catch { /* malformed payload — ignore */ }
  }

  return (
    <div className="dme">
      {/* ── App header ───────────────────────────────── */}
      <header className="dme-header">
        <span className="dme-header__title rd-title-modal">Data model editor</span>
        <SegmentedControl
          options={TABS.map((t) => ({ value: t, label: t }))}
          value={tab}
          onChange={setTab}
        />
      </header>

      <div className="dme-body">
        <div className="dme-main-col">
          {/* ── Sub-header ─────────────────────────────── */}
          <div className="dme-subheader">
            <div className="dme-subheader__info">
              <span className="dme-subheader__name rd-label-section">{MODEL_META.name}</span>
              <span className="dme-subheader__desc rd-caption">{MODEL_META.desc}</span>
            </div>
            {tab === 'Tables' && (
              <div className="dme-subheader__actions">
                <Button variant="secondary" leadingIcon={<Icon name="magnifying-glass" size={16} />}>Find</Button>
                <ArrangementMenu
                  value={arrangement}
                  onChange={chooseArrangement}
                  onPreview={setPreviewArrangement}
                  canRestore={hasCustomLayout && arrangement !== 'custom'}
                />
                <Select
                  className="dme-subheader__select"
                  options={[
                    { value: 'all', label: 'Join options' },
                    { value: 'inner', label: 'Inner joins only' },
                    { value: 'outer', label: 'Include outer joins' },
                  ]}
                  value="all"
                />
                <Select
                  className="dme-subheader__select dme-subheader__select--zoom"
                  options={zoomOptions}
                  value={zoom}
                  placeholder={`${Math.round(scale * 100)}%`}
                  onChange={setZoom}
                />
                <img
                  className="dme-subheader__avatar"
                  src="assets/SpotterModel avatar.svg"
                  width="32"
                  height="32"
                  alt="SpotterModel"
                />
              </div>
            )}
            {tab === 'Formulas' && (
              <div className="dme-subheader__actions">
                <Button variant="secondary" leadingIcon={<Icon name="plus" size={16} />} disabled={!hasColumns}>
                  Add formula
                </Button>
              </div>
            )}
          </div>

          <div className="dme-content-row">
            <LeftPane
              tab={tab}
              model={model}
              hidden={paneHidden}
              onAddTable={addTable}
              onAddColumn={addColumn}
            />

            <main
              className={`dme-stage${dragOver ? ' is-drag-over' : ''}`}
              onDragOver={(e) => {
                if (tab === 'Tables' || (tab === 'Columns' && e.dataTransfer.types.includes('application/x-spotter-column'))) {
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'copy'
                  setDragOver(true)
                }
              }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false) }}
              onDrop={tab === 'Tables' ? onTablesDrop : tab === 'Columns' ? onColumnsDrop : undefined}
            >
              {tab === 'Tables' && (
                hasTables ? (
                  <TablesCanvas
                    model={model}
                    arrangement={arrangement}
                    previewArrangement={previewArrangement}
                    zoom={zoom}
                    onZoomChange={setZoom}
                    onScaleChange={setScale}
                    onArrangementChange={setArrangement}
                    onCustomSaved={() => setHasCustomLayout(true)}
                    onAddTable={addTable}
                    onRemoveTable={removeTable}
                  />
                ) : (
                  <EmptyState
                    icon="table"
                    title="Start with the right tables"
                    desc="Let SpotterModel suggest the best tables and joins for an AI-ready data model"
                    actionLabel="Get table suggestions"
                    onAction={() => notify('Table suggestions live in the SpotterModel panel')}
                    secondary="Or drag and drop from the left pane"
                  />
                )
              )}

              {tab === 'Columns' && (
                hasColumns ? (
                  <ColumnsGrid model={model} />
                ) : (
                  <EmptyState
                    icon={hasTables ? 'data-column' : 'table'}
                    title={hasTables ? 'Identify the right columns' : 'Build your foundation first'}
                    desc={hasTables
                      ? 'Let SpotterModel suggest the most relevant columns for your data model'
                      : 'Add tables so SpotterModel can recommend the right columns for you'}
                    actionLabel={hasTables ? 'Get column suggestions' : 'Get table suggestions'}
                    onAction={() => notify('Column suggestions live in the SpotterModel panel')}
                    secondary={hasTables ? 'Or drag and drop from the left pane' : undefined}
                  />
                )
              )}

              {tab === 'Formulas' && (
                model.formulas.length ? (
                  <FormulasGrid model={model} />
                ) : (
                  <EmptyState
                    icon="formula"
                    title={hasTables && hasColumns ? 'Logic over syntax' : hasTables ? 'Select your columns first' : 'Start with a data source'}
                    desc={hasTables && hasColumns
                      ? 'Tell SpotterModel what you need and it will build the formulas for you'
                      : hasTables
                        ? 'SpotterModel needs columns to define the logic for your formulas'
                        : 'Tables and columns are required before SpotterModel can help you build formulas'}
                    actionLabel="Describe your formula"
                    onAction={() => notify('Formula generation lives in the SpotterModel panel')}
                    secondary={hasTables && hasColumns ? 'Or add formulas manually' : undefined}
                  />
                )
              )}

              {(tab === 'Filters' || tab === 'Parameters' || tab === 'Settings') && (
                <EmptyState
                  icon="cog"
                  title={`${tab} coming soon`}
                  desc={`The ${tab.toLowerCase()} surface is not part of this prototype.`}
                />
              )}
            </main>
          </div>
        </div>
      </div>

      {/* ── App footer ───────────────────────────────── */}
      <footer className="dme-footer">
        <Button variant="secondary" onClick={() => notify('Changes discarded')}>
          Discard changes and close
        </Button>
        <Button variant="primary" onClick={() => notify('Changes saved')}>
          Save changes
        </Button>
      </footer>

      {toast && (
        <div className="dme-toast-host">
          <Toast onDismiss={() => setToast(null)}>{toast}</Toast>
        </div>
      )}
    </div>
  )
}
