CREATE TABLE control_plane.effect_attempts (
  tenant_id text NOT NULL,
  mission_id text NOT NULL,
  effect_attempt_id text NOT NULL,
  effect_id text NOT NULL,
  attempt_number integer NOT NULL CHECK (attempt_number BETWEEN 1 AND 100),
  fence bigint NOT NULL CHECK (fence BETWEEN 1 AND 9007199254740991),
  effect_state text NOT NULL CHECK (
    effect_state IN (
      'prepared',
      'issued',
      'applied',
      'absent',
      'unknown',
      'failed',
      'reconciling',
      'evaluating',
      'accepted',
      'rejected'
    )
  ),
  capability_envelope_id text NOT NULL,
  adapter_name text NOT NULL CHECK (length(adapter_name) BETWEEN 1 AND 128),
  adapter_version text NOT NULL CHECK (length(adapter_version) BETWEEN 1 AND 128),
  request_digest char(64) NOT NULL CHECK (request_digest ~ '^[a-f0-9]{64}$'),
  attempt jsonb NOT NULL CHECK (jsonb_typeof(attempt) = 'object'),
  attempt_sha256 char(64) NOT NULL CHECK (attempt_sha256 ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  completed_at timestamptz,
  PRIMARY KEY (tenant_id, effect_attempt_id),
  UNIQUE (tenant_id, effect_id, attempt_number),
  UNIQUE (tenant_id, effect_id, fence),
  FOREIGN KEY (tenant_id, mission_id)
    REFERENCES control_plane.mission_aggregates (tenant_id, mission_id),
  FOREIGN KEY (tenant_id, effect_id)
    REFERENCES control_plane.effect_executions (tenant_id, effect_id),
  FOREIGN KEY (tenant_id, effect_attempt_id)
    REFERENCES control_plane.domain_records (tenant_id, record_id),
  CHECK (attempt ->> 'id' = effect_attempt_id),
  CHECK (attempt ->> 'effectId' = effect_id),
  CHECK ((attempt ->> 'fence')::bigint = fence),
  CHECK (updated_at >= created_at),
  CHECK (completed_at IS NULL OR completed_at >= created_at)
);

CREATE INDEX effect_attempts_by_effect
  ON control_plane.effect_attempts (tenant_id, effect_id, attempt_number DESC);

ALTER TABLE control_plane.effect_executions
  DROP CONSTRAINT effect_executions_tenant_id_current_attempt_id_fkey,
  DROP CONSTRAINT effect_executions_effect_state_check,
  ADD CONSTRAINT effect_executions_effect_state_check CHECK (
    effect_state IN (
      'prepared',
      'issued',
      'applied',
      'absent',
      'unknown',
      'failed',
      'reconciling',
      'evaluating',
      'accepted',
      'rejected',
      'quarantined'
    )
  ),
  ADD CONSTRAINT effect_executions_current_effect_attempt_fk
    FOREIGN KEY (tenant_id, current_attempt_id)
    REFERENCES control_plane.effect_attempts (tenant_id, effect_attempt_id)
    DEFERRABLE INITIALLY DEFERRED;
