INSERT INTO control_plane.contract_schemas (
  schema_name,
  schema_version,
  json_schema_id,
  schema_sha256,
  active
)
VALUES
  ('capability-envelope.v2', 2, 'urn:orca:migration-control-plane:capability-envelope.v2', '482b6ccfb7c3a5a78b276957c6e96bc96e8712ebb5f93f511022c67dfd0482b0', true),
  ('effect-intent.v2', 2, 'urn:orca:migration-control-plane:effect-intent.v2', 'dcc93ef89ed390b0f3815741e6501405befedf769f6cee4e3ba40e5c37a39c17', true),
  ('policy-decision.v2', 2, 'urn:orca:migration-control-plane:policy-decision.v2', 'b32edfa391c8f243bd06ca5f74e5f6333053c8ad487decfd2d10f0bd3a7201e9', true);

UPDATE control_plane.kernel_metadata
SET value = '2e49040ba91b70ea05b89d8f24acf082ba9788895a622187ac83e10f0dbd9b6a',
    updated_at = transaction_timestamp()
WHERE key = 'contract_registry_digest';
