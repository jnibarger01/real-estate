# jacen_dev database contract

Source of truth: `db_schema_dump.sql` (pg_dump 16.14) plus live inspection of `jacen_dev`.
Do not invent tables, sale prices, or time-series that are not listed here.

## Schemas

| Schema | Role |
|---|---|
| `raw` | Verbatim ingest. Application code must not query it except via mart/api views. |
| `core` | Normalized parcels, properties, and the join table. |
| `mart` | Materialized joins, residential subset, export table. |
| `api` | **The API contract.** Created by `sql/api_dashboard_views.sql`. |
| `dashboard` | Deprecated experimental schema. Not applied. Not read. |

No `dashboard_*` objects exist in the dump. Apply `sql/api_dashboard_views.sql` (or `bin/create-dashboard-contract.sh`) after the dump. Do not apply `sql/mart_dashboard_views.sql`, `sql/dashboard_*.sql`, or `db/dashboard_*.sql`.

## raw

### `raw.parcels`
Primary key: `ogc_fid`. Geometry: `geometry(MultiPolygon,4326)`.
Notable columns: `objectid`, `name`, `propertyid`, `parcel_id`, `geom`, district fields (`school`, `tca`, `tifdistrict`, …).
Indexes: `parcels_test_pkey (ogc_fid)`, `parcels_objectid_uidx`, `parcels_parcel_id_idx`, `parcels_propertyid_idx`, `parcels_geom_gix`, `parcels_test_geom_geom_idx`.

### `raw.assessments`
Single column: `payload jsonb NOT NULL`. No primary key in the dump.
Live payload keys include current and four prior tax years of market/assessed/taxable values (`Market_Value_Total`, `Market_Value_Total_pastyr1`…`pastyr4`, matching `tax_year*`), owner (`owner_info`, `address_compl`), building attrs, and `recording_num`.
**There is no sale price, sale date, or deed-consideration field.** `recording_num` is an assessor instrument reference only.

## core

### `core.parcels`
PK: `parcel_id varchar`. Geometry: `geometry(MultiPolygon,4326)`.
Columns: `apn_display`, `source_feature_count`, `property_count`, `geom`.
Index: `core_parcels_geom_gix` (GiST).

### `core.properties`
PK: `property_id integer`.
Columns: `parcel_number`, `situs_address`, `situs_city`, `situs_zip`, `landuse_code`, `landuse_description`, `year_built`, `stories`, `bedrooms`, `full_baths`, `half_baths`, `total_sqft`, `tax_year` (text), `assessed_value_total`, `market_value_total`, `source_payload jsonb`.
Indexes: landuse, parcel_number, zip.

### `core.parcel_properties`
Columns: `parcel_id`, `property_id`. Unique `(parcel_id, property_id)`. Index on `property_id`. No formal FK constraints in the dump.

## mart

### `mart.property_parcels` (materialized view)
Join of `core.parcel_properties` + `core.parcels` + `core.properties`.
Adds `owner_info` and `owner_mailing_address` from `source_payload`. Includes `geom`.
Unique `(parcel_id, property_id)`. GiST on `geom`. btree on landuse, property_id, zip.

### `mart.residential_properties` (materialized view)
Residential land-use subset of `property_parcels`:
`1110, 1111, 1112, 1120, 1130, 1140, 1150, 1160, 1108, 1109`.
Same unique/GiST/btree indexes as above.

### `mart.residential_export` (table)
Persisted copy of the residential materialized view. PK `(parcel_id, property_id)`. GiST on `geom`.

## Live row counts (verified)

| Object | Rows |
|---|---|
| `raw.parcels` | 311,110 |
| `raw.assessments` | 300,626 |
| `core.parcels` | 300,512 |
| `core.properties` | 300,626 |
| `core.parcel_properties` | 291,994 |
| `mart.residential_properties` | 233,174 |
| `mart.residential_export` | 233,174 |

PostGIS 3.4.2 is installed. Parcel geometry is WGS84 MultiPolygon. GiST bbox queries on `mart.residential_properties.geom` use `residential_properties_geom_gix` (no sequential scan).

## What the database does **not** contain

- MLS / market sale price, close date, or days-on-market
- A `sales` or `transfers` table
- UUID property identifiers (`property_id` is integer)
- Existing `mart.dashboard_*` objects in the dump (created by this repo)

## API contract views

Canonical script: `sql/api_dashboard_views.sql`. It `CREATE SCHEMA IF NOT EXISTS api` and defines every object `src/api/routes/dashboard.ts` queries.

Grants: `PUBLIC` is revoked on schema `api`. Role `dashboard_app` can SELECT all contract views, including owner PII. Role `dashboard_readonly` can SELECT aggregates/map/transfers only. The applying role is granted `dashboard_app` so local/CI connections keep working.

`api.dashboard_value_trends` and `api.dashboard_transfers` still join `raw.assessments` for prior-year JSON keys and `recording_num`. That is the only approved raw read until those fields are promoted into mart.

| View | Endpoint |
|---|---|
| `api.dashboard_summary` | `GET /api/dashboard/summary`; MCP `get_dashboard_summary` (`docs/MCP.md`) |
| `api.dashboard_property_search` | `GET /api/properties/search`, `GET /api/properties/export.csv` (non-PII columns by default; PII needs confirm + `dashboard_app`) |
| `api.dashboard_property_detail` | `GET /api/properties/:id` |
| `api.dashboard_value_trends` | `GET /api/market/trends` |
| `api.dashboard_transfers` | `GET /api/sales` |
| `api.dashboard_map_properties` | `GET /api/map/properties` (bbox ≤1°/axis; hard cap 5000 features; zoom selects centroid / simplified / full geom) |
| `api.dashboard_property_types` | `GET /api/dashboard/distributions?dimension=property_type` |
| `api.dashboard_value_bands` | `GET /api/dashboard/distributions?dimension=value_band` |
| `api.dashboard_assessment_classes` | `GET /api/dashboard/distributions?dimension=assessment_class` |
| `api.ingest_state` | `refreshed_at` + `ingest_freshness` on `GET /api/dashboard/summary`; also `GET /api/dashboard/ingest-freshness` |

`GET /api/sales` returns assessor `recording_num` rows only and labels them as recording references, not market sales.

## Authenticated app tables

| Table | Endpoint | Notes |
|---|---|---|
| `api.saved_searches` | `GET/POST/DELETE /api/dashboard/saved-searches` | Per-user filter bookmarks (`username`, `label`, `query_params` jsonb). No owner PII columns. Apply `sql/api_saved_searches.sql`. |
