INSERT INTO control_plane.contract_schemas (
  schema_name,
  schema_version,
  json_schema_id,
  schema_sha256,
  active
)
VALUES
  ('correction-cycle.v1', 1, 'urn:orca:migration-control-plane:correction-cycle.v1', 'b4064319744446044a7d8c6410aea4d297323338aa67c75b75377b74ccff5875', true),
  ('evaluation-diagnosis.v1', 1, 'urn:orca:migration-control-plane:evaluation-diagnosis.v1', 'e3e5831706b01ef32509e5803c9f127b7b53ae3e27a5714b23e969be04f549dc', true),
  ('subject-acceptance.v1', 1, 'urn:orca:migration-control-plane:subject-acceptance.v1', 'ebfc23c5b8bafecbb45e9b16fd1036123f77e64d71324714d07ba60c8c924147', true);

UPDATE control_plane.kernel_metadata
SET value = '196577415b35f42fe6da18b029e8168fd9281d48e47b963d7cfe7504cf42af20',
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
  OR OLD.schema_name LIKE 'artifact-build-%'
  OR OLD.schema_name LIKE 'data-movement-%'
  OR OLD.schema_name LIKE 'semantic-%'
  OR OLD.schema_name LIKE 'correction-%'
  OR OLD.schema_name LIKE 'subject-acceptance%'
  OR OLD.schema_name = 'knowledge-context-manifest.v1'
  OR OLD.schema_name = 'migration-proposal.v1'
  OR OLD.schema_name = 'safe-probe-plan.v1'
  OR OLD.schema_name = 'target-capability-snapshot.v1'
)
EXECUTE FUNCTION control_plane.reject_immutable_knowledge_record_mutation();
