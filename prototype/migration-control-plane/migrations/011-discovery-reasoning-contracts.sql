INSERT INTO control_plane.contract_schemas (
  schema_name,
  schema_version,
  json_schema_id,
  schema_sha256,
  active
)
VALUES
  ('discovery-gap-ranking.v1', 1, 'urn:orca:migration-control-plane:discovery-gap-ranking.v1', '47b14754031ade361196f714c35298836bfae00bfd9cde46c8db9eefa7152cca', true),
  ('migration-proposal.v1', 1, 'urn:orca:migration-control-plane:migration-proposal.v1', '3ee756f315ba833d1357d149c923fb5729ce18ac470b96bc65933f836477a7aa', true),
  ('safe-probe-plan.v1', 1, 'urn:orca:migration-control-plane:safe-probe-plan.v1', '44d1c737417eba9b32a23a53ecc14767e7659cab75f9cdda1ad1680d3f355635', true),
  ('source-cdc-analysis.v1', 1, 'urn:orca:migration-control-plane:source-cdc-analysis.v1', '72fad8e4435c35b001bac29ad93a571e5236b0dac4bf86da7d7a5661144a0ad3', true),
  ('source-cdc-trace.v1', 1, 'urn:orca:migration-control-plane:source-cdc-trace.v1', '683b32cacf9c7fe9524c36aa8a515c47cf3819a0b4558471a882de3f67591c3d', true),
  ('source-claim-comparison.v1', 1, 'urn:orca:migration-control-plane:source-claim-comparison.v1', 'cfff116db2fba7cc71946ce35e05b2d3c3db248c4d0a29d9914268126ad7a569', true),
  ('target-capability-snapshot.v1', 1, 'urn:orca:migration-control-plane:target-capability-snapshot.v1', 'b0e4209e7c9d224239bdcf69a4a874e1312fc0361036613a0cf46e5730ae424d', true);

UPDATE control_plane.kernel_metadata
SET value = 'e73d6ad464fc3fbe89d7ec9e4cc9b80eadac2669177fe780491a13805591bf23',
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
  OR OLD.schema_name LIKE 'discovery-%'
  OR OLD.schema_name = 'knowledge-context-manifest.v1'
  OR OLD.schema_name = 'migration-proposal.v1'
  OR OLD.schema_name = 'safe-probe-plan.v1'
  OR OLD.schema_name = 'target-capability-snapshot.v1'
)
EXECUTE FUNCTION control_plane.reject_immutable_knowledge_record_mutation();
