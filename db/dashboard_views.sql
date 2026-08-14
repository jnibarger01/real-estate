-- Dashboard API contract views (api.* application boundary)
-- Run as a role with privileges to query mart.* and raw.*.

-- 1. Global summary KPIs
CREATE OR REPLACE VIEW api.dashboard_summary AS
WITH res AS (
    SELECT
        m.parcel_id,
        m.market_value_total,
        NULLIF((a.payload->>'tot_sqf_l_area')::numeric, 0) AS living_area
    FROM mart.residential_properties m
    JOIN raw.assessments a
      ON m.property_id = (a.payload->>'property_id')::int
)
SELECT
    COUNT(*)                                              AS total_properties,
    (SELECT COUNT(DISTINCT situs_city) FROM mart.residential_properties) AS distinct_cities,
    (SELECT COUNT(DISTINCT situs_zip) FROM mart.residential_properties)           AS distinct_zips,
    ROUND(AVG(market_value_total)::numeric, 0)::bigint    AS avg_market_value,
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY market_value_total)::numeric, 0)::bigint AS median_market_value,
    SUM(market_value_total)                               AS total_market_value,
    MAX(market_value_total)                               AS max_market_value,
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY living_area)::numeric, 0)::bigint AS median_sqft,
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY market_value_total::numeric / NULLIF(living_area::numeric, 0))::numeric, 0)::bigint AS median_price_per_sqft,
    COUNT(*) FILTER (WHERE living_area IS NOT NULL)       AS with_sqft,
    COUNT(*) FILTER (WHERE market_value_total > 0 AND market_value_total <= 1000000) AS under_1m,
    (SELECT COUNT(*) FROM mart.residential_properties WHERE market_value_total > 1000000) AS over_1m
FROM res;

-- 2. Value distribution histogram (0..1M in 20 buckets)
CREATE OR REPLACE VIEW api.dashboard_value_distribution AS
SELECT
    width_bucket(market_value_total, 0, 1000000, 20) AS bucket,
    (width_bucket(market_value_total, 0, 1000000, 20) - 1) * 50000 AS bucket_min,
    width_bucket(market_value_total, 0, 1000000, 20) * 50000 AS bucket_max,
    COUNT(*) AS property_count
FROM mart.residential_properties
WHERE market_value_total IS NOT NULL
GROUP BY bucket, bucket_min, bucket_max
ORDER BY bucket;

-- 3. Year-over-year value trend from raw.assessments historical payload
CREATE OR REPLACE VIEW api.dashboard_value_trends AS
WITH joined AS (
    SELECT
        (a.payload->>'property_id')::int      AS property_id,
        NULLIF((a.payload->>'Market_Value_Total')::numeric, 0)         AS v2024,
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
    SELECT 2024 AS year, ROUND(AVG(v2024)::numeric,0)::bigint AS avg_market_value,
           SUM(v2024) AS total_market_value,
           COUNT(*) FILTER (WHERE v2024 IS NOT NULL) AS property_count
    FROM joined
    UNION ALL
    SELECT 2023, ROUND(AVG(v2023)::numeric,0), SUM(v2023),
           COUNT(*) FILTER (WHERE v2023 IS NOT NULL)
    FROM joined
    UNION ALL
    SELECT 2022, ROUND(AVG(v2022)::numeric,0), SUM(v2022),
           COUNT(*) FILTER (WHERE v2022 IS NOT NULL)
    FROM joined
    UNION ALL
    SELECT 2021, ROUND(AVG(v2021)::numeric,0), SUM(v2021),
           COUNT(*) FILTER (WHERE v2021 IS NOT NULL)
    FROM joined
    UNION ALL
    SELECT 2020, ROUND(AVG(v2020)::numeric,0), SUM(v2020),
           COUNT(*) FILTER (WHERE v2020 IS NOT NULL)
    FROM joined
) t
ORDER BY year;

-- 4. Property type mix
CREATE OR REPLACE VIEW api.dashboard_property_types AS
SELECT
    landuse_code              AS code,
    landuse_description       AS label,
    COUNT(*)                  AS property_count,
    ROUND(AVG(market_value_total)::numeric, 0)::bigint  AS avg_market_value,
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY market_value_total)::numeric, 0)::bigint AS median_market_value,
    ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) AS pct
FROM mart.residential_properties
WHERE landuse_code IS NOT NULL
GROUP BY landuse_code, landuse_description
ORDER BY property_count DESC;

-- 5. Property explorer / search list (no geometry; used for tabular results)
CREATE OR REPLACE VIEW api.dashboard_property_search AS
SELECT
    m.parcel_id,
    m.property_id,
    m.apn_display,
    m.parcel_number,
    m.situs_address,
    m.situs_city,
    m.situs_zip,
    m.landuse_code,
    m.landuse_description,
    m.year_built,
    m.stories,
    m.bedrooms,
    m.full_baths,
    m.half_baths,
    m.total_sqft,
    NULLIF((a.payload->>'tot_sqf_l_area')::numeric, 0)::int AS living_area,
    m.tax_year,
    m.assessed_value_total,
    m.market_value_total,
    m.owner_info,
    m.owner_mailing_address,
    ST_X(ST_Centroid(m.geom)) AS lng,
    ST_Y(ST_Centroid(m.geom)) AS lat
FROM mart.residential_properties m
LEFT JOIN raw.assessments a
  ON m.property_id = (a.payload->>'property_id')::int;

-- 6. Map features (used by /api/map/properties with a bbox filter).
-- Combines per-parcel market value with lightweight geometry columns.
CREATE OR REPLACE VIEW api.dashboard_map_properties AS
SELECT
    m.parcel_id,
    m.property_id,
    m.apn_display,
    m.situs_address,
    m.situs_city,
    m.situs_zip,
    m.landuse_code,
    m.landuse_description,
    m.market_value_total,
    NULLIF((a.payload->>'tot_sqf_l_area')::numeric, 0)::int AS living_area,
    m.year_built,
    m.geom
FROM mart.residential_properties m
LEFT JOIN raw.assessments a
  ON m.property_id = (a.payload->>'property_id')::int;

GRANT SELECT ON api.dashboard_summary             TO public;
GRANT SELECT ON api.dashboard_value_distribution  TO public;
GRANT SELECT ON api.dashboard_value_trends        TO public;
GRANT SELECT ON api.dashboard_property_types      TO public;
GRANT SELECT ON api.dashboard_property_search     TO public;
GRANT SELECT ON api.dashboard_map_properties      TO public;