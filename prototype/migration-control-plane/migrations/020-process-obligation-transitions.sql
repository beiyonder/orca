INSERT INTO control_plane.contract_schemas (
  schema_name,
  schema_version,
  json_schema_id,
  schema_sha256,
  active
)
VALUES (
  'process-obligation-transition.v1',
  1,
  'urn:orca:migration-control-plane:process-obligation-transition.v1',
  '06a1b2b90ab5cdc63a14660b6b7911761deb3867acd4763c03e27f2db2aa3974',
  true
);

UPDATE control_plane.kernel_metadata
SET value = '083366a12a1e92bd387b504559962ada82a37f17faf118f051f198e54511b851',
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
  OR OLD.schema_name IN (
    'process-obligation-definition.v1',
    'process-obligation-breach.v1',
    'process-obligation-transition.v1',
    'process-obligation-waiver.v1'
  )
  OR OLD.schema_name = 'knowledge-context-manifest.v1'
  OR OLD.schema_name = 'migration-proposal.v1'
  OR OLD.schema_name = 'safe-probe-plan.v1'
  OR OLD.schema_name = 'target-capability-snapshot.v1'
)
EXECUTE FUNCTION control_plane.reject_immutable_knowledge_record_mutation();
