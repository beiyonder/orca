INSERT INTO control_plane.contract_schemas (
  schema_name,
  schema_version,
  json_schema_id,
  schema_sha256,
  active
)
VALUES
  ('knowledge-context-manifest.v1', 1, 'urn:orca:migration-control-plane:knowledge-context-manifest.v1', 'a90d26bfa014fd1f74c7a555c24fb62a23f2682191cd5fe82e265606cd759c18', true),
  ('retrieval-query.v1', 1, 'urn:orca:migration-control-plane:retrieval-query.v1', '85e83b65d96565000faf1d11b6c0c0661bd006aada746aa4f92909161a184c69', true),
  ('retrieval-trace.v1', 1, 'urn:orca:migration-control-plane:retrieval-trace.v1', '90aca072d6a286bb969738d8a034c290e4f9c1674f87a01c1342705a2a5a95f3', true);

UPDATE control_plane.kernel_metadata
SET value = '54356e502bde78fb9ce4fa600bb372ed0f3724ee1936443684f0f95a850bfc0c',
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
  OR OLD.schema_name = 'knowledge-context-manifest.v1'
)
EXECUTE FUNCTION control_plane.reject_immutable_knowledge_record_mutation();
