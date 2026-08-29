-- Application-boundary contract views (api.*).
-- jacen owns this schema. Equivalent mart.dashboard_* definitions live in
-- sql/mart_dashboard_views.sql and require CREATE on schema mart.

CREATE SCHEMA IF NOT EXISTS api;

CREATE OR REPLACE VIEW api.dashboard_property_search AS
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

CREATE OR REPLACE VIEW api.dashboard_property_detail AS
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
    assessed_value_total,
    total_sqft AS living_area,
    year_built,
    geom,
    ST_Centroid(geom) AS centroid
FROM mart.residential_properties
WHERE geom IS NOT NULL;

CREATE OR REPLACE VIEW api.dashboard_summary AS
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

CREATE TABLE IF NOT EXISTS mart.assessment_year_values (
    property_id integer NOT NULL,
    year integer NOT NULL,
    market_value numeric,
    PRIMARY KEY (property_id, year)
);

CREATE TABLE IF NOT EXISTS mart.transfer_recordings (
    property_id integer NOT NULL,
    recording_num text NOT NULL,
    PRIMARY KEY (property_id, recording_num)
);

-- Trend years come from mart.assessment_year_values (promoted off raw.assessments).
CREATE OR REPLACE VIEW api.dashboard_value_trends AS
SELECT
    year,
    ROUND(AVG(market_value)::numeric, 0)::bigint AS avg_market_value,
    SUM(market_value)::bigint AS total_market_value,
    COUNT(*) FILTER (WHERE market_value IS NOT NULL)::bigint AS property_count
FROM mart.assessment_year_values
WHERE year IS NOT NULL
GROUP BY year
ORDER BY year;

CREATE OR REPLACE VIEW api.dashboard_property_types AS
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

CREATE OR REPLACE VIEW api.dashboard_value_bands AS
SELECT
    width_bucket(COALESCE(market_value_total, 0), 0, 1000000, 20) AS bucket,
    (width_bucket(COALESCE(market_value_total, 0), 0, 1000000, 20) - 1) * 50000 AS bucket_min,
    width_bucket(COALESCE(market_value_total, 0), 0, 1000000, 20) * 50000 AS bucket_max,
    COUNT(*)::bigint AS property_count
FROM mart.residential_properties
WHERE market_value_total IS NOT NULL
GROUP BY 1, 2, 3
ORDER BY 1;

CREATE OR REPLACE VIEW api.dashboard_value_distribution AS
SELECT * FROM api.dashboard_value_bands;

CREATE OR REPLACE VIEW api.dashboard_assessment_classes AS
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

CREATE OR REPLACE VIEW api.dashboard_transfers AS
SELECT
    m.property_id,
    m.parcel_id,
    m.parcel_number,
    m.situs_address,
    m.situs_city,
    m.tax_year,
    t.recording_num
FROM mart.residential_properties m
JOIN mart.transfer_recordings t
  ON t.property_id = m.property_id;

CREATE TABLE IF NOT EXISTS api.ingest_state (
    source text PRIMARY KEY,
    refreshed_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO api.ingest_state (source, refreshed_at)
VALUES ('mart.residential_properties', now())
ON CONFLICT (source) DO NOTHING;

REVOKE ALL ON SCHEMA api FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA api FROM PUBLIC;
GRANT USAGE ON SCHEMA api TO CURRENT_USER;
GRANT SELECT ON ALL TABLES IN SCHEMA api TO CURRENT_USER;

DO $$
BEGIN
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dashboard_app') THEN
            CREATE ROLE dashboard_app NOLOGIN;
        END IF;
    EXCEPTION WHEN insufficient_privilege THEN
        RAISE NOTICE 'Cannot CREATE ROLE dashboard_app; PUBLIC remains revoked and CURRENT_USER has SELECT.';
    END;

    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dashboard_readonly') THEN
            CREATE ROLE dashboard_readonly NOLOGIN;
        END IF;
    EXCEPTION WHEN insufficient_privilege THEN
        NULL;
    END;

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dashboard_app') THEN
        EXECUTE 'GRANT USAGE ON SCHEMA api TO dashboard_app';
        EXECUTE 'GRANT SELECT ON ALL TABLES IN SCHEMA api TO dashboard_app';
        BEGIN
            EXECUTE format('GRANT dashboard_app TO %I', current_user);
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dashboard_readonly') THEN
        EXECUTE 'GRANT USAGE ON SCHEMA api TO dashboard_readonly';
        EXECUTE $g$
            GRANT SELECT ON
                api.dashboard_summary,
                api.dashboard_value_trends,
                api.dashboard_property_types,
                api.dashboard_value_bands,
                api.dashboard_value_distribution,
                api.dashboard_assessment_classes,
                api.dashboard_map_properties,
                api.dashboard_transfers,
                api.ingest_state
            TO dashboard_readonly
        $g$;
    END IF;
END
$$;
