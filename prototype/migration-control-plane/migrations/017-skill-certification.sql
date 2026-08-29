INSERT INTO control_plane.contract_schemas (
  schema_name,
  schema_version,
  json_schema_id,
  schema_sha256,
  active
)
VALUES
  ('skill-active-pointer.v1', 1, 'urn:orca:migration-control-plane:skill-active-pointer.v1', 'e20d366d9363992124f905cb19b206e00e15f3369f19d9b7bcccbc8a7d306c03', true),
  ('skill-certification.v1', 1, 'urn:orca:migration-control-plane:skill-certification.v1', '1d6ab37d7d11355411a92ff0094e6e6f5aff1281820e94f4edba487c5d5826c7', true),
  ('skill-regression.v1', 1, 'urn:orca:migration-control-plane:skill-regression.v1', 'b16066ba1249bb7ad2aa11756696136263930e7b289c945c184602d170daff11', true);

UPDATE control_plane.kernel_metadata
SET value = '21ce5009e550b0dc99cb3ddeda34f5cbc57d347bfb2ef7b1b7e913b8f60e4150',
    updated_at = transaction_timestamp()
WHERE key = 'contract_registry_digest';
