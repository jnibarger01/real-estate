-- DEPRECATED. Do not apply. Canonical contract is sql/api_dashboard_views.sql
-- (api.dashboard_*). This file is retained only as historical reference.
-- Durable mart.dashboard_* contract. API handlers SELECT from these only.
-- Safe to re-run. Requires PostGIS and mart.residential_properties.

CREATE SCHEMA IF NOT EXISTS mart;
CREATE SCHEMA IF NOT EXISTS api;

-- ---------------------------------------------------------------------------
-- Search / detail / map: thin projections over the residential mart.
-- No join to raw.assessments so GiST bbox plans stay index-backed.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW mart.dashboard_property_search AS
SELECT
    parcel_id,
    property_id,
    apn_display,
    parcel_number,
    situs_address,
    situs_city,
    situs_zip,
    landuse_code,
    landuse_description,
    year_built,
    stories,
    bedrooms,
    full_baths,
    half_baths,
    total_sqft,
    total_sqft AS living_area,
    tax_year,
    assessed_value_total,
    market_value_total,
    owner_info,
    owner_mailing_address,
    ST_X(ST_Centroid(geom)) AS lng,
    ST_Y(ST_Centroid(geom)) AS lat
FROM mart.residential_properties;

CREATE OR REPLACE VIEW mart.dashboard_property_detail AS
SELECT
    parcel_id,
    property_id,
    apn_display,
    parcel_number,
    situs_address,
    situs_city,
    situs_zip,
    landuse_code,
    landuse_description,
    year_built,
    stories,
    bedrooms,
    full_baths,
    half_baths,
    total_sqft,
    total_sqft AS living_area,
    tax_year,
    assessed_value_total,
    market_value_total,
    owner_info,
    owner_mailing_address,
    ST_X(ST_Centroid(geom)) AS lng,
    ST_Y(ST_Centroid(geom)) AS lat,
    ST_AsGeoJSON(geom, 6)::jsonb AS geometry,
    ST_AsGeoJSON(ST_Centroid(geom), 6)::jsonb AS centroid
FROM mart.residential_properties;

CREATE OR REPLACE VIEW mart.dashboard_map_properties AS
SELECT
    parcel_id,
    property_id,
    apn_display,
    situs_address,
    situs_city,
    situs_zip,
    landuse_code,
    landuse_description,
    market_value_total,
    assessed_value_total,
    total_sqft AS living_area,
    year_built,
    geom,
    ST_Centroid(geom) AS centroid
FROM mart.residential_properties
WHERE geom IS NOT NULL;

-- ---------------------------------------------------------------------------
-- KPIs
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW mart.dashboard_summary AS
SELECT
    COUNT(*)::bigint AS property_count,
    COUNT(*)::bigint AS total_properties,
    COUNT(DISTINCT situs_city)::bigint AS distinct_cities,
    COUNT(DISTINCT situs_zip)::bigint AS distinct_zips,
    ROUND(AVG(market_value_total)::numeric, 0)::bigint AS avg_value,
    ROUND(AVG(market_value_total)::numeric, 0)::bigint AS avg_market_value,
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY market_value_total)::numeric, 0)::bigint AS median_value,
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY market_value_total)::numeric, 0)::bigint AS median_market_value,
    COALESCE(SUM(assessed_value_total), 0)::bigint AS total_assessed_value,
    COALESCE(SUM(market_value_total), 0)::bigint AS total_market_value,
    MAX(market_value_total)::bigint AS max_market_value,
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY total_sqft)::numeric, 0)::bigint AS median_sqft,
    ROUND(
        PERCENTILE_CONT(0.5) WITHIN GROUP (
            ORDER BY market_value_total::numeric / NULLIF(total_sqft::numeric, 0)
        )::numeric,
        0
    )::bigint AS median_price_per_sqft,
    COUNT(*) FILTER (WHERE total_sqft IS NOT NULL)::bigint AS with_sqft,
    COUNT(*) FILTER (WHERE market_value_total > 0 AND market_value_total <= 1000000)::bigint AS under_1m,
    COUNT(*) FILTER (WHERE market_value_total > 1000000)::bigint AS over_1m
FROM mart.residential_properties;

-- ---------------------------------------------------------------------------
-- Assessment-year value series (not market sales). Years come from payload.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW mart.dashboard_value_trends AS
WITH joined AS (
    SELECT
        NULLIF((a.payload->>'Market_Value_Total')::numeric, 0) AS v2024,
        NULLIF((a.payload->>'Market_Value_Total_pastyr1')::numeric, 0) AS v2023,
        NULLIF((a.payload->>'Market_Value_Total_pastyr2')::numeric, 0) AS v2022,
        NULLIF((a.payload->>'Market_Value_Total_pastyr3')::numeric, 0) AS v2021,
        NULLIF((a.payload->>'Market_Value_Total_pastyr4')::numeric, 0) AS v2020
    FROM raw.assessments a
    JOIN mart.residential_properties m
      ON m.property_id = (a.payload->>'property_id')::int
)
SELECT year, avg_market_value, total_market_value, property_count
FROM (
    SELECT 2024 AS year,
           ROUND(AVG(v2024)::numeric, 0)::bigint AS avg_market_value,
           SUM(v2024)::bigint AS total_market_value,
           COUNT(*) FILTER (WHERE v2024 IS NOT NULL)::bigint AS property_count
    FROM joined
    UNION ALL
    SELECT 2023, ROUND(AVG(v2023)::numeric, 0)::bigint, SUM(v2023)::bigint,
           COUNT(*) FILTER (WHERE v2023 IS NOT NULL)::bigint FROM joined
    UNION ALL
    SELECT 2022, ROUND(AVG(v2022)::numeric, 0)::bigint, SUM(v2022)::bigint,
           COUNT(*) FILTER (WHERE v2022 IS NOT NULL)::bigint FROM joined
    UNION ALL
    SELECT 2021, ROUND(AVG(v2021)::numeric, 0)::bigint, SUM(v2021)::bigint,
           COUNT(*) FILTER (WHERE v2021 IS NOT NULL)::bigint FROM joined
    UNION ALL
    SELECT 2020, ROUND(AVG(v2020)::numeric, 0)::bigint, SUM(v2020)::bigint,
           COUNT(*) FILTER (WHERE v2020 IS NOT NULL)::bigint FROM joined
) t
ORDER BY year;

