CREATE TABLE control_plane.mission_aggregates (
  tenant_id text NOT NULL,
  mission_id text NOT NULL,
  revision bigint NOT NULL CHECK (revision BETWEEN 0 AND 9007199254740991),
  mission_state text NOT NULL CHECK (
    mission_state IN (
      'created',
      'investigating',
      'planning',
      'executing',
      'evaluating',
      'blocked',
      'completed',
      'failed',
      'quarantined'
    )
  ),
  current_plan_revision_id text,
  record jsonb NOT NULL CHECK (jsonb_typeof(record) = 'object'),
  record_sha256 char(64) NOT NULL CHECK (record_sha256 ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, mission_id),
  FOREIGN KEY (tenant_id, mission_id)
    REFERENCES control_plane.domain_records (tenant_id, record_id),
  CHECK (record ->> 'id' = mission_id),
  CHECK (record ->> 'tenantId' = tenant_id),
  CHECK ((record ->> 'revision')::bigint = revision),
  CHECK (updated_at >= created_at)
);

CREATE INDEX mission_aggregates_by_state
  ON control_plane.mission_aggregates (tenant_id, mission_state, updated_at, mission_id);

CREATE TABLE control_plane.mission_commands (
  tenant_id text NOT NULL,
  command_id text NOT NULL,
  mission_id text NOT NULL,
  expected_revision bigint CHECK (expected_revision BETWEEN 0 AND 9007199254740991),
  command_type text NOT NULL CHECK (
    command_type IN (
      'create-mission',
      'record-evidence',
      'commit-plan-revision',
      'create-assignment',
      'record-assignment-result',
      'request-evaluation',
      'record-evaluation-result',
      'request-correction',
      'record-learning-candidate',
      'change-mission-state'
    )
  ),
  payload_sha256 char(64) NOT NULL CHECK (payload_sha256 ~ '^[a-f0-9]{64}$'),
  command_sha256 char(64) NOT NULL CHECK (command_sha256 ~ '^[a-f0-9]{64}$'),
  command jsonb NOT NULL CHECK (jsonb_typeof(command) = 'object'),
  status text NOT NULL CHECK (status IN ('received', 'committed', 'rejected')),
  result jsonb,
  result_sha256 char(64) CHECK (result_sha256 ~ '^[a-f0-9]{64}$'),
  error_code text,
  created_at timestamptz NOT NULL,
  completed_at timestamptz,
  PRIMARY KEY (tenant_id, command_id),
  CHECK (command ->> 'id' = command_id),
  CHECK (command ->> 'tenantId' = tenant_id),
  CHECK (command ->> 'missionId' = mission_id),
  CHECK (command ->> 'kind' = 'mission-command'),
  CHECK (command ->> 'commandType' = command_type),
  CHECK (command ->> 'payloadDigest' = trim(payload_sha256)),
  CHECK ((result IS NULL) = (result_sha256 IS NULL)),
  CHECK (status <> 'committed' OR result IS NOT NULL),
  CHECK (status <> 'rejected' OR error_code IS NOT NULL),
  CHECK (
    (command_type = 'create-mission' AND expected_revision IS NULL)
    OR (command_type <> 'create-mission' AND expected_revision IS NOT NULL)
  ),
  CHECK (
    (status = 'received' AND completed_at IS NULL)
    OR (status <> 'received' AND completed_at IS NOT NULL)
  ),
  CHECK (completed_at IS NULL OR completed_at >= created_at)
);

CREATE INDEX mission_commands_by_mission_time
  ON control_plane.mission_commands (tenant_id, mission_id, created_at, command_id);

