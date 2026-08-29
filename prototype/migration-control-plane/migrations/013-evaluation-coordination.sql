INSERT INTO control_plane.contract_schemas (
  schema_name,
  schema_version,
  json_schema_id,
  schema_sha256,
  active
)
VALUES
  ('evaluation-coordination.v1', 1, 'urn:orca:migration-control-plane:evaluation-coordination.v1', '25ecbb038c9385f51daf82c24ce4f282c0cffd49625f67872a56720b62bf12cb', true);

UPDATE control_plane.kernel_metadata
SET value = '8ed8a95e276e31d3afe4ad082102c17aeedf1280d3826b2b970234c00b9b3249',
    updated_at = transaction_timestamp()
WHERE key = 'contract_registry_digest';
