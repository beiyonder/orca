INSERT INTO control_plane.contract_schemas (
  schema_name,
  schema_version,
  json_schema_id,
  schema_sha256,
  active
)
VALUES
  ('artifact-build-bundle.v1', 1, 'urn:orca:migration-control-plane:artifact-build-bundle.v1', '57aebcc8f6a2e834453745adf660164e8fb4dc9213ae5a0f1771fbd3da8ad3cc', true),
  ('artifact-build-evaluation-report.v1', 1, 'urn:orca:migration-control-plane:artifact-build-evaluation-report.v1', 'e714153f775a9bf5ed6ef8a639608dd3dfcf7ccf8b0998dc91dcfa758d4c6458', true),
  ('data-movement-evaluation-report.v1', 1, 'urn:orca:migration-control-plane:data-movement-evaluation-report.v1', '4055a5da95b0260e8419942491aeb9c9d97eb837760de0283037985809b66540', true),
  ('semantic-evaluation-report.v1', 1, 'urn:orca:migration-control-plane:semantic-evaluation-report.v1', '5ada3685c45a9b375221d2c9778c1e761af876aede068cad6abd80f845004df7', true),
  ('semantic-labeled-corpus.v1', 1, 'urn:orca:migration-control-plane:semantic-labeled-corpus.v1', '409c0a14c71be7766a06342e4fac94a1a77420710288af0da609a0f59281c679', true);

UPDATE control_plane.kernel_metadata
SET value = '50bee82d8a1db5edb27dbccd16d51e03dad4bef55a0673d8e372d98840ea456b',
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
  OR OLD.schema_name = 'knowledge-context-manifest.v1'
  OR OLD.schema_name = 'migration-proposal.v1'
  OR OLD.schema_name = 'safe-probe-plan.v1'
  OR OLD.schema_name = 'target-capability-snapshot.v1'
)
EXECUTE FUNCTION control_plane.reject_immutable_knowledge_record_mutation();
