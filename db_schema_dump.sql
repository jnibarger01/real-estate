--
-- PostgreSQL database dump
--

\restrict kIW6YO6YQqMdil4kcGlEd2gokcZjXKFkAaDSWOIzma0R0xknKCLpoSM7GEQzVaE

-- Dumped from database version 16.14 (Ubuntu 16.14-0ubuntu0.24.04.1)
-- Dumped by pg_dump version 16.14 (Ubuntu 16.14-0ubuntu0.24.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: core; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA core;


--
-- Name: mart; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA mart;


--
-- Name: raw; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA raw;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: parcel_properties; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.parcel_properties (
    parcel_id character varying,
    property_id integer
);


--
-- Name: parcels; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.parcels (
    parcel_id character varying NOT NULL,
    apn_display text,
    source_feature_count bigint,
    property_count bigint,
    geom public.geometry(MultiPolygon,4326)
);


--
-- Name: properties; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.properties (
    property_id integer NOT NULL,
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
    source_payload jsonb
);


--
-- Name: property_parcels; Type: MATERIALIZED VIEW; Schema: mart; Owner: -
--

CREATE MATERIALIZED VIEW mart.property_parcels AS
 SELECT pp.parcel_id,
    pp.property_id,
    p.apn_display,
    p.source_feature_count,
    p.property_count,
    pr.parcel_number,
    pr.situs_address,
    pr.situs_city,
    pr.situs_zip,
    pr.landuse_code,
    pr.landuse_description,
    pr.year_built,
    pr.stories,
    pr.bedrooms,
    pr.full_baths,
    pr.half_baths,
    pr.total_sqft,
    pr.tax_year,
    pr.assessed_value_total,
    pr.market_value_total,
    (pr.source_payload ->> 'owner_info'::text) AS owner_info,
    (pr.source_payload ->> 'address_compl'::text) AS owner_mailing_address,
    p.geom
   FROM ((core.parcel_properties pp
     JOIN core.parcels p ON (((p.parcel_id)::text = (pp.parcel_id)::text)))
     JOIN core.properties pr ON ((pr.property_id = pp.property_id)))
  WITH NO DATA;


--
-- Name: residential_properties; Type: MATERIALIZED VIEW; Schema: mart; Owner: -
--

CREATE MATERIALIZED VIEW mart.residential_properties AS
 SELECT parcel_id,
    property_id,
    apn_display,
    source_feature_count,
    property_count,
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
    tax_year,
    assessed_value_total,
    market_value_total,
    owner_info,
    owner_mailing_address,
    geom
   FROM mart.property_parcels
  WHERE (landuse_code = ANY (ARRAY['1110'::text, '1111'::text, '1112'::text, '1120'::text, '1130'::text, '1140'::text, '1150'::text, '1160'::text, '1108'::text, '1109'::text]))
  WITH NO DATA;


--
-- Name: assessments; Type: TABLE; Schema: raw; Owner: -
--

CREATE TABLE raw.assessments (
    payload jsonb NOT NULL
);


--
-- Name: residential_export; Type: TABLE; Schema: mart; Owner: -
--

CREATE TABLE mart.residential_export (
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


--
-- Name: parcels; Type: TABLE; Schema: raw; Owner: -
--

CREATE TABLE raw.parcels (
    ogc_fid integer NOT NULL,
    objectid integer,
    name character varying,
    parcelsubtype integer,
    createdbyrecord character varying,
    retiredbyrecord character varying,
    statedarea double precision,
    statedareaunit integer,
    calculatedarea double precision,
    miscloseratio double precision,
    misclosedistance double precision,
    isseed integer,
    created_user character varying,
    create_date bigint,
    last_edited_date bigint,
    globalid character varying,
    propertyid integer,
    parcel_id character varying,
    floordesignator character varying,
    zdesignator character varying,
    cartognote character varying,
    last_edited_user character varying,
    cloakedparcel integer,
    counter integer,
    validationstatus integer,
    cid character varying,
    tdd character varying,
    tifproject character varying,
    tifdistrict character varying,
    school character varying,
    tca character varying,
    shape__area double precision,
    shape__length double precision,
    floorname character varying,
    instrumentno character varying,
    recordname character varying,
    fire character varying,
    water character varying,
    created_date bigint,
    status character varying,
    acres double precision,
    library character varying,
    pid character varying,
    nid character varying,
    x double precision,
    y double precision,
    squarefootage character varying,
    retiredrecord character varying,
    geom public.geometry(MultiPolygon,4326)
);


--
-- Name: parcels_test_ogc_fid_seq; Type: SEQUENCE; Schema: raw; Owner: -
--

CREATE SEQUENCE raw.parcels_test_ogc_fid_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: parcels_test_ogc_fid_seq; Type: SEQUENCE OWNED BY; Schema: raw; Owner: -
--

ALTER SEQUENCE raw.parcels_test_ogc_fid_seq OWNED BY raw.parcels.ogc_fid;


--
-- Name: parcels ogc_fid; Type: DEFAULT; Schema: raw; Owner: -
--

ALTER TABLE ONLY raw.parcels ALTER COLUMN ogc_fid SET DEFAULT nextval('raw.parcels_test_ogc_fid_seq'::regclass);


--
-- Name: parcels parcels_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.parcels
    ADD CONSTRAINT parcels_pkey PRIMARY KEY (parcel_id);


--
-- Name: properties properties_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.properties
    ADD CONSTRAINT properties_pkey PRIMARY KEY (property_id);


--
-- Name: residential_export residential_export_pkey; Type: CONSTRAINT; Schema: mart; Owner: -
--

ALTER TABLE ONLY mart.residential_export
    ADD CONSTRAINT residential_export_pkey PRIMARY KEY (parcel_id, property_id);


--
-- Name: parcels parcels_test_pkey; Type: CONSTRAINT; Schema: raw; Owner: -
--

ALTER TABLE ONLY raw.parcels
    ADD CONSTRAINT parcels_test_pkey PRIMARY KEY (ogc_fid);


--
-- Name: core_parcel_properties_property_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX core_parcel_properties_property_idx ON core.parcel_properties USING btree (property_id);


--
-- Name: core_parcel_properties_uidx; Type: INDEX; Schema: core; Owner: -
--

CREATE UNIQUE INDEX core_parcel_properties_uidx ON core.parcel_properties USING btree (parcel_id, property_id);


--
-- Name: core_parcels_geom_gix; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX core_parcels_geom_gix ON core.parcels USING gist (geom);


--
-- Name: core_properties_landuse_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX core_properties_landuse_idx ON core.properties USING btree (landuse_code);


--
-- Name: core_properties_parcel_number_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX core_properties_parcel_number_idx ON core.properties USING btree (parcel_number);


--
-- Name: core_properties_zip_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX core_properties_zip_idx ON core.properties USING btree (situs_zip);


--
-- Name: mart_property_parcels_geom_gix; Type: INDEX; Schema: mart; Owner: -
--

CREATE INDEX mart_property_parcels_geom_gix ON mart.property_parcels USING gist (geom);


--
-- Name: mart_property_parcels_landuse_idx; Type: INDEX; Schema: mart; Owner: -
--

CREATE INDEX mart_property_parcels_landuse_idx ON mart.property_parcels USING btree (landuse_code);


--
-- Name: mart_property_parcels_property_idx; Type: INDEX; Schema: mart; Owner: -
--

CREATE INDEX mart_property_parcels_property_idx ON mart.property_parcels USING btree (property_id);


--
-- Name: mart_property_parcels_uidx; Type: INDEX; Schema: mart; Owner: -
--

CREATE UNIQUE INDEX mart_property_parcels_uidx ON mart.property_parcels USING btree (parcel_id, property_id);


--
-- Name: mart_property_parcels_zip_idx; Type: INDEX; Schema: mart; Owner: -
--

CREATE INDEX mart_property_parcels_zip_idx ON mart.property_parcels USING btree (situs_zip);


--
-- Name: residential_export_geom_gix; Type: INDEX; Schema: mart; Owner: -
--

CREATE INDEX residential_export_geom_gix ON mart.residential_export USING gist (geom);


--
-- Name: residential_export_property_idx; Type: INDEX; Schema: mart; Owner: -
--

CREATE INDEX residential_export_property_idx ON mart.residential_export USING btree (property_id);


--
-- Name: residential_export_zip_idx; Type: INDEX; Schema: mart; Owner: -
--

CREATE INDEX residential_export_zip_idx ON mart.residential_export USING btree (situs_zip);


--
-- Name: residential_properties_geom_gix; Type: INDEX; Schema: mart; Owner: -
--

CREATE INDEX residential_properties_geom_gix ON mart.residential_properties USING gist (geom);


--
-- Name: residential_properties_property_idx; Type: INDEX; Schema: mart; Owner: -
--

CREATE INDEX residential_properties_property_idx ON mart.residential_properties USING btree (property_id);


--
-- Name: residential_properties_uidx; Type: INDEX; Schema: mart; Owner: -
--

CREATE UNIQUE INDEX residential_properties_uidx ON mart.residential_properties USING btree (parcel_id, property_id);


--
-- Name: residential_properties_zip_idx; Type: INDEX; Schema: mart; Owner: -
--

CREATE INDEX residential_properties_zip_idx ON mart.residential_properties USING btree (situs_zip);


--
-- Name: parcels_geom_gix; Type: INDEX; Schema: raw; Owner: -
--

CREATE INDEX parcels_geom_gix ON raw.parcels USING gist (geom);


--
-- Name: parcels_objectid_uidx; Type: INDEX; Schema: raw; Owner: -
--

CREATE UNIQUE INDEX parcels_objectid_uidx ON raw.parcels USING btree (objectid);


--
-- Name: parcels_parcel_id_idx; Type: INDEX; Schema: raw; Owner: -
--

CREATE INDEX parcels_parcel_id_idx ON raw.parcels USING btree (parcel_id);


--
-- Name: parcels_propertyid_idx; Type: INDEX; Schema: raw; Owner: -
--

CREATE INDEX parcels_propertyid_idx ON raw.parcels USING btree (propertyid);


--
-- Name: parcels_test_geom_geom_idx; Type: INDEX; Schema: raw; Owner: -
--

CREATE INDEX parcels_test_geom_geom_idx ON raw.parcels USING gist (geom);


--
-- PostgreSQL database dump complete
--

\unrestrict kIW6YO6YQqMdil4kcGlEd2gokcZjXKFkAaDSWOIzma0R0xknKCLpoSM7GEQzVaE

