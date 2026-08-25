-- A member's profile photo is a `FileAssetType` like any other — subject
-- MEMBERSHIP, one per member (`allowsMultiple = false`, so a second upload
-- replaces rather than accumulates), `isPhoto = true` so it takes images only.
--
-- Seeded here rather than left for someone to add through the UI: the whole
-- point is that a member's avatar works the moment the schema does, with
-- nothing to configure. `sys_PROFILE_PHOTO`, matching the `sys_<KEY>` ids the
-- 2026-08-25 migration gave the original seventeen.
INSERT INTO "FileAssetType" ("id", "key", "label", "subject", "allowsMultiple", "isPhoto", "isSystem", "updatedAt")
VALUES ('sys_PROFILE_PHOTO', 'PROFILE_PHOTO', 'Profile photo', 'MEMBERSHIP', false, true, true, now())
ON CONFLICT DO NOTHING;
