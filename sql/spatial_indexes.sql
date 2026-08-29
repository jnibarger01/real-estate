-- Spatial indexes for map/bbox queries. Idempotent.
-- Primary filter is geom && envelope on mart.residential_properties.

CREATE INDEX IF NOT EXISTS residential_properties_geom_gix
    ON mart.residential_properties USING gist (geom);

CREATE INDEX IF NOT EXISTS mart_property_parcels_geom_gix
    ON mart.property_parcels USING gist (geom);

CREATE INDEX IF NOT EXISTS core_parcels_geom_gix
    ON core.parcels USING gist (geom);

-- Centroid expression index for low-zoom point rendering.
CREATE INDEX IF NOT EXISTS residential_properties_centroid_gix
    ON mart.residential_properties USING gist (ST_Centroid(geom));