CREATE TABLE control_plane.mission_events (
  tenant_id text NOT NULL,
  mission_id text NOT NULL,
  aggregate_revision bigint NOT NULL CHECK (aggregate_revision BETWEEN 1 AND 9007199254740991),
  event_id text NOT NULL,
  causation_command_id text NOT NULL,
  event_type text NOT NULL CHECK (length(event_type) BETWEEN 1 AND 128),
  payload_sha256 char(64) NOT NULL CHECK (payload_sha256 ~ '^[a-f0-9]{64}$'),
  event_sha256 char(64) NOT NULL CHECK (event_sha256 ~ '^[a-f0-9]{64}$'),
  event jsonb NOT NULL CHECK (jsonb_typeof(event) = 'object'),
  recorded_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, mission_id, aggregate_revision),
  UNIQUE (tenant_id, event_id),
  FOREIGN KEY (tenant_id, mission_id)
    REFERENCES control_plane.mission_aggregates (tenant_id, mission_id),
  FOREIGN KEY (tenant_id, causation_command_id)
    REFERENCES control_plane.mission_commands (tenant_id, command_id),
  CHECK (event ->> 'id' = event_id),
  CHECK (event ->> 'tenantId' = tenant_id),
  CHECK (event ->> 'missionId' = mission_id),
  CHECK ((event ->> 'aggregateRevision')::bigint = aggregate_revision),
  CHECK (event ->> 'kind' = 'mission-event'),
  CHECK (event ->> 'eventType' = event_type),
  CHECK (event ->> 'payloadDigest' = trim(payload_sha256))
);

CREATE INDEX mission_events_by_type_time
  ON control_plane.mission_events (tenant_id, mission_id, event_type, recorded_at);

CREATE TABLE control_plane.mission_projections (
  tenant_id text NOT NULL,
  mission_id text NOT NULL,
  projection_name text NOT NULL CHECK (projection_name ~ '^[a-z][a-z0-9_-]{0,127}$'),
  event_revision bigint NOT NULL CHECK (event_revision BETWEEN 0 AND 9007199254740991),
  projection jsonb NOT NULL CHECK (jsonb_typeof(projection) = 'object'),
  projection_sha256 char(64) NOT NULL CHECK (projection_sha256 ~ '^[a-f0-9]{64}$'),
  rebuilt_at timestamptz,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, mission_id, projection_name),
  FOREIGN KEY (tenant_id, mission_id)
    REFERENCES control_plane.mission_aggregates (tenant_id, mission_id)
);

CREATE INDEX mission_projections_by_position
  ON control_plane.mission_projections (projection_name, event_revision, tenant_id, mission_id);

CREATE TABLE control_plane.outbox_messages (
  tenant_id text NOT NULL,
  message_id text NOT NULL,
  mission_id text NOT NULL,
  event_id text,
  topic text NOT NULL CHECK (topic ~ '^[a-z][a-z0-9._-]{0,127}$'),
  message_key text NOT NULL CHECK (length(message_key) BETWEEN 1 AND 256),
  payload jsonb NOT NULL,
  payload_sha256 char(64) NOT NULL CHECK (payload_sha256 ~ '^[a-f0-9]{64}$'),
  available_at timestamptz NOT NULL,
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  lease_owner text,
  lease_expires_at timestamptz,
  fence bigint NOT NULL DEFAULT 0 CHECK (fence BETWEEN 0 AND 9007199254740991),
  delivered_at timestamptz,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, message_id),
  FOREIGN KEY (tenant_id, mission_id)
    REFERENCES control_plane.mission_aggregates (tenant_id, mission_id),
  FOREIGN KEY (tenant_id, event_id)
    REFERENCES control_plane.mission_events (tenant_id, event_id),
  CHECK (
    (lease_owner IS NULL AND lease_expires_at IS NULL)
    OR (lease_owner IS NOT NULL AND lease_expires_at IS NOT NULL)
  ),
  CHECK (delivered_at IS NULL OR delivered_at >= created_at)
);

CREATE INDEX outbox_messages_ready
  ON control_plane.outbox_messages (available_at, tenant_id, message_id)
  WHERE delivered_at IS NULL;
CREATE INDEX outbox_messages_by_mission
  ON control_plane.outbox_messages (tenant_id, mission_id, created_at, message_id);

CREATE TABLE control_plane.inbox_messages (
  tenant_id text NOT NULL,
  consumer_name text NOT NULL CHECK (consumer_name ~ '^[a-z][a-z0-9._-]{0,127}$'),
  message_id text NOT NULL,
  payload_sha256 char(64) NOT NULL CHECK (payload_sha256 ~ '^[a-f0-9]{64}$'),
  result jsonb NOT NULL,
  received_at timestamptz NOT NULL,
  processed_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, consumer_name, message_id),
  CHECK (processed_at >= received_at)
);

CREATE INDEX inbox_messages_by_processed_time
  ON control_plane.inbox_messages (tenant_id, consumer_name, processed_at, message_id);
