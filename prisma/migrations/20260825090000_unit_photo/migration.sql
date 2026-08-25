-- A unit's photos are the same kind of thing as a property's, and the pairing
-- table in lib/document-options.ts maps exactly one subject to each type — so
-- "photo of a unit" needs its own value rather than being squeezed into
-- UNIT_DOCUMENT beside floor plans and inspection reports.
--
-- Adding a value is all this does. Postgres allows ALTER TYPE ... ADD VALUE
-- inside a transaction from 12 onwards, but forbids *using* the new value in
-- that same transaction, so nothing here may reference 'UNIT_PHOTO'.
-- AlterEnum
ALTER TYPE "FileAssetType" ADD VALUE 'UNIT_PHOTO';
