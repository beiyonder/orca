INSERT INTO control_plane.contract_schemas (
  schema_name,
  schema_version,
  json_schema_id,
  schema_sha256,
  active
)
VALUES
  ('source-access-envelope.v1', 1, 'urn:orca:migration-control-plane:source-access-envelope.v1', 'c69651392054ab9340adc0c9bfb68742d42626dacc7fc1250b3a836c76985441', true),
  ('source-adapter-definition.v1', 1, 'urn:orca:migration-control-plane:source-adapter-definition.v1', 'a1ef5c672ea535c9969c728738fdddfcc5fde93f460ade7d0da56c2c5a5089a5', true),
  ('source-observation.v1', 1, 'urn:orca:migration-control-plane:source-observation.v1', '4ab48e2814f82f508f6c6c2dc6bf2574004cdd8e322d43164f4a8dd5ce3aab4b', true),
  ('source-request.v1', 1, 'urn:orca:migration-control-plane:source-request.v1', 'a63b378168e2ed4c21d8d80db7c0904ef225f2f6403840ef55d502337cf88687', true);

UPDATE control_plane.kernel_metadata
SET value = 'fce6e3f467c8e5931330c87c765a1e0166899e51a55ce8d63f0cb6d996d3d1d0',
    updated_at = transaction_timestamp()
WHERE key = 'contract_registry_digest';

DROP TRIGGER domain_records_immutable_knowledge
  ON control_plane.domain_records;

CREATE TRIGGER domain_records_immutable_knowledge
BEFORE UPDATE OR DELETE ON control_plane.domain_records
FOR EACH ROW
WHEN (
  OLD.schema_name LIKE 'corpus-%'
  OR OLD.schema_name LIKE 'retrieval-%'
  OR OLD.schema_name LIKE 'memory-%'
  OR OLD.schema_name LIKE 'skill-%'
  OR OLD.schema_name LIKE 'source-%'
  OR OLD.schema_name = 'knowledge-context-manifest.v1'
)
EXECUTE FUNCTION control_plane.reject_immutable_knowledge_record_mutation();
