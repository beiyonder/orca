export type FaultBoundary =
  | 'database'
  | 'process'
  | 'network'
  | 'object'
  | 'evaluator'
  | 'target'
  | 'memory'
  | 'mission'

export type FaultPointDefinition = {
  id: string
  boundary: FaultBoundary
  description: string
}

const DEFINITIONS_BY_ID: Record<string, FaultPointDefinition> = {
  'database.before_commit': {
    id: 'database.before_commit',
    boundary: 'database',
    description: 'Before an authoritative transaction commits.'
  },
  'database.after_commit': {
    id: 'database.after_commit',
    boundary: 'database',
    description: 'After commit, before dependent work observes it.'
  },
  'process.worker_started': {
    id: 'process.worker_started',
    boundary: 'process',
    description: 'After a worker starts, before it returns output.'
  },
  'process.worker_result_ready': {
    id: 'process.worker_result_ready',
    boundary: 'process',
    description: 'After output exists, before durable ingest.'
  },
  'network.before_dispatch': {
    id: 'network.before_dispatch',
    boundary: 'network',
    description: 'Before a dispatch frame leaves the sender.'
  },
  'network.after_dispatch': {
    id: 'network.after_dispatch',
    boundary: 'network',
    description: 'After dispatch, before acknowledgment.'
  },
  'object.before_write': {
    id: 'object.before_write',
    boundary: 'object',
    description: 'Before an artifact or object body is written.'
  },
  'object.after_write': {
    id: 'object.after_write',
    boundary: 'object',
    description: 'After body write, before metadata acceptance.'
  },
  'evaluator.before_run': {
    id: 'evaluator.before_run',
    boundary: 'evaluator',
    description: 'Before an evaluator reads its subject.'
  },
  'evaluator.after_verdict': {
    id: 'evaluator.after_verdict',
    boundary: 'evaluator',
    description: 'After verdict, before authoritative acceptance.'
  },
  'target.before_request': {
    id: 'target.before_request',
    boundary: 'target',
    description: 'Before an external target request.'
  },
  'target.after_response': {
    id: 'target.after_response',
    boundary: 'target',
    description: 'After target response, before receipt ingest.'
  },
  'memory.after_candidate': {
    id: 'memory.after_candidate',
    boundary: 'memory',
    description: 'After a candidate is recorded, before mission completion.'
  },
  'mission.before_terminal': {
    id: 'mission.before_terminal',
    boundary: 'mission',
    description: 'Before the terminal mission event commits.'
  }
}

export const FAULT_POINT_DEFINITIONS: readonly FaultPointDefinition[] =
  Object.values(DEFINITIONS_BY_ID)

export type FaultHit = {
  point: string
  boundary: FaultBoundary
  occurrence: number
}

export class InjectedFaultError extends Error {
  constructor(readonly hit: FaultHit) {
    super(`Injected fault at ${hit.point} occurrence ${hit.occurrence}`)
    this.name = 'InjectedFaultError'
  }
}

export class FaultNotReachedError extends Error {
  constructor(point: string, occurrence: number) {
    super(`Configured fault ${point} occurrence ${occurrence} was not reached`)
    this.name = 'FaultNotReachedError'
  }
}

export class FaultInjector {
  readonly #selected: string | null
  readonly #selectedOccurrence: number
  readonly #counts = new Map<string, number>()
  readonly #hits: FaultHit[] = []
  #injected = false

  constructor(point: string | null, occurrence = 1) {
    if (point !== null && !Object.hasOwn(DEFINITIONS_BY_ID, point)) {
      throw new TypeError(`Unknown fault point: ${point}`)
    }
    if (!Number.isSafeInteger(occurrence) || occurrence <= 0) {
      throw new TypeError('Fault occurrence must be a positive safe integer')
    }
    this.#selected = point
    this.#selectedOccurrence = occurrence
  }

  hit(point: string): void {
    const definition = DEFINITIONS_BY_ID[point]
    if (!definition) throw new TypeError(`Unknown fault point: ${point}`)
    const occurrence = (this.#counts.get(point) ?? 0) + 1
    this.#counts.set(point, occurrence)
    const hit = { point, boundary: definition.boundary, occurrence }
    this.#hits.push(hit)
    if (point === this.#selected && occurrence === this.#selectedOccurrence) {
      this.#injected = true
      throw new InjectedFaultError(hit)
    }
  }

  assertSatisfied(): void {
    if (this.#selected !== null && !this.#injected) {
      throw new FaultNotReachedError(this.#selected, this.#selectedOccurrence)
    }
  }

  hits(): readonly FaultHit[] {
    return this.#hits.map((hit) => ({ ...hit }))
  }
}

export function parseFaultSelection(value: string): string | null {
  if (value === 'none') return null
  if (!Object.hasOwn(DEFINITIONS_BY_ID, value)) throw new TypeError(`Unknown fault point: ${value}`)
  return value
}
