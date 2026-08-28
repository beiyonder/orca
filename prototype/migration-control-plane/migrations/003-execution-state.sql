CREATE TABLE control_plane.plan_revisions (
  tenant_id text NOT NULL,
  mission_id text NOT NULL,
  plan_revision_id text NOT NULL,
  revision integer NOT NULL CHECK (revision > 0),
  base_plan_revision_id text,
  base_mission_revision bigint NOT NULL CHECK (base_mission_revision BETWEEN 0 AND 9007199254740991),
  plan jsonb NOT NULL CHECK (jsonb_typeof(plan) = 'object'),
  plan_sha256 char(64) NOT NULL CHECK (plan_sha256 ~ '^[a-f0-9]{64}$'),
  committed_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, plan_revision_id),
  UNIQUE (tenant_id, mission_id, revision),
  FOREIGN KEY (tenant_id, mission_id)
    REFERENCES control_plane.mission_aggregates (tenant_id, mission_id),
  FOREIGN KEY (tenant_id, plan_revision_id)
    REFERENCES control_plane.domain_records (tenant_id, record_id),
  FOREIGN KEY (tenant_id, base_plan_revision_id)
    REFERENCES control_plane.plan_revisions (tenant_id, plan_revision_id),
  CHECK (plan ->> 'id' = plan_revision_id),
  CHECK (plan ->> 'missionId' = mission_id),
  CHECK (
    (revision = 1 AND base_plan_revision_id IS NULL)
    OR (revision > 1 AND base_plan_revision_id IS NOT NULL)
  )
);

