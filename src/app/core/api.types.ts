/** Envelope contract for the CostScope Cost API (verified live 2026-07-11). */

export type ApiErrorCode = 'VALIDATION_ERROR' | 'UPSTREAM_ERROR' | 'UNHEALTHY';

export interface ApiErrorBody {
  code: ApiErrorCode;
  message: string;
}

export interface Freshness {
  data_through: string;
  loaded_at: string;
}

export interface EnvelopeMeta {
  freshness?: Freshness;
  dimension?: string;
  page?: number;
  limit?: number;
  [key: string]: unknown;
}

/** `data` is an array for list endpoints, an object for /freshness and /healthz. */
export interface Envelope<T> {
  data: T | null;
  meta: EnvelopeMeta;
  error: ApiErrorBody | null;
}

/** Costs are decimal strings from ClickHouse — parse only at display/chart boundary. */
export type CostString = string;

export interface SummaryRow {
  currency: string;
  cost: CostString;
  resources: number;
  line_items: number;
}

export interface TimeseriesRow {
  bucket: string;
  currency: string;
  cost: CostString;
}

export interface BreakdownRow {
  dimension_value: string;
  currency: string;
  cost: CostString;
  resources: number;
  series?: BreakdownSeriesPoint[];
}

export interface BreakdownSeriesPoint {
  date: string;
  cost: CostString;
}

export interface ResourceRow {
  ocid: string;
  resource_name: string;
  service: string;
  compartment: string;
  region: string;
  environment: string;
  cost_center: string;
  component_type: string;
  resource_type: string;
  currency: string;
  cost: CostString;
  /** Full result count, repeated on every row — drives pagination. */
  total: number;
}

export interface ResourceDetail {
  ocid: string;
  resource_name: string;
  description: string;
  service: string;
  compartment_id: string;
  compartment: string;
  region: string;
  availability_domain: string;
  environment: string;
  cost_center: string;
  component_type: string;
  resource_type: string;
  currency: string;
  cost: CostString;
  first_seen: string;
  last_seen: string;
}

export interface LineItemsRow {
  bucket: string;
  currency: string;
  cost: CostString;
  my_cost: CostString;
  line_items: number;
  overage_items: number;
}

export interface NamedSeries {
  name: string;
  rows: TimeseriesRow[];
}

/** Aggregate payload of /v1/costs/exec-summary — everything the summary page renders. */
export interface ExecSummary {
  summary: SummaryRow[];
  monthly: TimeseriesRow[];
  cost_centers: BreakdownRow[];
  environments: BreakdownRow[];
  top_breakdown: BreakdownRow[];
  top_series: NamedSeries[];
  /** Best-effort: null when the freshness query failed server-side. */
  freshness: Freshness | null;
}

export interface FiltersRow {
  environments: string[];
  cost_centers: string[];
  component_types: string[];
  compartments: string[];
  services: string[];
  resource_types: string[];
  resource_names: string[];
}

export type Granularity = 'hour' | 'day' | 'week' | 'month';

/** Analysis endpoints return statistical amounts as JSON numbers, not ledger decimal strings. */
export interface AnomalyRow {
  dimension_value: string;
  currency: string;
  day: string;
  cost: number;
  baseline: number;
  deviation: number;
  z_score: number;
  severity: 'warning' | 'critical';
  direction: 'spike' | 'drop';
}

export interface TrendMoverRow {
  dimension_value: string;
  currency: string;
  current_cost: number | null;
  previous_cost: number | null;
  change_amount: number | null;
  change_pct: number | null;
  slope: number | null;
  direction: 'rising' | 'falling' | 'flat' | 'new' | 'gone';
}

export interface AnomalyOptions {
  window?: number;
  minZ?: number;
  minImpact?: number;
}

export interface TrendMoversOptions {
  granularity?: Exclude<Granularity, 'hour'>;
}

export type Dimension =
  | 'service'
  | 'compartment'
  | 'environment'
  | 'cost_center'
  | 'component_type'
  | 'resource_type'
  | 'resource_name';

/** Dimensions supported by the server-grouped Resources table. */
export type GroupedResourceDimension = Dimension | 'period';

export const GROUPED_DIMENSION_LABELS: Record<GroupedResourceDimension, string> = {
  service: 'Service',
  compartment: 'Compartment',
  environment: 'Environment',
  cost_center: 'Cost Center',
  component_type: 'Component Type',
  resource_type: 'Resource Type',
  resource_name: 'Resource Name',
  period: 'Period',
};

export interface GroupedResourceGroupRow {
  kind: 'group' | 'other';
  depth: number;
  group_value: string;
  currency: string;
  subtotal_cost: CostString;
  row_count: number;
}

export interface GroupedResourceLeafRow {
  kind: 'leaf';
  period: string;
  environment: string;
  cost_center: string;
  component_type: string;
  compartment: string;
  service: string;
  resource_type: string;
  resource_name: string;
  ocid: string;
  currency: string;
  cost: CostString;
}

export type GroupedResourceRow = GroupedResourceGroupRow | GroupedResourceLeafRow;

/** Shared query params. Dimension filter keys match API param names. */
export interface CostQuery {
  start?: string;
  end?: string;
  env?: string;
  cost_center?: string;
  component_type?: string;
  compartment?: string;
  service?: string;
  resource_type?: string;
  resource_name?: string;
  ocid?: string;
}

/** Typed error surfaced to panels. */
export class ApiError extends Error {
  constructor(
    readonly code: ApiErrorCode | 'HTTP_ERROR',
    message: string,
  ) {
    super(message);
  }
}
