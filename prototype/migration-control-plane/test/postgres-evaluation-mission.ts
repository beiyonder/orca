import type { Pool } from 'pg'
import { canonicalJson, sha256Text } from '../src/canonical-json.js'
import { insertPostgresDomainRecords } from '../src/database/postgres-domain-record-store.js'
import { MissionRecordV1Schema } from '../src/domain/mission-contracts.js'
import { DOMAIN_CONTRACT_SAMPLES } from './domain-contract-samples.js'

export async function seedEvaluationMission(pool: Pool): Promise<void> {
  const mission = MissionRecordV1Schema.parse(DOMAIN_CONTRACT_SAMPLES['mission-record.v1'])
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await insertPostgresDomainRecords(client, [
      {
        tenantId: mission.tenantId,
        recordId: mission.id,
        missionId: mission.id,
        schemaName: 'mission-record.v1',
        recordKind: mission.kind,
        recordState: mission.state.status,
        payload: mission,
        createdAt: mission.createdAt
      }
    ])
    const missionJson = canonicalJson(mission)
    await client.query(
      `INSERT INTO control_plane.mission_aggregates (
         tenant_id, mission_id, revision, mission_state, current_plan_revision_id,
         record, record_sha256, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9)`,
      [
        mission.tenantId,
        mission.id,
        mission.revision,
        mission.state.status,
        mission.currentPlanRevisionId,
        missionJson,
        sha256Text(missionJson),
        mission.createdAt,
        mission.updatedAt
      ]
    )
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
