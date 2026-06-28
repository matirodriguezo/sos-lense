-- Incident status enum
CREATE TYPE "IncidentStatus" AS ENUM ('NO_CLASIFICADO', 'ACTIVO', 'EN_CURSO', 'CERRADO', 'ANULADO');

-- Incidents table
CREATE TABLE "incidents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "citizen_id" UUID NOT NULL,
    "citizen_alias" TEXT NOT NULL DEFAULT '',
    "officer_id" UUID,
    "officer_alias" TEXT NOT NULL DEFAULT '',
    "status" "IncidentStatus" NOT NULL DEFAULT 'NO_CLASIFICADO',
    "type" TEXT NOT NULL DEFAULT 'Por definir',
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "address" TEXT NOT NULL DEFAULT '',
    "quick_requests" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "observations" TEXT NOT NULL DEFAULT '',
    "closed_reason" TEXT NOT NULL DEFAULT '',
    "cancelled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incidents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "incidents_status_idx" ON "incidents"("status");
CREATE INDEX "incidents_citizen_id_idx" ON "incidents"("citizen_id");
CREATE INDEX "incidents_officer_id_idx" ON "incidents"("officer_id");

ALTER TABLE "incidents"
    ADD CONSTRAINT "incidents_citizen_id_fkey"
    FOREIGN KEY ("citizen_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "incidents"
    ADD CONSTRAINT "incidents_officer_id_fkey"
    FOREIGN KEY ("officer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
