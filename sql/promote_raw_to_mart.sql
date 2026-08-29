-- Promote prior-year values and recording numbers out of raw.assessments.
-- Run as a role that can read raw.* and write mart.* (typically postgres).
-- api.dashboard_* must not query raw after this script + view refresh.

CREATE SCHEMA IF NOT EXISTS mart;

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

INSERT INTO mart.assessment_year_values (property_id, year, market_value)
SELECT
    property_id,
    year,
    market_value
FROM (
    SELECT
        (a.payload->>'property_id')::int AS property_id,
        NULLIF((a.payload->>'tax_year')::int, 0) AS year,
        NULLIF((a.payload->>'Market_Value_Total')::numeric, 0) AS market_value
    FROM raw.assessments a
    UNION ALL
    SELECT
        (a.payload->>'property_id')::int,
        NULLIF((a.payload->>'tax_year')::int, 0) - 1,
        NULLIF((a.payload->>'Market_Value_Total_pastyr1')::numeric, 0)
    FROM raw.assessments a
    UNION ALL
    SELECT
        (a.payload->>'property_id')::int,
        NULLIF((a.payload->>'tax_year')::int, 0) - 2,
        NULLIF((a.payload->>'Market_Value_Total_pastyr2')::numeric, 0)
    FROM raw.assessments a
    UNION ALL
    SELECT
        (a.payload->>'property_id')::int,
        NULLIF((a.payload->>'tax_year')::int, 0) - 3,
        NULLIF((a.payload->>'Market_Value_Total_pastyr3')::numeric, 0)
    FROM raw.assessments a
    UNION ALL
    SELECT
        (a.payload->>'property_id')::int,
        NULLIF((a.payload->>'tax_year')::int, 0) - 4,
        NULLIF((a.payload->>'Market_Value_Total_pastyr4')::numeric, 0)
    FROM raw.assessments a
) src
WHERE property_id IS NOT NULL AND year IS NOT NULL
ON CONFLICT (property_id, year) DO UPDATE SET market_value = EXCLUDED.market_value;

INSERT INTO mart.transfer_recordings (property_id, recording_num)
SELECT DISTINCT
    (a.payload->>'property_id')::int,
    NULLIF(a.payload->>'recording_num', '')
FROM raw.assessments a
WHERE NULLIF(a.payload->>'recording_num', '') IS NOT NULL
  AND (a.payload->>'property_id') ~ '^[0-9]+$'
ON CONFLICT DO NOTHING;