-- ---------------------------------------------------------------------------
-- Distributions
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW mart.dashboard_property_types AS
SELECT
    landuse_code AS code,
    COALESCE(NULLIF(landuse_description, ''), 'Unknown') AS label,
    COUNT(*)::bigint AS property_count,
    ROUND(AVG(market_value_total)::numeric, 0)::bigint AS avg_market_value,
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY market_value_total)::numeric, 0)::bigint AS median_market_value,
    ROUND(100.0 * COUNT(*) / NULLIF(SUM(COUNT(*)) OVER (), 0), 2) AS pct
FROM mart.residential_properties
WHERE landuse_code IS NOT NULL
GROUP BY landuse_code, landuse_description
ORDER BY property_count DESC;

CREATE OR REPLACE VIEW mart.dashboard_value_bands AS
SELECT
    width_bucket(COALESCE(market_value_total, 0), 0, 1000000, 20) AS bucket,
    (width_bucket(COALESCE(market_value_total, 0), 0, 1000000, 20) - 1) * 50000 AS bucket_min,
    width_bucket(COALESCE(market_value_total, 0), 0, 1000000, 20) * 50000 AS bucket_max,
    COUNT(*)::bigint AS property_count
FROM mart.residential_properties
WHERE market_value_total IS NOT NULL
GROUP BY 1, 2, 3
ORDER BY 1;

CREATE OR REPLACE VIEW mart.dashboard_assessment_classes AS
SELECT
    CASE
        WHEN landuse_code LIKE '11%' THEN 'residential'
        WHEN landuse_code LIKE '12%' THEN 'residential_other'
        WHEN landuse_code LIKE '21%' THEN 'multifamily'
        ELSE 'other'
    END AS code,
    CASE
        WHEN landuse_code LIKE '11%' THEN 'Residential'
        WHEN landuse_code LIKE '12%' THEN 'Residential (other)'
        WHEN landuse_code LIKE '21%' THEN 'Multifamily'
        ELSE 'Other'
    END AS label,
    COUNT(*)::bigint AS property_count,
    ROUND(AVG(market_value_total)::numeric, 0)::bigint AS avg_market_value,
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY market_value_total)::numeric, 0)::bigint AS median_market_value,
    ROUND(100.0 * COUNT(*) / NULLIF(SUM(COUNT(*)) OVER (), 0), 2) AS pct
FROM mart.residential_properties
GROUP BY 1, 2
ORDER BY property_count DESC;

-- ---------------------------------------------------------------------------
-- Recording references only — not market sales.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW mart.dashboard_transfers AS
SELECT
    m.property_id,
    m.parcel_id,
    m.parcel_number,
    m.situs_address,
    m.situs_city,
    m.tax_year,
    NULLIF(a.payload->>'recording_num', '') AS recording_num
FROM mart.residential_properties m
JOIN raw.assessments a
  ON m.property_id = (a.payload->>'property_id')::int
WHERE NULLIF(a.payload->>'recording_num', '') IS NOT NULL;

-- ---------------------------------------------------------------------------
-- api.* wrappers keep the previous application boundary.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW api.dashboard_summary AS
SELECT * FROM mart.dashboard_summary;

CREATE OR REPLACE VIEW api.dashboard_value_distribution AS
SELECT * FROM mart.dashboard_value_bands;

CREATE OR REPLACE VIEW api.dashboard_value_trends AS
SELECT * FROM mart.dashboard_value_trends;

CREATE OR REPLACE VIEW api.dashboard_property_types AS
SELECT * FROM mart.dashboard_property_types;

CREATE OR REPLACE VIEW api.dashboard_property_search AS
SELECT * FROM mart.dashboard_property_search;

CREATE OR REPLACE VIEW api.dashboard_map_properties AS
SELECT
    parcel_id,
    property_id,
    apn_display,
    situs_address,
    situs_city,
    situs_zip,
    landuse_code,
    landuse_description,
    market_value_total,
    living_area,
    year_built,
    geom
FROM mart.dashboard_map_properties;

GRANT SELECT ON mart.dashboard_property_search TO PUBLIC;
GRANT SELECT ON mart.dashboard_property_detail TO PUBLIC;
GRANT SELECT ON mart.dashboard_map_properties TO PUBLIC;
GRANT SELECT ON mart.dashboard_summary TO PUBLIC;
GRANT SELECT ON mart.dashboard_value_trends TO PUBLIC;
GRANT SELECT ON mart.dashboard_property_types TO PUBLIC;
GRANT SELECT ON mart.dashboard_value_bands TO PUBLIC;
GRANT SELECT ON mart.dashboard_assessment_classes TO PUBLIC;
GRANT SELECT ON mart.dashboard_transfers TO PUBLIC;
GRANT SELECT ON api.dashboard_summary TO PUBLIC;
GRANT SELECT ON api.dashboard_value_distribution TO PUBLIC;
GRANT SELECT ON api.dashboard_value_trends TO PUBLIC;
GRANT SELECT ON api.dashboard_property_types TO PUBLIC;
GRANT SELECT ON api.dashboard_property_search TO PUBLIC;
GRANT SELECT ON api.dashboard_map_properties TO PUBLIC;
