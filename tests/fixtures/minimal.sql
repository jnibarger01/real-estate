CREATE EXTENSION IF NOT EXISTS postgis;

CREATE SCHEMA IF NOT EXISTS raw;
CREATE SCHEMA IF NOT EXISTS core;
CREATE SCHEMA IF NOT EXISTS mart;

CREATE TABLE IF NOT EXISTS raw.assessments (
    payload jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS mart.residential_properties (
    parcel_id character varying NOT NULL,
    property_id integer NOT NULL,
    apn_display text,
    source_feature_count bigint,
    property_count bigint,
    parcel_number text,
    situs_address text,
    situs_city text,
    situs_zip text,
    landuse_code text,
    landuse_description text,
    year_built integer,
    stories integer,
    bedrooms integer,
    full_baths integer,
    half_baths integer,
    total_sqft integer,
    tax_year text,
    assessed_value_total bigint,
    market_value_total bigint,
    owner_info text,
    owner_mailing_address text,
    geom public.geometry(MultiPolygon,4326)
);

TRUNCATE raw.assessments;
TRUNCATE mart.residential_properties;

INSERT INTO mart.residential_properties (
    parcel_id, property_id, apn_display, parcel_number, situs_address, situs_city, situs_zip,
    landuse_code, landuse_description, year_built, stories, bedrooms, full_baths, half_baths,
    total_sqft, tax_year, assessed_value_total, market_value_total, owner_info, owner_mailing_address, geom
) VALUES
(
    '1001', 101, '1001', '26-1001', '100 MAIN ST', 'KANSAS CITY', '64111',
    '1110', 'Single Family', 1950, 1, 3, 2, 0,
    1400, '2024', 18000, 220000, 'JANE DOE', '100 MAIN ST',
    ST_Multi(ST_GeomFromText('POLYGON((-94.59 39.09, -94.589 39.09, -94.589 39.091, -94.59 39.091, -94.59 39.09))', 4326))
),
(
    '1002', 102, '1002', '26-1002', '200 OAK AVE', 'INDEPENDENCE', '64050',
    '1110', 'Single Family', 1972, 1, 4, 2, 1,
    1800, '2024', 24000, 310000, 'JOHN SMITH', '200 OAK AVE',
    ST_Multi(ST_GeomFromText('POLYGON((-94.42 39.09, -94.419 39.09, -94.419 39.091, -94.42 39.091, -94.42 39.09))', 4326))
),
(
    '1003', 103, '1003', '26-1003', '300 PINE RD', 'LEES SUMMIT', '64063',
    '1120', 'Condo', 2001, 2, 2, 2, 0,
    1100, '2024', 15000, 175000, 'ACME LLC', 'PO BOX 1',
    ST_Multi(ST_GeomFromText('POLYGON((-94.38 38.91, -94.379 38.91, -94.379 38.911, -94.38 38.911, -94.38 38.91))', 4326))
);

INSERT INTO raw.assessments (payload) VALUES
(
    '{"property_id":"101","Market_Value_Total":"220000","Market_Value_Total_pastyr1":"200000","Market_Value_Total_pastyr2":"190000","Market_Value_Total_pastyr3":"180000","Market_Value_Total_pastyr4":"170000","recording_num":"2024I-001","tax_year":"2024"}'::jsonb
),
(
    '{"property_id":"102","Market_Value_Total":"310000","Market_Value_Total_pastyr1":"300000","Market_Value_Total_pastyr2":"280000","Market_Value_Total_pastyr3":"260000","Market_Value_Total_pastyr4":"250000","recording_num":"","tax_year":"2024"}'::jsonb
),
(
    '{"property_id":"103","Market_Value_Total":"175000","Market_Value_Total_pastyr1":"170000","Market_Value_Total_pastyr2":"165000","Market_Value_Total_pastyr3":"160000","Market_Value_Total_pastyr4":"155000","recording_num":"2022I-009","tax_year":"2024"}'::jsonb
);

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

TRUNCATE mart.assessment_year_values;
TRUNCATE mart.transfer_recordings;

INSERT INTO mart.assessment_year_values (property_id, year, market_value) VALUES
(101, 2024, 220000), (101, 2023, 200000), (101, 2022, 190000), (101, 2021, 180000), (101, 2020, 170000),
(102, 2024, 310000), (102, 2023, 300000), (102, 2022, 280000), (102, 2021, 260000), (102, 2020, 250000),
(103, 2024, 175000), (103, 2023, 170000), (103, 2022, 165000), (103, 2021, 160000), (103, 2020, 155000);

INSERT INTO mart.transfer_recordings (property_id, recording_num) VALUES
(101, '2024I-001'),
(103, '2022I-009');

CREATE INDEX IF NOT EXISTS fixture_res_geom_gix ON mart.residential_properties USING gist (geom);
