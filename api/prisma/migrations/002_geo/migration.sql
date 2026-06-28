-- Ensure PostGIS extension is available
CREATE EXTENSION IF NOT EXISTS postgis;

-- Add geography column for spatial queries
ALTER TABLE "incidents" ADD COLUMN "geom" geography(POINT, 4326);

-- GiST index for fast radius/within queries
CREATE INDEX "incident_geom_idx" ON "incidents" USING GIST ("geom");

-- Backfill geom from lat/lng
UPDATE "incidents"
SET "geom" = ST_SetSRID(ST_MakePoint("longitude", "latitude"), 4326)::geography
WHERE "geom" IS NULL;
