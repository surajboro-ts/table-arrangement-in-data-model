import React, { useEffect, useRef, useState } from 'react'
import { Icon, IconButton, Menu, MenuItem, Tooltip } from '../radiant/components'
import { ARRANGEMENTS } from '../layouts'

/** Dwell before an option explains itself. */
const TOOLTIP_DELAY = 2000

/**
 * The canvas arrangement switcher — an icon button in the sub-header whose
 * glyph reflects the active arrangement, opening a single-select menu.
 *
 * Hovering an option previews it on the canvas; resting on one for two seconds
 * explains what it does. When a custom layout is remembered but not currently
 * applied, the Custom row grows a restore affordance.
 */
export function ArrangementMenu({ value, onChange, onPreview, canRestore }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const active = ARRANGEMENTS.find((a) => a.id === value) ?? ARRANGEMENTS[0]

  const close = () => { setOpen(false); onPreview?.(null) }

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) close() }
    const onKey = (e) => { if (e.key === 'Escape') close() }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // Never leave a preview behind if the menu unmounts mid-hover.
  useEffect(() => () => onPreview?.(null), [])

  const choose = (id) => { onPreview?.(null); onChange(id); setOpen(false) }

  return (
    <div className="dme-arrange" ref={ref}>
      <IconButton
        variant="secondary"
        size="standard"
        aria-label={`Table arrangement: ${active.label}`}
        aria-haspopup="menu"
        aria-expanded={open}
        icon={<Icon name={active.icon} size={16} />}
        onClick={() => (open ? close() : setOpen(true))}
      />
      {open && (
        <div className="dme-arrange__pop" onMouseLeave={() => onPreview?.(null)}>
          <Menu>
            {ARRANGEMENTS.map((a) => {
              const showRestore = a.id === 'custom' && canRestore
              return (
                <div
                  key={a.id}
                  className="dme-arrange__row"
                  onMouseEnter={() => onPreview?.(a.id)}
                  onFocus={() => onPreview?.(a.id)}
                >
                  <Tooltip label={a.description} placement="left" delay={TOOLTIP_DELAY}>
                    <MenuItem
                      label={a.label}
                      icon={<Icon name={a.icon} size={16} />}
                      activated={a.id === value}
                      className={showRestore ? 'dme-arrange__item--has-restore' : undefined}
                      onClick={() => choose(a.id)}
                    />
                  </Tooltip>
                  {showRestore && (
                    <span className="dme-arrange__restore">
                      {/* No dwell here: you only point at an unlabelled glyph
                          when you already want to know what it does. */}
                      <Tooltip label="Restore previous custom layout" placement="top">
                        <IconButton
                          variant="ghost"
                          size="xs"
                          aria-label="Restore previous custom layout"
                          icon={<Icon name="reset" size={14} />}
                          onClick={(e) => { e.stopPropagation(); choose('custom') }}
                        />
                      </Tooltip>
                    </span>
                  )}
                </div>
              )
            })}
          </Menu>
        </div>
      )}
    </div>
  )
}

export default ArrangementMenu