CREATE TABLE control_plane.task_executions (
  tenant_id text NOT NULL,
  mission_id text NOT NULL,
  task_id text NOT NULL,
  plan_revision_id text NOT NULL,
  task_state text NOT NULL CHECK (
    task_state IN (
      'pending',
      'runnable',
      'leased',
      'running',
      'evaluating',
      'completed',
      'failed',
      'cancelled',
      'blocked',
      'quarantined'
    )
  ),
  current_attempt_id text,
  current_fence bigint NOT NULL DEFAULT 0 CHECK (current_fence BETWEEN 0 AND 9007199254740991),
  not_before timestamptz,
  task jsonb NOT NULL CHECK (jsonb_typeof(task) = 'object'),
  task_sha256 char(64) NOT NULL CHECK (task_sha256 ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  completed_at timestamptz,
  PRIMARY KEY (tenant_id, task_id),
  FOREIGN KEY (tenant_id, mission_id)
    REFERENCES control_plane.mission_aggregates (tenant_id, mission_id),
  FOREIGN KEY (tenant_id, plan_revision_id)
    REFERENCES control_plane.plan_revisions (tenant_id, plan_revision_id),
  FOREIGN KEY (tenant_id, task_id)
    REFERENCES control_plane.domain_records (tenant_id, record_id),
  CHECK (task ->> 'id' = task_id),
  CHECK (task ->> 'missionId' = mission_id),
  CHECK (updated_at >= created_at),
  CHECK (completed_at IS NULL OR completed_at >= created_at),
  CHECK (
    (task_state IN ('completed', 'failed', 'cancelled', 'quarantined') AND completed_at IS NOT NULL)
    OR (task_state NOT IN ('completed', 'failed', 'cancelled', 'quarantined') AND completed_at IS NULL)
  )
);

CREATE INDEX task_executions_runnable
  ON control_plane.task_executions (not_before, created_at, tenant_id, task_id)
  WHERE task_state = 'runnable';
CREATE INDEX task_executions_by_mission_state
  ON control_plane.task_executions (tenant_id, mission_id, task_state, updated_at, task_id);

CREATE TABLE control_plane.plan_task_edges (
  tenant_id text NOT NULL,
  mission_id text NOT NULL,
  plan_revision_id text NOT NULL,
  task_id text NOT NULL,
  dependency_task_id text NOT NULL,
  dependency_contract_sha256 char(64) NOT NULL CHECK (
    dependency_contract_sha256 ~ '^[a-f0-9]{64}$'
  ),
  recovery_rule text NOT NULL CHECK (length(recovery_rule) BETWEEN 1 AND 512),
  PRIMARY KEY (tenant_id, plan_revision_id, task_id, dependency_task_id),
  FOREIGN KEY (tenant_id, plan_revision_id)
    REFERENCES control_plane.plan_revisions (tenant_id, plan_revision_id),
  FOREIGN KEY (tenant_id, task_id)
    REFERENCES control_plane.task_executions (tenant_id, task_id),
  FOREIGN KEY (tenant_id, dependency_task_id)
    REFERENCES control_plane.task_executions (tenant_id, task_id),
  CHECK (task_id <> dependency_task_id)
);

CREATE INDEX plan_task_edges_by_dependency
  ON control_plane.plan_task_edges (tenant_id, plan_revision_id, dependency_task_id, task_id);

CREATE TABLE control_plane.assignment_attempts (
  tenant_id text NOT NULL,
  mission_id text NOT NULL,
  attempt_id text NOT NULL,
  assignment_id text NOT NULL,
  task_id text NOT NULL,
  attempt_number integer NOT NULL CHECK (attempt_number > 0),
  fence bigint NOT NULL CHECK (fence BETWEEN 1 AND 9007199254740991),
  attempt_state text NOT NULL CHECK (
    attempt_state IN (
      'claimed',
      'running',
      'result-submitted',
      'evaluating',
      'succeeded',
      'failed',
      'cancelled',
      'stale'
    )
  ),
  lease_owner text NOT NULL CHECK (length(lease_owner) BETWEEN 1 AND 256),
  lease_expires_at timestamptz NOT NULL,
  heartbeat_at timestamptz,
  worker_incarnation text,
  context_manifest_id text NOT NULL,
  attempt jsonb NOT NULL CHECK (jsonb_typeof(attempt) = 'object'),
  attempt_sha256 char(64) NOT NULL CHECK (attempt_sha256 ~ '^[a-f0-9]{64}$'),
  result jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, attempt_id),
  UNIQUE (tenant_id, task_id, attempt_number),
  UNIQUE (tenant_id, task_id, fence),
  FOREIGN KEY (tenant_id, mission_id)
    REFERENCES control_plane.mission_aggregates (tenant_id, mission_id),
  FOREIGN KEY (tenant_id, task_id)
    REFERENCES control_plane.task_executions (tenant_id, task_id),
  FOREIGN KEY (tenant_id, attempt_id)
    REFERENCES control_plane.domain_records (tenant_id, record_id),
  CHECK (attempt ->> 'id' = attempt_id),
  CHECK (attempt ->> 'missionId' = mission_id),
  CHECK ((attempt ->> 'fence')::bigint = fence),
  CHECK (updated_at >= created_at),
  CHECK (heartbeat_at IS NULL OR heartbeat_at >= created_at),
  CHECK (started_at IS NULL OR started_at >= created_at),
  CHECK (completed_at IS NULL OR completed_at >= created_at)
);

ALTER TABLE control_plane.task_executions
  ADD CONSTRAINT task_executions_current_attempt_fk
  FOREIGN KEY (tenant_id, current_attempt_id)
  REFERENCES control_plane.assignment_attempts (tenant_id, attempt_id)
  DEFERRABLE INITIALLY DEFERRED;

CREATE INDEX assignment_attempts_active_leases
  ON control_plane.assignment_attempts (lease_expires_at, tenant_id, attempt_id)
  WHERE attempt_state IN ('claimed', 'running', 'result-submitted', 'evaluating');
CREATE INDEX assignment_attempts_by_task
  ON control_plane.assignment_attempts (tenant_id, task_id, attempt_number DESC);

