-- Dashboard contract views. All dashboard endpoints read only from these.
CREATE SCHEMA IF NOT EXISTS mart;

CREATE OR REPLACE VIEW mart.dashboard_property_summary AS
SELECT
    COUNT(*)::bigint AS total_properties,
    AVG(market_value_total)::float8 AS avg_estimated_value,
    SUM(market_value_total)::float8 AS total_estimated_value,
    AVG(assessed_value_total)::float8 AS avg_assessed_value,
    AVG(total_sqft)::float8 AS avg_sqft,
    COUNT(DISTINCT situs_city)::bigint AS city_count
FROM mart.residential_export;

CREATE OR REPLACE VIEW mart.dashboard_value_distribution AS
SELECT
    (width_bucket(market_value_total::numeric, 0, 1000000, 20) * 50000) AS bucket_upper,
    COUNT(*)::bigint AS property_count
FROM mart.residential_export
WHERE market_value_total IS NOT NULL AND market_value_total BETWEEN 0 AND 1000000
GROUP BY 1
ORDER BY 1;

CREATE OR REPLACE VIEW mart.dashboard_property_types AS
SELECT
    COALESCE(NULLIF(landuse_description, ''), 'Unknown') AS landuse_description,
    COUNT(*)::bigint AS property_count,
    AVG(market_value_total)::float8 AS avg_market_value
FROM mart.residential_export
GROUP BY 1
ORDER BY 2 DESC;

CREATE OR REPLACE VIEW mart.dashboard_city_breakdown AS
SELECT
    COALESCE(NULLIF(situs_city, ''), 'Unincorporated') AS situs_city,
    COUNT(*)::bigint AS property_count,
    AVG(market_value_total)::float8 AS avg_market_value,
    SUM(market_value_total)::float8 AS total_market_value
FROM mart.residential_export
GROUP BY 1
ORDER BY 2 DESC;
