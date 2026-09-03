CREATE TABLE control_plane.process_obligation_definitions (
  tenant_id text NOT NULL,
  definition_id text NOT NULL,
  definition_key text NOT NULL,
  definition_version bigint NOT NULL,
  trigger_event_kind text NOT NULL,
  activated_at timestamptz NOT NULL,
  revoked_at timestamptz,
  definition jsonb NOT NULL,
  definition_sha256 text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, definition_id),
  UNIQUE (tenant_id, definition_key, definition_version),
  CHECK (tenant_id ~ '^tenant_[a-z0-9][a-z0-9_-]{0,111}$'),
  CHECK (definition_id ~ '^obligation_definition_[a-z0-9][a-z0-9_-]{0,111}$'),
  CHECK (definition_version > 0),
  CHECK (jsonb_typeof(definition) = 'object'),
  CHECK (definition_sha256 ~ '^[a-f0-9]{64}$'),
  CHECK (revoked_at IS NULL OR revoked_at >= activated_at)
);

CREATE INDEX process_obligation_definitions_trigger_active_idx
  ON control_plane.process_obligation_definitions (
    tenant_id,
    trigger_event_kind,
    definition_key,
    definition_version DESC
  )
  WHERE revoked_at IS NULL;

CREATE FUNCTION control_plane.reject_process_obligation_definition_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'process obligation definition % is immutable', OLD.definition_id
    USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER process_obligation_definitions_immutable
BEFORE UPDATE OR DELETE ON control_plane.process_obligation_definitions
FOR EACH ROW
EXECUTE FUNCTION control_plane.reject_process_obligation_definition_mutation();

CREATE TABLE control_plane.process_obligations (
  tenant_id text NOT NULL,
  mission_id text NOT NULL,
  obligation_id text NOT NULL,
  definition_id text NOT NULL,
  definition_version bigint NOT NULL,
  definition_digest text NOT NULL,
  scope_kind text NOT NULL,
  scope_id text NOT NULL,
  subject_version text,
  trigger_event_id text NOT NULL,
  trigger_event_position bigint NOT NULL,
  obligation_state text NOT NULL,
  opened_at timestamptz NOT NULL,
  due_at timestamptz NOT NULL,
  grace_until timestamptz NOT NULL,
  proof_record_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  breach_id text,
  current_fence bigint NOT NULL,
  monitor_claimed_by text,
  monitor_claim_id text,
  monitor_claim_expires_at timestamptz,
  monitor_claim_fence bigint NOT NULL DEFAULT 0,
  obligation jsonb NOT NULL,
  obligation_sha256 text NOT NULL,
  terminal_at timestamptz,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  PRIMARY KEY (tenant_id, obligation_id),
  UNIQUE (tenant_id, definition_id, scope_kind, scope_id, trigger_event_id),
  FOREIGN KEY (tenant_id, definition_id)
    REFERENCES control_plane.process_obligation_definitions (tenant_id, definition_id),
  FOREIGN KEY (tenant_id, mission_id)
    REFERENCES control_plane.mission_aggregates (tenant_id, mission_id),
  CHECK (tenant_id ~ '^tenant_[a-z0-9][a-z0-9_-]{0,111}$'),
  CHECK (mission_id ~ '^mission_[a-z0-9][a-z0-9_-]{0,111}$'),
  CHECK (obligation_id ~ '^obligation_[a-z0-9][a-z0-9_-]{0,111}$'),
  CHECK (definition_version > 0),
  CHECK (definition_digest ~ '^[a-f0-9]{64}$'),
  CHECK (scope_kind IN (
    'mission', 'plan', 'task', 'assignment', 'effect', 'artifact', 'evidence',
    'evaluation', 'memory', 'skill', 'exception', 'maintenance'
  )),
  CHECK (trigger_event_id ~ '^event_[a-z0-9][a-z0-9_-]{0,111}$'),
  CHECK (trigger_event_position > 0),
  CHECK (obligation_state IN ('pending', 'satisfied', 'failed', 'waived', 'cancelled')),
  CHECK (due_at > opened_at),
  CHECK (grace_until >= due_at),
  CHECK (jsonb_typeof(proof_record_ids) = 'array'),
  CHECK (breach_id IS NULL OR breach_id ~ '^obligation_breach_[a-z0-9][a-z0-9_-]{0,111}$'),
  CHECK (current_fence > 0),
  CHECK (monitor_claim_fence >= 0),
  CHECK (
    (monitor_claimed_by IS NULL AND monitor_claim_id IS NULL AND monitor_claim_expires_at IS NULL)
    OR
    (monitor_claimed_by IS NOT NULL AND monitor_claim_id IS NOT NULL AND monitor_claim_expires_at IS NOT NULL)
  ),
  CHECK (jsonb_typeof(obligation) = 'object'),
  CHECK (obligation_sha256 ~ '^[a-f0-9]{64}$'),
  CHECK (
    (obligation_state = 'pending' AND terminal_at IS NULL)
    OR
    (obligation_state <> 'pending' AND terminal_at IS NOT NULL)
  )
);

CREATE INDEX process_obligations_due_pending_idx
  ON control_plane.process_obligations (grace_until, tenant_id, obligation_id)
  WHERE obligation_state = 'pending';

CREATE INDEX process_obligations_mission_state_idx
  ON control_plane.process_obligations (
    tenant_id,
    mission_id,
    obligation_state,
    grace_until,
    obligation_id
  );

INSERT INTO control_plane.contract_schemas (
  schema_name,
  schema_version,
  json_schema_id,
  schema_sha256,
  active
)
VALUES
  ('process-obligation-breach.v1', 1, 'urn:orca:migration-control-plane:process-obligation-breach.v1', '803cc97c41581cae8bb1afdb63e0572ee67c5754aebd0e6f8d210854d345c58b', true),
  ('process-obligation-definition.v1', 1, 'urn:orca:migration-control-plane:process-obligation-definition.v1', '697e152a6a5dcd8c7f4cd76a88246d96ff969d91450d8fc8c8ed36e3b2cd35fd', true),
  ('process-obligation-waiver.v1', 1, 'urn:orca:migration-control-plane:process-obligation-waiver.v1', '287373c057c0647814778d5b047006fa3333dfa101aea441c1c69198825b2480', true),
  ('process-obligation.v1', 1, 'urn:orca:migration-control-plane:process-obligation.v1', '2d932b4de5c49dd6a624d8bd4e5ab1b16ccdd0cfd7ad15e4f1fccee1dad7b54b', true);

UPDATE control_plane.kernel_metadata
SET value = 'c7542a37b87f29ea483fe5c7da31693f041e58621e116c7654580af7f199a736',
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
    'process-obligation-waiver.v1'
  )
  OR OLD.schema_name = 'knowledge-context-manifest.v1'
  OR OLD.schema_name = 'migration-proposal.v1'
  OR OLD.schema_name = 'safe-probe-plan.v1'
  OR OLD.schema_name = 'target-capability-snapshot.v1'
)
EXECUTE FUNCTION control_plane.reject_immutable_knowledge_record_mutation();