CREATE TABLE control_plane.effect_executions (
  tenant_id text NOT NULL,
  mission_id text NOT NULL,
  effect_id text NOT NULL,
  task_id text NOT NULL,
  effect_state text NOT NULL CHECK (
    effect_state IN (
      'prepared',
      'issued',
      'applied',
      'absent',
      'unknown',
      'failed',
      'evaluating',
      'accepted',
      'rejected',
      'quarantined'
    )
  ),
  adapter_name text NOT NULL CHECK (length(adapter_name) BETWEEN 1 AND 128),
  target_identity text NOT NULL CHECK (length(target_identity) BETWEEN 1 AND 4096),
  idempotency_key text NOT NULL CHECK (length(idempotency_key) BETWEEN 1 AND 256),
  intent_sha256 char(64) NOT NULL CHECK (intent_sha256 ~ '^[a-f0-9]{64}$'),
  current_attempt_id text,
  current_fence bigint NOT NULL DEFAULT 0 CHECK (current_fence BETWEEN 0 AND 9007199254740991),
  intent jsonb NOT NULL CHECK (jsonb_typeof(intent) = 'object'),
  latest_receipt jsonb,
  last_observation jsonb,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  terminal_at timestamptz,
  PRIMARY KEY (tenant_id, effect_id),
  UNIQUE (tenant_id, adapter_name, target_identity, idempotency_key),
  FOREIGN KEY (tenant_id, mission_id)
    REFERENCES control_plane.mission_aggregates (tenant_id, mission_id),
  FOREIGN KEY (tenant_id, task_id)
    REFERENCES control_plane.task_executions (tenant_id, task_id),
  FOREIGN KEY (tenant_id, effect_id)
    REFERENCES control_plane.domain_records (tenant_id, record_id),
  FOREIGN KEY (tenant_id, current_attempt_id)
    REFERENCES control_plane.assignment_attempts (tenant_id, attempt_id),
  CHECK (intent ->> 'id' = effect_id),
  CHECK (intent ->> 'missionId' = mission_id),
  CHECK (updated_at >= created_at),
  CHECK (terminal_at IS NULL OR terminal_at >= created_at),
  CHECK (
    (effect_state IN ('accepted', 'rejected', 'quarantined') AND terminal_at IS NOT NULL)
    OR (effect_state NOT IN ('accepted', 'rejected', 'quarantined') AND terminal_at IS NULL)
  )
);

CREATE INDEX effect_executions_by_mission_state
  ON control_plane.effect_executions (tenant_id, mission_id, effect_state, updated_at, effect_id);
CREATE INDEX effect_executions_reconcile
  ON control_plane.effect_executions (updated_at, tenant_id, effect_id)
  WHERE effect_state IN ('issued', 'unknown', 'evaluating');

CREATE TABLE control_plane.recovery_work (
  tenant_id text NOT NULL,
  mission_id text NOT NULL,
  subject_kind text NOT NULL CHECK (subject_kind IN ('task', 'attempt', 'effect', 'outbox')),
  subject_id text NOT NULL,
  observed_state text NOT NULL CHECK (length(observed_state) BETWEEN 1 AND 128),
  disposition text CHECK (
    disposition IN ('resume', 'retry', 'reconcile', 'fail', 'quarantine', 'no-action')
  ),
  disposition_reason text,
  due_at timestamptz NOT NULL,
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  claimed_by text,
  claim_expires_at timestamptz,
  fence bigint NOT NULL DEFAULT 0 CHECK (fence BETWEEN 0 AND 9007199254740991),
  completed_at timestamptz,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, subject_kind, subject_id),
  FOREIGN KEY (tenant_id, mission_id)
    REFERENCES control_plane.mission_aggregates (tenant_id, mission_id),
  CHECK (
    (claimed_by IS NULL AND claim_expires_at IS NULL)
    OR (claimed_by IS NOT NULL AND claim_expires_at IS NOT NULL)
  ),
  CHECK (updated_at >= created_at),
  CHECK (completed_at IS NULL OR completed_at >= created_at)
);

CREATE INDEX recovery_work_ready
  ON control_plane.recovery_work (due_at, tenant_id, subject_kind, subject_id)
  WHERE completed_at IS NULL;
