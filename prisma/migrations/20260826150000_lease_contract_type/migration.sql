-- The contract generated from a lease template, filled with that lease's own
-- data. Distinct from `sys_LEASE_AGREEMENT` ("Signed agreement") on purpose:
-- that one is the scan someone uploads *after* both parties have signed, and
-- conflating the two would mean a machine-made draft and a legally executed
-- document sharing a slot.
--
-- `allowsMultiple = false`, so regenerating replaces rather than leaving a pile
-- of near-identical drafts nobody can order. `lib/contracts.ts` deletes the
-- previous one first for exactly that reason.
--
-- Seeded here rather than left for someone to add through the UI: the contract
-- worker needs this type to exist before it can file anything, and a queue
-- consumer failing because nobody clicked "add a type" is not a good first
-- experience. `sys_<KEY>` id, matching every other system type.
INSERT INTO "FileAssetType" ("id", "key", "label", "subject", "allowsMultiple", "isPhoto", "isSystem", "updatedAt")
VALUES ('sys_LEASE_CONTRACT', 'LEASE_CONTRACT', 'Generated contract', 'LEASE', false, false, true, now())
ON CONFLICT DO NOTHING;
