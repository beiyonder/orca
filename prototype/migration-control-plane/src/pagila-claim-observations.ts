import type { EvidenceIdSchema } from './domain/common-contracts.js'
import type { SourceSchemaInventoryV1 } from './domain/source-inventory-contracts.js'
import type { SourceDataProfileV1 } from './domain/source-profile-contracts.js'
import type { SourceClaimObservation } from './source-claim-comparator.js'
import type { z } from 'zod'

type EvidenceId = z.infer<typeof EvidenceIdSchema>

export function pagilaClaimObservations(
  schema: SourceSchemaInventoryV1,
  profile: SourceDataProfileV1,
  metadata: {
    observedAt: string
    inventoryEvidence: EvidenceId
    profileEvidence: EvidenceId
    denialEvidence: EvidenceId
  }
): SourceClaimObservation[] {
  const actorCount =
    profile.profiles.find((item) => item.relation.name === 'actor')?.rowCount ?? null
  const observed = (
    key: string,
    value: unknown,
    evidenceIds: EvidenceId[] = [metadata.inventoryEvidence]
  ): SourceClaimObservation => ({
    key,
    status: 'observed',
    value,
    observationIds: ['source_observation_pagila_qualification'],
    evidenceIds,
    observedAt: metadata.observedAt,
    staleAfter: null,
    reason: 'Current bounded Pagila observation.'
  })
  return [
    observed('actor-count', actorCount, [metadata.profileEvidence]),
    observed(
      'payment-partitioned',
      schema.relations.some((item) => item.name === 'payment' && item.kind === 'partitioned-table')
    ),
    observed('trigger-count', schema.triggers.length),
    observed('function-count', schema.routines.length),
    observed(
      'materialized-view-count',
      schema.relations.filter((item) => item.kind === 'materialized-view').length
    ),
    observed('domain-count', schema.customTypes.filter((item) => item.kind === 'domain').length),
    observed(
      'foreign-key-count',
      schema.constraints.filter((item) => item.kind === 'foreign-key').length
    ),
    observed(
      'film-fulltext-trigger',
      schema.triggers.some(
        (item) => item.name === 'film' && item.trigger === 'film_fulltext_trigger'
      )
    ),
    observed('public-schema', schema.schemas.includes('public')),
    {
      key: 'private-audit',
      status: 'denied',
      value: null,
      observationIds: ['source_observation_pagila_denial'],
      evidenceIds: [metadata.denialEvidence],
      observedAt: metadata.observedAt,
      staleAfter: null,
      reason: 'USAGE denied for private_audit; absence is not established.'
    }
  ]
}
