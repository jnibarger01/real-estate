-- Dashboard contract views (Jackson County Property Intelligence)
-- Owned by dashboard schema; read-only mart.* re-export so the API never touches raw tables.

CREATE SCHEMA IF NOT EXISTS dashboard;

CREATE OR REPLACE VIEW dashboard.dashboard_property_summary AS
SELECT
    COUNT(*)::bigint                        AS total_properties,
    ROUND(AVG(market_value_total))::bigint  AS avg_estimated_value,
    ROUND(SUM(market_value_total))::bigint  AS total_estimated_value,
    ROUND(AVG(total_sqft))::bigint          AS avg_sqft,
    COUNT(DISTINCT situs_city)::bigint      AS city_count
FROM mart.residential_export;

CREATE OR REPLACE VIEW dashboard.dashboard_value_distribution AS
SELECT
    (width_bucket(market_value_total::numeric, 0, 1000000, 20) * 50000)::bigint AS bucket_upper,
    COUNT(*)::bigint AS property_count
FROM mart.residential_export
WHERE market_value_total IS NOT NULL
  AND market_value_total BETWEEN 0 AND 1000000
GROUP BY 1
ORDER BY 1;

CREATE OR REPLACE VIEW dashboard.dashboard_property_types AS
SELECT
    COALESCE(NULLIF(landuse_description, ''), 'Unknown') AS landuse_description,
    COUNT(*)::bigint AS property_count,
    ROUND(AVG(market_value_total))::bigint AS avg_market_value,
    ROUND(SUM(market_value_total))::bigint  AS total_market_value
FROM mart.residential_export
GROUP BY 1
ORDER BY 2 DESC;

CREATE OR REPLACE VIEW dashboard.dashboard_map_properties AS
SELECT
    parcel_id,
    situs_address,
    situs_city,
    market_value_total::bigint AS value,
    total_sqft,
    ST_AsGeoJSON(geom)::json AS geometry
FROM mart.residential_export
WHERE geom IS NOT NULL;
