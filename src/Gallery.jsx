import React, { useState } from 'react'
import RadiantApp from './radiant/RadiantApp'
import {
  Banner, Breadcrumb, Divider, ExplainerCard, Field, Icon, IconButton, ListItem,
  NavSearch, OrgSwitcher, PageLoader, Pagination, Shimmer, SideNav, Spinner,
  Tabs, Toast, Tooltip, TopNav, UserProfile, Button,
} from './radiant/components'

/** One labelled specimen in the supplementary grid. */
function Spec({ name, children, note }) {
  return (
    <div className="gal-spec">
      <div className="gal-spec__name rd-label-subhead">{name}</div>
      {note && <div className="gal-spec__note rd-caption">{note}</div>}
      <div className="gal-spec__stage">{children}</div>
    </div>
  )
}

/**
 * The library ships RadiantApp as its living catalogue, but it covers 29 of
 * the 45 exports. These are the rest, so the gallery shows the whole library.
 */
function Remaining() {
  const [tab, setTab] = useState('Overview')
  return (
    <section className="gal">
      <header className="gal__header" id="app-shell">
        <h2 className="rd-title-page">App shell</h2>
        <p className="rd-body gal__lede">
          TopNav and SideNav are designed as a pair. Both are slot-driven and
          carry no product data of their own.
        </p>
      </header>

      <div className="gal-shell">
        <TopNav
          logo={<Icon name="liveboard" size={22} />}
          search={<NavSearch phrases={['Search…', 'Ask a question…']} />}
          actions={
            <>
              <IconButton variant="ghost" aria-label="Help" icon={<Icon name="question-mark" size={18} />} />
              <IconButton variant="ghost" aria-label="Notifications" dot icon={<Icon name="bell" size={18} />} />
            </>
          }
          account={<><OrgSwitcher org="ThoughtSpot" /><UserProfile user="Suraj Boro" /></>}
        />
        <div className="gal-shell__body">
          <SideNav
            apps={[
              { icon: 'liveboard', label: 'Liveboards', active: true },
              { icon: 'answer', label: 'Answers' },
              { icon: 'model', label: 'Models' },
              { icon: 'database', label: 'Connections' },
            ]}
            title="Liveboards"
            onAdd={() => {}}
            addLabel="New liveboard"
            items={[
              { label: 'Retail Sales Analytics', active: true },
              { label: 'Inventory health' },
              { label: 'Customer satisfaction' },
              { section: 'Shared with me' },
              { label: 'Regional performance' },
              { label: 'Supplier scorecard', external: true },
              { section: 'Favourites' },
              { label: 'Daily revenue' },
            ]}
          />
          <div className="gal-shell__canvas rd-body">Page content</div>
        </div>
      </div>

      <header className="gal__header gal__header--sub" id="also">
        <h2 className="rd-title-page">Also in the library</h2>
        <p className="rd-body gal__lede">
          Sixteen more components the shipped catalogue above does not cover.
        </p>
      </header>

      <div className="gal__grid">
        <Spec name="Tabs" note="Underline tabs, 48px, brand underline on the active tab">
          <Tabs tabs={['Overview', 'Columns', 'Joins', 'Settings']} value={tab} onChange={setTab} />
        </Spec>

        <Spec name="Banner" note="info · success · warning · failure, each dismissible">
          <div className="gal-stack">
            <Banner status="info">A model change is still syncing.</Banner>
            <Banner status="success">Saved to Global sales connection.</Banner>
            <Banner status="warning" onDismiss={() => {}}>Three columns have no AI context.</Banner>
            <Banner status="failure">The join could not be validated.</Banner>
          </div>
        </Spec>

        <Spec name="ExplainerCard" note="Title, body, media slot, actions, dismissible">
          <ExplainerCard
            title="Arrange your tables"
            actions={<Button size="small" variant="tertiary">Show me</Button>}
            onDismiss={() => {}}
          >
            Pick a layout from the toolbar, or drag any table to place it yourself.
          </ExplainerCard>
        </Spec>

        <Spec name="Field" note="The wrapper behind Input, Select and SearchBar">
          <div className="gal-stack">
            <Field label="Model name" helper="Shown to anyone searching this connection.">
              <input placeholder="Retail Sales Analytics" />
            </Field>
            <Field label="Join key" error="Pick a column before saving.">
              <input placeholder="customer_id" />
            </Field>
          </div>
        </Spec>

        <Spec name="Tooltip" note="Dark bubble, four placements, optional dwell">
          <div className="gal-row">
            {['top', 'bottom', 'left', 'right'].map((p) => (
              <Tooltip key={p} label={`Placement: ${p}`} placement={p}>
                <Button variant="secondary" size="small">{p}</Button>
              </Tooltip>
            ))}
          </div>
        </Spec>

        <Spec name="Toast" note="Inverse bar with an optional link or action">
          <div className="gal-stack">
            <Toast onDismiss={() => {}}>Changes saved</Toast>
            <Toast icon={<Icon name="checkmark-circle" size={18} />} action={{ label: 'Undo' }} onDismiss={() => {}}>
              Table removed from the model
            </Toast>
          </div>
        </Spec>

        <Spec name="Spinner" note="blue · gray · white, any size">
          <div className="gal-row gal-row--center">
            <Spinner size={16} /><Spinner size={24} /><Spinner size={32} />
            <Spinner size={24} color="gray" />
          </div>
        </Spec>

        <Spec name="PageLoader" note="Centred three-dot wait with a message">
          <PageLoader message="Updating your model…" />
        </Spec>

        <Spec name="Shimmer" note="normal · dark · ai placeholders">
          <div className="gal-stack">
            <Shimmer width="100%" height={16} />
            <Shimmer width="70%" height={16} />
            <Shimmer width="100%" height={16} variant="ai" />
          </div>
        </Spec>

        <Spec name="ListItem" note="Leading and trailing slots, secondary line">
          <div className="gal-stack gal-stack--tight">
            <ListItem leading={<Icon name="table" size={16} />} label="fact_sales" secondary="11 columns" />
            <ListItem leading={<Icon name="table" size={16} />} label="dim_product" secondary="8 columns"
              trailing={<Icon name="chevron-right" size={16} />} />
            <ListItem leading={<Icon name="table" size={16} />} label="dim_archive" secondary="Unavailable" disabled />
          </div>
        </Spec>

        <Spec name="Breadcrumb">
          <Breadcrumb label="Back to all models" />
        </Spec>

        <Spec name="Pagination" note="Range readout with prev / next">
          <Pagination start={1} end={25} total={243} hasPrev={false} hasNext />
        </Spec>

        <Spec name="Divider">
          <div className="gal-stack">
            <span className="rd-body">Above the rule</span>
            <Divider />
            <span className="rd-body">Below the rule</span>
          </div>
        </Spec>

        <Spec name="OrgSwitcher">
          <OrgSwitcher org="ThoughtSpot" />
        </Spec>

        <Spec name="UserProfile">
          <UserProfile user="Suraj Boro" />
        </Spec>

        <Spec name="NavSearch" note="Cycles its placeholder phrases">
          <NavSearch phrases={['Search tables…', 'Ask about revenue…', 'Find a join…']} />
        </Spec>
      </div>

    </section>
  )
}

/** The page runs to several screens, so it needs a way to get around. */
function JumpBar() {
  const go = (id) => (e) => {
    e.preventDefault()
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  return (
    <nav className="gal-jump" aria-label="Gallery sections">
      <span className="gal-jump__brand rd-label-subhead">Radiant</span>
      <a href="#app-shell" className="rd-body" onClick={go('app-shell')}>App shell</a>
      <a href="#also" className="rd-body" onClick={go('also')}>Also in the library</a>
      <a href="#catalogue" className="rd-body" onClick={go('catalogue')}>Full catalogue</a>
    </nav>
  )
}

export default function Gallery() {
  return (
    <>
      <JumpBar />
      <Remaining />
      <div id="catalogue">
        <RadiantApp />
      </div>
    </>
  )
}
