-- Materialized dashboard aggregates for the heavy full-table aggregations.
-- Data is static between Jackson County ingests, so these are refreshed
-- after each ingest rather than computed on every dashboard request.

CREATE MATERIALIZED VIEW IF NOT EXISTS api.dashboard_summary_mv AS
WITH res AS (
    SELECT
        m.market_value_total,
        m.situs_city,
        m.situs_zip,
        NULLIF((a.payload->>'tot_sqf_l_area')::numeric, 0) AS living_area
    FROM mart.residential_properties m
    JOIN raw.assessments a
      ON m.property_id = (a.payload->>'property_id')::int
)
SELECT
    COUNT(*)                                              AS total_properties,
    COUNT(DISTINCT situs_city)                            AS distinct_cities,
    COUNT(DISTINCT situs_zip)                             AS distinct_zips,
    ROUND(AVG(market_value_total)::numeric, 0)::bigint    AS avg_market_value,
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY market_value_total)::numeric, 0)::bigint AS median_market_value,
    SUM(market_value_total)                               AS total_market_value,
    MAX(market_value_total)                               AS max_market_value,
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY living_area)::numeric, 0)::bigint AS median_sqft,
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY market_value_total::numeric / NULLIF(living_area::numeric, 0))::numeric, 0)::bigint AS median_price_per_sqft,
    COUNT(*) FILTER (WHERE living_area IS NOT NULL)       AS with_sqft,
    COUNT(*) FILTER (WHERE market_value_total > 0 AND market_value_total <= 1000000) AS under_1m,
    COUNT(*) FILTER (WHERE market_value_total > 1000000)  AS over_1m
FROM res;

CREATE MATERIALIZED VIEW IF NOT EXISTS api.dashboard_value_trends_mv AS
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

GRANT SELECT ON api.dashboard_summary_mv       TO public;
GRANT SELECT ON api.dashboard_value_trends_mv  TO public;