INSERT INTO control_plane.contract_schemas (
  schema_name,
  schema_version,
  json_schema_id,
  schema_sha256,
  active
)
VALUES
  ('source-code-extract.v1', 1, 'urn:orca:migration-control-plane:source-code-extract.v1', '1bc0539c2f611040541e660f288313e59b2aa2c8c7e01bfe65a93499c59a6339', true),
  ('source-data-profile.v1', 1, 'urn:orca:migration-control-plane:source-data-profile.v1', '2ff73fba5e8ba7b6a8bc02c656c70e53ed9c3f93ea525119310aeddffad7a9c5', true),
  ('source-lineage-snapshot.v1', 1, 'urn:orca:migration-control-plane:source-lineage-snapshot.v1', 'd5717f4a62b22b3d9ccd6af33a9373976303c4557c2b7c0678256fb0005ed6f7', true),
  ('source-schema-inventory.v1', 1, 'urn:orca:migration-control-plane:source-schema-inventory.v1', 'f8654b84f6caba9d31a7bfb9196545813b50322432708b09b4f5468e51c10d2e', true),
  ('source-system-inventory.v1', 1, 'urn:orca:migration-control-plane:source-system-inventory.v1', '55fe01bfde6100ac9d95668f333ec3cba5ab471641fd4f2589283e4d015ba7db', true);

UPDATE control_plane.kernel_metadata
SET value = '4fc4c584935e57367df72965c9a82ad66d5c06ac739b98596c3659cdd04396d1',
    updated_at = transaction_timestamp()
WHERE key = 'contract_registry_digest';
