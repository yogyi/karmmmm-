-- AlterTable
ALTER TABLE "users" ADD COLUMN "onboarding_completed" BOOLEAN NOT NULL DEFAULT false;

-- Existing accounts already chose (or were assigned) a role — skip the new gate.
UPDATE "users" SET "onboarding_completed" = true;
