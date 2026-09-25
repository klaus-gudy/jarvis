-- A member's drawn signature: the object key of a PNG in STORAGE_BUCKET.
-- Nullable — nobody has signed yet — and set only by the member themself.
ALTER TABLE "MemberProfile" ADD COLUMN "signatureKey" TEXT;
