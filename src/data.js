/**
 * The model the editor boots with: Enterprise Retail Analytics — 23 tables and
 * 30 joins, a fact constellation with snowflaked dimensions. Large enough that
 * it does not fit the canvas unscaled, which is the case the arrangements and
 * the hover preview have to hold up under.
 */

export const TABS = ['Tables', 'Columns', 'Formulas', 'Filters', 'Parameters', 'Settings']

const cols = (...names) => names

export const DATASOURCE_TABLES = [
  // ---- Facts -------------------------------------------------------------
  { name: 'fact_sales', columns: cols('sale_id', 'customer_id', 'product_id', 'store_id', 'date_id', 'employee_id', 'promotion_id', 'channel_id', 'payment_id', 'amount', 'quantity') },
  { name: 'fact_new_retail_sales', columns: cols('sale_id', 'customer_id', 'product_id', 'store_id', 'date_id', 'quantity', 'unit_price', 'discount', 'net_amount') },
  { name: 'fact_inventory', columns: cols('inventory_id', 'product_id', 'warehouse_id', 'date_id', 'quantity_on_hand', 'reorder_level', 'unit_cost') },
  { name: 'fact_sales_pipeline', columns: cols('opportunity_id', 'customer_id', 'employee_id', 'date_id', 'stage', 'deal_value', 'win_probability') },
  { name: 'fact_customer_satisfaction', columns: cols('csat_id', 'customer_id', 'product_id', 'date_id', 'channel_id', 'score', 'nps_score') },
  { name: 'fact_returns', columns: cols('return_id', 'sale_id', 'product_id', 'customer_id', 'date_id', 'reason_code', 'refund_amount') },
  { name: 'fact_shipments', columns: cols('shipment_id', 'sale_id', 'shipping_id', 'warehouse_id', 'date_id', 'dispatched_at', 'delivered_at', 'cost') },

  // ---- Dimensions --------------------------------------------------------
  { name: 'dim_customer', columns: cols('customer_id', 'first_name', 'last_name', 'email', 'phone', 'segment', 'country_id', 'acquisition_date', 'lifetime_value') },
  { name: 'dim_product', columns: cols('product_id', 'product_name', 'category_id', 'supplier_id', 'brand', 'unit_price', 'cost', 'sku') },
  { name: 'dim_store', columns: cols('store_id', 'store_name', 'region_id', 'city', 'open_date', 'sq_footage', 'manager_id') },
  { name: 'dim_date', columns: cols('date_id', 'full_date', 'day', 'month', 'quarter', 'year', 'week_of_year', 'is_weekend', 'is_holiday') },
  { name: 'dim_region', columns: cols('region_id', 'region_name', 'country_id', 'zone', 'timezone') },
  { name: 'dim_country', columns: cols('country_id', 'country_name', 'iso_code', 'continent', 'currency_id') },
  { name: 'dim_category', columns: cols('category_id', 'category_name', 'department', 'margin_target') },
  { name: 'dim_supplier', columns: cols('supplier_id', 'supplier_name', 'country_id', 'lead_time_days', 'rating') },
  { name: 'dim_employee', columns: cols('employee_id', 'full_name', 'role', 'store_id', 'hire_date', 'manager_id') },
  { name: 'dim_promotion', columns: cols('promotion_id', 'promotion_name', 'discount_pct', 'starts_on', 'ends_on') },
  { name: 'dim_channel', columns: cols('channel_id', 'channel_name', 'medium', 'is_digital') },
  { name: 'dim_currency', columns: cols('currency_id', 'currency_code', 'symbol', 'rate_to_usd') },
  { name: 'dim_warehouse', columns: cols('warehouse_id', 'warehouse_name', 'region_id', 'capacity', 'is_automated') },
  { name: 'dim_payment_method', columns: cols('payment_id', 'method_name', 'provider', 'is_instalment') },
  { name: 'dim_shipping_method', columns: cols('shipping_id', 'method_name', 'carrier', 'avg_days', 'cost_per_unit') },
  { name: 'dim_feedback', columns: cols('feedback_id', 'customer_id', 'rating', 'comment', 'feedback_date', 'channel_id') },

  // ---- In the connection, not yet in the model -------------------------
  // These are what the left pane offers to drag onto the canvas.
  { name: 'fact_web_events', columns: cols('event_id', 'customer_id', 'session_id', 'event_type', 'occurred_at', 'device_id', 'page_url') },
  { name: 'fact_support_tickets', columns: cols('ticket_id', 'customer_id', 'opened_at', 'closed_at', 'priority', 'channel_id', 'resolved') },
  { name: 'dim_campaign', columns: cols('campaign_id', 'campaign_name', 'medium', 'budget', 'starts_on', 'ends_on') },
  { name: 'dim_device', columns: cols('device_id', 'device_type', 'os', 'browser', 'is_mobile') },
  { name: 'dim_loyalty_tier', columns: cols('tier_id', 'tier_name', 'min_spend', 'discount_pct', 'perks') },
]

