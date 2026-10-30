import React from 'react'
import { Icon } from '../radiant/components'

/**
 * Centred empty state. The prototype drew this by hand; Radiant has no
 * equivalent block, so the composition stays — rebuilt on Radiant type
 * classes and tokens.
 */
export function EmptyState({ icon = 'table', title, desc, actionLabel, onAction, secondary }) {
  return (
    <div className="dme-empty">
      <Icon name={icon} size={32} className="dme-empty__icon" />
      <div className="dme-empty__body">
        <div className="dme-empty__title rd-label-subhead">{title}</div>
        <div className="dme-empty__desc rd-body">{desc}</div>
      </div>
      {actionLabel && (
        <div className="dme-empty__action">
          <button type="button" className="dme-suggestion-link rd-caption" onClick={onAction}>
            <Icon name="ai" size={14} />
            {actionLabel}
          </button>
          <Icon name="arrow-right" size={14} className="dme-moving-arrow" />
        </div>
      )}
      {secondary && (
        <>
          <hr className="dme-empty__divider" />
          <span className="dme-empty__secondary rd-caption">{secondary}</span>
        </>
      )}
    </div>
  )
}

export default EmptyState
