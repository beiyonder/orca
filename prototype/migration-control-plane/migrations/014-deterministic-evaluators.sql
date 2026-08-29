INSERT INTO control_plane.contract_schemas (
  schema_name,
  schema_version,
  json_schema_id,
  schema_sha256,
  active
)
VALUES
  ('deterministic-evaluator-suite.v1', 1, 'urn:orca:migration-control-plane:deterministic-evaluator-suite.v1', '91e66ffa7ee33f11b183e9293c52a4d8d205692dbec29b77e2a9907c54a985dd', true),
  ('evaluation-deterministic-report.v1', 1, 'urn:orca:migration-control-plane:evaluation-deterministic-report.v1', '35ce43da763e984098a8ecaf2ef2eb76f522db8d0e2f22c20545c0bc2760b08c', true);

UPDATE control_plane.kernel_metadata
SET value = 'f80bfe88df0ccde51186f6cf4bb37fd4af6bb80f119d374329e02773dc34bae6',
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
  OR OLD.schema_name LIKE 'evaluation-%'
  OR OLD.schema_name LIKE 'evaluator-%'
  OR OLD.schema_name LIKE 'deterministic-evaluator-%'
  OR OLD.schema_name = 'knowledge-context-manifest.v1'
  OR OLD.schema_name = 'migration-proposal.v1'
  OR OLD.schema_name = 'safe-probe-plan.v1'
  OR OLD.schema_name = 'target-capability-snapshot.v1'
)
EXECUTE FUNCTION control_plane.reject_immutable_knowledge_record_mutation();