/** The tables the model starts with — everything the joins reference. */
const MODEL_TABLE_NAMES = new Set(
  DATASOURCE_TABLES.slice(0, DATASOURCE_TABLES.length - 5).map((t) => t.name),
)
const MODEL_TABLES = DATASOURCE_TABLES.filter((t) => MODEL_TABLE_NAMES.has(t.name))

const join = (n, leftTable, leftCol, rightTable, rightCol) => ({
  name: `Join ${n}`,
  desc: `${leftTable} → ${rightTable}`,
  leftTable,
  leftCol,
  cardinality: 'Many : 1',
  rightTable,
  rightCol,
})

const JOIN_SPECS = [
  // fact_sales — the busiest hub
  ['fact_sales', 'customer_id', 'dim_customer', 'customer_id'],
  ['fact_sales', 'product_id', 'dim_product', 'product_id'],
  ['fact_sales', 'store_id', 'dim_store', 'store_id'],
  ['fact_sales', 'date_id', 'dim_date', 'date_id'],
  ['fact_sales', 'employee_id', 'dim_employee', 'employee_id'],
  ['fact_sales', 'promotion_id', 'dim_promotion', 'promotion_id'],
  ['fact_sales', 'channel_id', 'dim_channel', 'channel_id'],
  ['fact_sales', 'payment_id', 'dim_payment_method', 'payment_id'],
  // other facts
  ['fact_new_retail_sales', 'customer_id', 'dim_customer', 'customer_id'],
  ['fact_new_retail_sales', 'product_id', 'dim_product', 'product_id'],
  ['fact_new_retail_sales', 'store_id', 'dim_store', 'store_id'],
  ['fact_inventory', 'product_id', 'dim_product', 'product_id'],
  ['fact_inventory', 'warehouse_id', 'dim_warehouse', 'warehouse_id'],
  ['fact_inventory', 'date_id', 'dim_date', 'date_id'],
  ['fact_sales_pipeline', 'customer_id', 'dim_customer', 'customer_id'],
  ['fact_sales_pipeline', 'employee_id', 'dim_employee', 'employee_id'],
  ['fact_customer_satisfaction', 'customer_id', 'dim_customer', 'customer_id'],
  ['fact_customer_satisfaction', 'channel_id', 'dim_channel', 'channel_id'],
  ['fact_returns', 'product_id', 'dim_product', 'product_id'],
  ['fact_returns', 'customer_id', 'dim_customer', 'customer_id'],
  ['fact_shipments', 'shipping_id', 'dim_shipping_method', 'shipping_id'],
  ['fact_shipments', 'warehouse_id', 'dim_warehouse', 'warehouse_id'],
  // snowflake: dimensions hanging off dimensions
  ['dim_store', 'region_id', 'dim_region', 'region_id'],
  ['dim_region', 'country_id', 'dim_country', 'country_id'],
  ['dim_product', 'category_id', 'dim_category', 'category_id'],
  ['dim_product', 'supplier_id', 'dim_supplier', 'supplier_id'],
  ['dim_customer', 'country_id', 'dim_country', 'country_id'],
  ['dim_warehouse', 'region_id', 'dim_region', 'region_id'],
  ['dim_country', 'currency_id', 'dim_currency', 'currency_id'],
  ['dim_feedback', 'customer_id', 'dim_customer', 'customer_id'],
]

export const INITIAL_MODEL = {
  tables: MODEL_TABLES.map((t) => ({ name: t.name, desc: '' })),
  joins: JOIN_SPECS.map((spec, i) => join(i + 1, ...spec)),
  // Half the columns of each table are in the model, so the counts look real.
  columns: MODEL_TABLES.map((t) => ({
    table: t.name,
    columns: t.columns.slice(0, Math.ceil(t.columns.length / 2)),
  })),
  formulas: [
    { name: 'Total Revenue', code: 'SUM(fact_sales.amount)' },
    { name: 'Return Rate', code: 'COUNT(fact_returns.return_id) / COUNT(fact_sales.sale_id)' },
    { name: 'Average Order Value', code: 'SUM(fact_sales.amount) / COUNT(DISTINCT fact_sales.sale_id)' },
  ],
}

export const MODEL_META = {
  name: 'Enterprise Retail Analytics',
  desc: 'Fact constellation with snowflaked dimensions — 23 tables, 30 joins',
  connection: 'Global sales connection',
}
