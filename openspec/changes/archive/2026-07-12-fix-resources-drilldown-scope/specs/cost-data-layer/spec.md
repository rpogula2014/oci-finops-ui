## MODIFIED Requirements

### Requirement: Untagged value handling
Empty-string values returned by `/v1/costs/filters` SHALL be presented as "(untagged)" in dropdowns. Because the API ignores empty query params, the client SHALL translate a UI-side `""` filter value to the API sentinel `__untagged__` (which the API matches as dimension = '') on every request. Composite untagged labels returned by the API SHALL be rendered verbatim.

The `resource_name` dimension is an exception: the API SHALL resolve it as
`untagged · <product_service> · …<OCID tail>` whenever the resource-name tag is
empty — consistently across breakdown values, filter options, filter matching,
and the resources/detail queries — so `resource_name` never surfaces as `""`.
The composite label is a first-class filterable value: sending it back verbatim
as `resource_name` selects exactly the rows it aggregated. The `__untagged__`
sentinel therefore no longer applies to `resource_name` (the client has no `""`
value to translate).

`product_service` is used (not `product_description`, which is a SKU/charge
description with several values per OCID) because it is 1:1 per resource; the
OCID tail disambiguates resources sharing a service. A resource billed under
multiple services (observed only for tenancy-level charges on the tenancy OCID)
MAY appear as one bucket per service.

#### Scenario: Blank environment filter option
- **WHEN** the filters endpoint returns `""` in `environments`
- **THEN** the Environment dropdown shows "(untagged)" and selecting it sends `env=__untagged__`

#### Scenario: Untagged series is not the total
- **WHEN** a per-value timeseries is requested for the untagged bucket of a dimension
- **THEN** it returns only rows where that dimension is empty, never the unfiltered total

#### Scenario: Untagged resource name in breakdown
- **WHEN** breakdown by `resource_name` includes rows whose resource-name tag is empty
- **THEN** those rows return `untagged · <product_service> · …<OCID tail>` as the dimension value (one row per resource), not `""`

#### Scenario: Composite resource name round-trips as a filter
- **WHEN** the client sends a composite untagged `resource_name` value verbatim
- **THEN** the API matches exactly the rows aggregated under that breakdown value
