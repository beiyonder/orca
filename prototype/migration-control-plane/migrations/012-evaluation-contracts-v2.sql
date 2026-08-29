ALTER TABLE control_plane.domain_records
  DROP CONSTRAINT domain_records_schema_version_check;

ALTER TABLE control_plane.domain_records
  ADD CONSTRAINT domain_records_schema_version_check
  CHECK (schema_version > 0);

INSERT INTO control_plane.contract_schemas (
  schema_name,
  schema_version,
  json_schema_id,
  schema_sha256,
  active
)
VALUES
  ('evaluation-assignment.v2', 2, 'urn:orca:migration-control-plane:evaluation-assignment.v2', 'f2c0e1fe401024eee5e76c3d330d4d51585de2a03dd05b54d545467bd5976c82', true),
  ('evaluation-contract.v2', 2, 'urn:orca:migration-control-plane:evaluation-contract.v2', '9a9ba110db29b2b88bbd5fe5795a5689f654b2b1b70507edcc4cb92b26430ddd', true),
  ('evaluation-result.v2', 2, 'urn:orca:migration-control-plane:evaluation-result.v2', '08afeda21cd83432a863cf398af4d5eef0e85c700f0b5bec0fd465b57bb5d453', true),
  ('evaluator-definition.v2', 2, 'urn:orca:migration-control-plane:evaluator-definition.v2', 'b42eb8a0b1820025ef2372bf388da3c9fe843c43b03dda05aaaa10427ddc3769', true);

UPDATE control_plane.kernel_metadata
SET value = 'cfcbbbe88a88b7bde13f0fd3217470f7203e2496f86d34fa6bc546927010d0d7',
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
  OR OLD.schema_name = 'knowledge-context-manifest.v1'
  OR OLD.schema_name = 'migration-proposal.v1'
  OR OLD.schema_name = 'safe-probe-plan.v1'
  OR OLD.schema_name = 'target-capability-snapshot.v1'
)
EXECUTE FUNCTION control_plane.reject_immutable_knowledge_record_mutation();
