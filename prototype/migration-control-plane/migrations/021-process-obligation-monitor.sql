ALTER TABLE control_plane.process_obligations
  ADD COLUMN monitor_claimed_at timestamptz;

ALTER TABLE control_plane.process_obligations
  ADD CONSTRAINT process_obligations_monitor_claim_time_coherent CHECK (
    (monitor_claimed_by IS NULL AND monitor_claimed_at IS NULL)
    OR
    (monitor_claimed_by IS NOT NULL AND monitor_claimed_at IS NOT NULL)
  );

CREATE INDEX process_obligations_monitor_claim_idx
  ON control_plane.process_obligations (
    tenant_id,
    monitor_claim_expires_at,
    grace_until,
    obligation_id
  )
  WHERE obligation_state = 'pending' AND breach_id IS NULL;

CREATE TABLE control_plane.process_obligation_monitor_health (
  tenant_id text PRIMARY KEY,
  last_sweep_started_at timestamptz NOT NULL,
  last_sweep_succeeded_at timestamptz,
  last_claimed_count integer NOT NULL DEFAULT 0,
  last_breached_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  CHECK (tenant_id ~ '^tenant_[a-z0-9][a-z0-9_-]{0,111}$'),
  CHECK (last_claimed_count >= 0),
  CHECK (last_breached_count >= 0),
  CHECK (
    last_sweep_succeeded_at IS NULL
    OR last_sweep_succeeded_at >= last_sweep_started_at
  )
);
