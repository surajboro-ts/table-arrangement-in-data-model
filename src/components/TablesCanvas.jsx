import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Icon, IconButton, Menu, MenuItem } from '../radiant/components'
import { DATASOURCE_TABLES } from '../data'
import { CARD_W, CARD_H, runArrangement } from '../layouts'
import { computeJoinGeometry } from '../joins'

const MIN_ZOOM = 0.1
const MAX_ZOOM = 2

/**
 * A table card on the model canvas. Radiant has no card component, so this
 * stays bespoke — rebuilt on Radiant tokens and type classes.
 */
function TableCard({ table, added, total, pos, onRemove, onDragStart }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!menuOpen) return
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setMenuOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [menuOpen])

  return (
    <div
      className="dme-table-card is-movable"
      data-table={table.name}
      ref={ref}
      style={{ left: pos.x, top: pos.y, width: CARD_W, height: CARD_H }}
      onPointerDown={(e) => onDragStart(e, table.name)}
    >
      <div className="dme-table-card__header">
        <span className="dme-table-card__label rd-caption">Table</span>
        <IconButton
          variant="ghost"
          size="xs"
          aria-label={`Options for ${table.name}`}
          icon={<Icon name="more" size={14} />}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setMenuOpen((v) => !v)}
        />
        {menuOpen && (
          <div className="dme-table-card__menu">
            <Menu>
              <MenuItem label="Remove from model" onClick={() => { setMenuOpen(false); onRemove(table.name) }} />
            </Menu>
          </div>
        )}
      </div>
      <div className="dme-table-card__name rd-label-subhead">{table.name}</div>
      <div className="dme-table-card__count rd-caption">{added}/{total} Columns</div>
    </div>
  )
}

