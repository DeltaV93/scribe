-- Add embedding fields to Goal table
ALTER TABLE "Goal" ADD COLUMN IF NOT EXISTS "embedding" JSONB;
ALTER TABLE "Goal" ADD COLUMN IF NOT EXISTS "embeddingModel" TEXT;
ALTER TABLE "Goal" ADD COLUMN IF NOT EXISTS "embeddingUpdatedAt" TIMESTAMP(3);

-- Add source fields for draft goals
ALTER TABLE "Goal" ADD COLUMN IF NOT EXISTS "sourceType" TEXT;
ALTER TABLE "Goal" ADD COLUMN IF NOT EXISTS "sourceCallId" TEXT;

-- Add visibility fields for draft goals
ALTER TABLE "Goal" ADD COLUMN IF NOT EXISTS "visibility" TEXT;
ALTER TABLE "Goal" ADD COLUMN IF NOT EXISTS "visibleToRoles" TEXT[];

-- Add foreign key for sourceCallId if Call table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Call') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'Goal_sourceCallId_fkey'
    ) THEN
      ALTER TABLE "Goal" ADD CONSTRAINT "Goal_sourceCallId_fkey"
        FOREIGN KEY ("sourceCallId") REFERENCES "Call"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
  END IF;
END $$;

-- Create index on sourceCallId
CREATE INDEX IF NOT EXISTS "Goal_sourceCallId_idx" ON "Goal"("sourceCallId");
