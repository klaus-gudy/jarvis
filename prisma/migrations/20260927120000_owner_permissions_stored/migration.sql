-- Owner permissions stop being implicit: from here on every role, Owner
-- included, can do exactly what is stored on it. Give existing Owner roles the
-- whole catalogue so nobody loses access on deploy. Tenant roles keep their
-- (empty) lists — tenants still get the portal for their own records.
UPDATE "Role" SET "permissions" = ARRAY['dashboard:read', 'property:read', 'property:write', 'tenant:read', 'tenant:write', 'lease:read', 'lease:write', 'lease:delete', 'contract:generate', 'payment:read', 'payment:record', 'payment:reverse', 'document:read', 'document:write', 'member:read', 'member:write', 'member:invite', 'sms:send', 'role:manage', 'template:manage', 'export:run', 'org:manage', 'org:backup', 'org:restore', 'org:delete']::TEXT[]
WHERE "kind" = 'OWNER';