export function TablesCanvas({ model, arrangement, previewArrangement, zoom = 'fit', onZoomChange, onScaleChange, onArrangementChange, onCustomSaved, onAddTable, onRemoveTable }) {
  const canvasRef = useRef(null)
  const [positions, setPositions] = useState({})
  const [geo, setGeo] = useState({ paths: [], badges: [], width: 0, height: 0 })
  const [size, setSize] = useState({ width: 0, height: 0 })

  const dragRef = useRef(null)
  /**
   * The single remembered custom layout. Dragging a card — in any arrangement —
   * overwrites this with the positions as they stand after that drag, and
   * picking "Custom layout" from the menu restores whatever is held here.
   */
  const customRef = useRef(null)
  /** Set when the switch to Custom came from a drag, so the drag isn't undone. */
  const fromDragRef = useRef(false)
  /** True once a card has been hand-placed, as opposed to an untouched grid. */
  const customDirtyRef = useRef(false)

  const arrangementRef = useRef(arrangement)
  const onArrangeRef = useRef(onArrangementChange)
  const onCustomSavedRef = useRef(onCustomSaved)
  const onZoomRef = useRef(onZoomChange)
  const zoomRef = useRef(zoom)
  const onScaleRef = useRef(onScaleChange)
  useEffect(() => { arrangementRef.current = arrangement }, [arrangement])
  useEffect(() => { onArrangeRef.current = onArrangementChange }, [onArrangementChange])
  useEffect(() => { onCustomSavedRef.current = onCustomSaved }, [onCustomSaved])
  useEffect(() => { onZoomRef.current = onZoomChange }, [onZoomChange])
  useEffect(() => { zoomRef.current = zoom }, [zoom])
  useEffect(() => { onScaleRef.current = onScaleChange }, [onScaleChange])

  const tableKey = model.tables.map((t) => t.name).join(',')
  const joinKey = model.joins.map((j) => `${j.leftTable}-${j.rightTable}`).join(',')

  /** Lay the canvas out for the current arrangement. */
  const arrange = useCallback(() => {
    // The drag already positioned everything; re-running would discard it.
    if (fromDragRef.current) { fromDragRef.current = false; return }

    const el = canvasRef.current
    const viewport = el
      ? { width: el.clientWidth, height: el.clientHeight }
      : { width: 1024, height: 640 }
    const fresh = runArrangement(arrangement, model.tables, model.joins, viewport)

    if (arrangement === 'custom') {
      // Hand-placed: restore it, falling back to the grid for any table that
      // has joined the model since it was remembered.
      if (customRef.current && customDirtyRef.current) {
        const remembered = customRef.current
        const merged = {}
        model.tables.forEach((t) => {
          merged[t.name] = remembered[t.name] ?? fresh[t.name]
        })
        customRef.current = merged
        setPositions(merged)
        return
      }
      // Untouched: a plain grid, but it is still the layout you came from and
      // can return to — so remember it, and let the menu offer to restore it.
      customRef.current = fresh
      onCustomSavedRef.current?.()
      setPositions(fresh)
      return
    }

    setPositions(fresh)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arrangement, tableKey, joinKey])

  useLayoutEffect(() => { arrange() }, [arrange])

  // Recompute on container resize — grow *and* shrink (Radiant README gotcha #2).
  // A hand-placed layout holds its coordinates; an untouched grid re-flows.
  useEffect(() => {
    const el = canvasRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    setSize({ width: el.clientWidth, height: el.clientHeight })
    const ro = new ResizeObserver(() => {
      setSize({ width: el.clientWidth, height: el.clientHeight })
      if (arrangementRef.current === 'custom' && customDirtyRef.current) return
      arrange()
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [arrange])

  // Connectors follow the positions.
  useLayoutEffect(() => {
    setGeo(computeJoinGeometry(positions, model.joins, model.tables))
  }, [positions, model.joins, model.tables])

  /**
   * Hovering an option in the menu previews it: the same cards and connectors,
   * at the hovered arrangement's positions, drawn as dashed ghosts.
   */
  const preview = React.useMemo(() => {
    if (!previewArrangement || previewArrangement === arrangement) return null
    const el = canvasRef.current
    const viewport = el
      ? { width: el.clientWidth, height: el.clientHeight }
      : { width: 1024, height: 640 }
    const next =
      previewArrangement === 'custom' && customRef.current
        ? model.tables.reduce((acc, t) => {
            acc[t.name] = customRef.current[t.name]
            return acc
          }, {})
        : runArrangement(previewArrangement, model.tables, model.joins, viewport)
    if (model.tables.some((t) => !next[t.name])) return null
    return { positions: next, geo: computeJoinGeometry(next, model.joins, model.tables) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewArrangement, arrangement, tableKey, joinKey])

  const scaleRef = useRef(1)
  /** Scroll offsets to apply once a gesture zoom has re-rendered. */
  const pendingScrollRef = useRef(null)
  /** Suppresses the zoom transition while a gesture is in flight. */
  const [liveGesture, setLiveGesture] = useState(false)
  const gestureTimer = useRef(null)

  /**
   * Trackpad pinch arrives as a wheel event with ctrlKey set, and ctrl/cmd +
   * wheel is the same gesture on a mouse. A plain wheel is left alone so the
   * canvas still pans natively.
   */
  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const onWheel = (e) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      const from = scaleRef.current || 1
      const to = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, from * Math.exp(-e.deltaY * 0.0015)))
      if (Math.abs(to - from) < 0.001) return

      // Keep the point under the cursor pinned while the scale changes.
      const rect = el.getBoundingClientRect()
      const px = e.clientX - rect.left
      const py = e.clientY - rect.top
      pendingScrollRef.current = {
        left: ((el.scrollLeft + px) / from) * to - px,
        top: ((el.scrollTop + py) / from) * to - py,
      }
      // A pinch should track the fingers, so no easing while it is happening.
      setLiveGesture(true)
      if (gestureTimer.current) clearTimeout(gestureTimer.current)
      gestureTimer.current = setTimeout(() => setLiveGesture(false), 180)
      onZoomRef.current?.(String(Math.round(to * 100)))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      el.removeEventListener('wheel', onWheel)
      if (gestureTimer.current) clearTimeout(gestureTimer.current)
    }
  }, [])

  const onDragStart = useCallback((e, name) => {
    if (e.button !== 0 || previewArrangement) return
    const start = positions[name]
    if (!start) return
    // Capture keeps the drag alive if the pointer outruns the card; it throws
    // for a pointer id the element never saw, which must not abort the drag.
    try { e.currentTarget.setPointerCapture?.(e.pointerId) } catch { /* not capturable */ }
    dragRef.current = {
      name,
      pointerId: e.pointerId,
      originX: e.clientX,
      originY: e.clientY,
      startX: start.x,
      startY: start.y,
      // The layout as it stands when the drag begins — what the new custom
      // layout is built from, whichever arrangement we were looking at.
      base: positions,
      moved: false,
    }
  }, [positions, previewArrangement])

  useEffect(() => {
    const onMove = (e) => {
      const d = dragRef.current
      if (!d || e.pointerId !== d.pointerId) return
      // Pointer travel is in screen pixels; positions are in model pixels.
      const scale = scaleRef.current || 1
      const dx = (e.clientX - d.originX) / scale
      const dy = (e.clientY - d.originY) / scale
      if (!d.moved && Math.hypot(dx * scale, dy * scale) < 3) return

      if (!d.moved) {
        d.moved = true
        customDirtyRef.current = true
        // Moving a card changes the extent, which under Fit would rescale the
        // canvas while you drag. Pin the current level instead.
        if (zoomRef.current === 'fit') {
          onZoomRef.current?.(String(Math.round((scaleRef.current || 1) * 100)))
        }
        // Hand-placing a card makes this the custom layout, whatever we were in.
        if (arrangementRef.current !== 'custom') {
          fromDragRef.current = true
          onArrangeRef.current?.('custom')
        }
      }

      const next = {
        ...d.base,
        [d.name]: { x: Math.max(0, d.startX + dx), y: Math.max(0, d.startY + dy) },
      }
      customRef.current = next
      onCustomSavedRef.current?.()
      setPositions(next)
    }
    const onUp = (e) => {
      const d = dragRef.current
      if (d && e.pointerId === d.pointerId) dragRef.current = null
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [])

  const shownGeo = preview ? preview.geo : geo
  const shownPositions = preview ? preview.positions : positions

  /**
   * "Fit" shrinks the model until it fits the canvas — never enlarges it, so a
   * small model still renders at 1:1. Previewing and applying an arrangement
   * both fit, so the whole model comes into view either way; un-hovering a
   * preview returns to whatever zoom was set. That rescaling is the thing
   * under evaluation for large models.
   */
  const scale = (() => {
    // A preview always shows the whole arrangement, whatever zoom is set, so
    // you can see everything the option would do before committing to it.
    if (!preview && zoom !== 'fit') return (Number(zoom) || 100) / 100
    if (!shownGeo.width || !shownGeo.height || !size.width || !size.height) return 1
    return Math.min(1, size.width / shownGeo.width, size.height / shownGeo.height)
  })()
  scaleRef.current = scale

  useEffect(() => { onScaleRef.current?.(scale) }, [scale])

  /**
   * A table dropped from the left pane is placed where it was dropped, which
   * makes the layout a hand-made one: an algorithm would otherwise move it
   * somewhere else the moment it landed, and shuffle every other card with it.
   */
  const dropTable = useCallback((e) => {
    const name = e.dataTransfer.getData('text/plain')
    if (!name) return
    const el = canvasRef.current
    if (!el) return
    e.preventDefault()
    e.stopPropagation()

    const rect = el.getBoundingClientRect()
    const scale = scaleRef.current || 1
    const x = Math.max(0, (el.scrollLeft + e.clientX - rect.left) / scale - CARD_W / 2)
    const y = Math.max(0, (el.scrollTop + e.clientY - rect.top) / scale - CARD_H / 2)

    if (arrangementRef.current !== 'custom') {
      fromDragRef.current = true
      onArrangeRef.current?.('custom')
    }
    // Adding a card changes the extent, which under Fit would rescale the
    // canvas out from under the drop.
    if (zoomRef.current === 'fit') {
      onZoomRef.current?.(String(Math.round(scale * 100)))
    }
    customDirtyRef.current = true
    const next = { ...positions, [name]: { x: Math.round(x), y: Math.round(y) } }
    customRef.current = next
    onCustomSavedRef.current?.()
    setPositions(next)
    onAddTable?.(name)
  }, [positions, onAddTable])

  useLayoutEffect(() => {
    const el = canvasRef.current
    const pending = pendingScrollRef.current
    if (!el || !pending) return
    pendingScrollRef.current = null
    el.scrollLeft = Math.max(0, pending.left)
    el.scrollTop = Math.max(0, pending.top)
  }, [scale])

  return (
    <div
      className={`dme-canvas${preview ? ' is-previewing' : ''}`}
      ref={canvasRef}
      onDragOver={(e) => {
        if (preview || !e.dataTransfer.types.includes('text/plain')) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'copy'
      }}
      onDrop={preview ? undefined : dropTable}
    >
      <div
        className="dme-canvas__scroll"
        style={{ width: shownGeo.width * scale, height: shownGeo.height * scale }}
      >
      <div
        className={`dme-canvas__inner${liveGesture || dragRef.current ? ' is-live' : ''}`}
        style={{
          width: shownGeo.width,
          height: shownGeo.height,
          transform: scale === 1 ? undefined : `scale(${scale})`,
          transformOrigin: '0 0',
        }}
      >
        <svg className="dme-join-svg" width={shownGeo.width} height={shownGeo.height} aria-hidden="true">
          {shownGeo.paths.map((d, i) => (
            <path key={i} d={d} stroke="var(--rd-sys-color-content-primary)" strokeWidth="1" fill="none" />
          ))}
        </svg>
        {shownGeo.badges.map((b, i) => (
          <div key={i} className="dme-join-badge" style={{ left: b.x, top: b.y }} title={b.label}>
            <img src="assets/Join UI.svg" width="32" height="14" alt="" />
          </div>
        ))}
        {model.tables.map((t) => {
          const pos = shownPositions[t.name]
          if (!pos) return null
          const ds = DATASOURCE_TABLES.find((d) => d.name.toLowerCase() === t.name.toLowerCase())
          const added = model.columns.find((g) => g.table === t.name)?.columns.length ?? 0
          return (
            <TableCard
              key={t.name}
              table={t}
              added={added}
              total={ds?.columns.length ?? 0}
              pos={pos}
              onRemove={onRemoveTable}
              onDragStart={onDragStart}
            />
          )
        })}
      </div>
      </div>
    </div>
  )
}

export default TablesCanvas
