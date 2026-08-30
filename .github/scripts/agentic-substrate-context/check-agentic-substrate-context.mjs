#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  renderCurrentHandoff,
  renderSerenaProjectContext
} from './agentic-substrate-context-render.mjs'

const root = resolve(import.meta.dirname, '../../..')
const statePath = resolve(root, 'docs/agentic-substrate-project-state.json')
const handoffPath = resolve(root, 'docs/agentic-substrate-current-handoff.md')
const serenaMemoryPath = resolve(root, '.serena/memories/project-context.md')
const writeMode = process.argv.includes('--write')
const localMode = process.argv.includes('--local')
const unknownArguments = process.argv
  .slice(2)
  .filter((value) => !['--write', '--local'].includes(value))

if (unknownArguments.length > 0) {
  throw new TypeError(`Unknown argument: ${unknownArguments[0]}`)
}

function fail(message) {
  throw new Error(`Project context invalid: ${message}`)
}

function text(path) {
  return readFileSync(path, 'utf8').replaceAll('\r\n', '\n')
}

function exactKeys(value, keys, label) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail(`${label} must be an object`)
  }
  const actual = Object.keys(value).sort()
  const expected = [...keys].sort()
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(`${label} keys differ: ${actual.join(', ')}`)
  }
}

function nonEmpty(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    fail(`${label} must be non-empty`)
  }
}

function positiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    fail(`${label} must be a positive integer`)
  }
}

function command(binary, args) {
  return execFileSync(binary, args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  }).trim()
}

function repositoryFromUrl(url) {
  const match = url.match(/github\.com[/:]([^/]+\/[^/]+?)(?:\.git)?$/)
  return match?.[1] ?? null
}

const stateText = text(statePath)
const state = JSON.parse(stateText)

exactKeys(
  state,
  [
    'schemaVersion',
    'updatedAt',
    'authority',
    'delivery',
    'verification',
    'knownResiduals',
    'nextActions'
  ],
  'root'
)
if (state.schemaVersion !== 1) {
  fail('schemaVersion must be 1')
}
if (!Number.isFinite(Date.parse(state.updatedAt))) {
  fail('updatedAt must be ISO-8601')
}

exactKeys(
  state.authority,
  [
    'authoritativeRepository',
    'writeRemote',
    'defaultBranch',
    'defaultBaseRef',
    'readOnlyUpstreamRepository',
    'readOnlyUpstreamRemote',
    'githubWriteAllowlist'
  ],
  'authority'
)
if (state.authority.authoritativeRepository !== 'beiyonder/orca') {
  fail('authoritative repository must be beiyonder/orca')
}
if (state.authority.readOnlyUpstreamRepository !== 'stablyai/orca') {
  fail('read-only upstream must be stablyai/orca')
}
if (state.authority.writeRemote !== 'origin') {
  fail('write remote must be origin')
}
if (state.authority.readOnlyUpstreamRemote !== 'upstream') {
  fail('read-only remote must be upstream')
}
if (state.authority.defaultBaseRef !== 'origin/main') {
  fail('default base must be origin/main')
}
if (JSON.stringify(state.authority.githubWriteAllowlist) !== JSON.stringify(['beiyonder/orca'])) {
  fail('GitHub write allowlist must contain only beiyonder/orca')
}

exactKeys(
  state.delivery,
  [
    'status',
    'currentBranch',
    'baseRef',
    'implementedThrough',
    'mergedThrough',
    'currentCoordinate',
    'currentCoordinateStatus',
    'nextCoordinateAfterMerge',
    'forkPullRequest',
    'lastMergedForkPullRequest',
    'userApprovalRequiredBeforePullRequest'
  ],
  'delivery'
)
if (
  !['local-not-pushed', 'pushed-not-merged', 'pull-request-open', 'merged'].includes(
    state.delivery.status
  )
) {
  fail('delivery.status is unsupported')
}
if (state.delivery.status === 'merged' && state.delivery.currentBranch !== 'main') {
  fail('merged delivery must name main as the current branch')
}
for (const name of [
  'currentBranch',
  'baseRef',
  'implementedThrough',
  'mergedThrough',
  'currentCoordinate',
  'currentCoordinateStatus',
  'nextCoordinateAfterMerge',
  'lastMergedForkPullRequest'
]) {
  nonEmpty(state.delivery[name], `delivery.${name}`)
}
if (
  ['local-not-pushed', 'pushed-not-merged'].includes(state.delivery.status) &&
  state.delivery.forkPullRequest !== null
) {
  fail('delivery without a pull request cannot name one')
}
if (
  !state.delivery.lastMergedForkPullRequest.startsWith('https://github.com/beiyonder/orca/pull/')
) {
  fail('last merged pull request must belong to the authoritative fork')
}
if (state.delivery.userApprovalRequiredBeforePullRequest !== true) {
  fail('pull request creation must require explicit user approval')
}

exactKeys(
  state.verification,
  [
    'lastVerifiedAt',
    'commands',
    'domainSchemas',
    'migrations',
    'tables',
    'schemaFingerprint',
    'unitTestFiles',
    'unitTests',
    'postgresTestFiles',
    'postgresTests',
    'sealedExperiments'
  ],
  'verification'
)
if (!Number.isFinite(Date.parse(state.verification.lastVerifiedAt))) {
  fail('verification timestamp must be ISO-8601')
}
for (const name of [
  'domainSchemas',
  'migrations',
  'tables',
  'unitTestFiles',
  'unitTests',
  'postgresTestFiles',
  'postgresTests'
]) {
  positiveInteger(state.verification[name], `verification.${name}`)
}
if (!/^[a-f0-9]{64}$/.test(state.verification.schemaFingerprint)) {
  fail('schema fingerprint must be SHA-256')
}
if (!Array.isArray(state.verification.commands) || state.verification.commands.length === 0) {
  fail('verification commands are required')
}
if (!Array.isArray(state.nextActions) || state.nextActions.length === 0) {
  fail('next actions are required')
}
if (!Array.isArray(state.knownResiduals)) {
  fail('knownResiduals must be an array')
}
for (const [index, residual] of state.knownResiduals.entries()) {
  nonEmpty(residual.id, `knownResiduals[${index}].id`)
  nonEmpty(residual.status, `knownResiduals[${index}].status`)
  nonEmpty(residual.note, `knownResiduals[${index}].note`)
}

const generatedFiles = [
  [handoffPath, renderCurrentHandoff(state)],
  [serenaMemoryPath, renderSerenaProjectContext(state)]
]
for (const [path, expected] of generatedFiles) {
  if (writeMode) {
    writeFileSync(path, expected)
  } else if (text(path) !== expected) {
    fail(`${path} is stale; run with --write`)
  }
}

const agents = text(resolve(root, 'AGENTS.md'))
for (const required of [
  'Authoritative repository: `beiyonder/orca`.',
  'NEVER create or mutate a branch, pull request, issue, release, tag, project item, or other GitHub resource in `stablyai/orca`.',
  'node .github/scripts/agentic-substrate-context/check-agentic-substrate-context.mjs --local'
]) {
  if (!agents.includes(required)) {
    fail(`AGENTS.md is missing: ${required}`)
  }
}

if (
  !/read_only_memory_patterns:\s*\[['"]\^project-context\$['"]\]/.test(
    text(resolve(root, '.serena/project.yml'))
  )
) {
  fail('Serena generated project context memory must be read-only')
}

for (const path of [
  'docs/healthcare-prototype-roadmap.md',
  'docs/healthcare-system-design-mvp.html',
  'docs/agentic-substrate-codebase-study.md',
  'docs/agentic-substrate-experiment-queue.md',
  'docs/agentic-substrate-kernel-contracts.md',
  'docs/agentic-substrate-lab-handoff.md',
  'docs/agentic-substrate-lab-location.md',
  'docs/agentic-substrate-runtime-cut.md',
  'docs/agentic-substrate-s1-implementation-plan.md'
]) {
  if (!text(resolve(root, path)).includes('agentic-substrate-current-handoff.md')) {
    fail(`${path} must link to the canonical handoff`)
  }
}

for (const [path, staleText] of [
  [
    'docs/healthcare-prototype-roadmap.md',
    '**`P7-EVAL-11` — Implement held-out skill certification.**'
  ],
  ['docs/agentic-substrate-lab-handoff.md', 'Current roadmap coordinate:'],
  ['docs/agentic-substrate-experiment-queue.md', 'Begin `P7-EVAL-11`:']
]) {
  if (text(resolve(root, path)).includes(staleText)) {
    fail(`${path} retains stale live status: ${staleText}`)
  }
}

if (localMode) {
  const origin = repositoryFromUrl(command('git', ['remote', 'get-url', 'origin']))
  const upstream = repositoryFromUrl(command('git', ['remote', 'get-url', 'upstream']))
  const upstreamPushUrl = command('git', ['remote', 'get-url', '--push', 'upstream'])
  if (origin !== state.authority.authoritativeRepository) {
    fail(`origin points to ${origin ?? 'an unknown URL'}`)
  }
  if (upstream !== state.authority.readOnlyUpstreamRepository) {
    fail(`upstream points to ${upstream ?? 'an unknown URL'}`)
  }
  if (!upstreamPushUrl.startsWith('disabled://')) {
    fail('upstream push URL is not disabled')
  }
  if (command('git', ['config', '--get', 'remote.pushDefault']) !== state.authority.writeRemote) {
    fail('remote.pushDefault differs')
  }
  if (command('git', ['config', '--get', 'branch.main.remote']) !== state.authority.writeRemote) {
    fail('main does not track the writable remote')
  }
  const currentBranch = command('git', ['branch', '--show-current'])
  const [behind, ahead] = command('git', [
    'rev-list',
    '--left-right',
    '--count',
    `${state.delivery.baseRef}...HEAD`
  ])
    .split(/\s+/)
    .map(Number)
  if (state.delivery.status === 'merged') {
    const onMergedMain = currentBranch === 'main' && behind === 0 && ahead === 0
    const onContextUpdate =
      currentBranch.startsWith('chore/') &&
      behind === 0 &&
      Number.isSafeInteger(ahead) &&
      ahead >= 1
    if (!onMergedMain && !onContextUpdate) {
      fail(
        `merged delivery must be on synchronized main or an ahead-only chore branch; found ${currentBranch} ${behind}/${ahead}`
      )
    }
  } else {
    if (currentBranch !== state.delivery.currentBranch) {
      fail('current branch differs from canonical delivery state')
    }
    if (behind !== 0 || !Number.isSafeInteger(ahead) || ahead < 1) {
      fail(
        `branch must be ahead of and not behind ${state.delivery.baseRef}; found ${behind}/${ahead}`
      )
    }
  }
  if (
    command('gh', ['repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner']) !==
    state.authority.authoritativeRepository
  ) {
    fail('GitHub CLI default repository differs')
  }
}

console.log(
  `Project context verified${writeMode ? ' and generated' : ''}${localMode ? ' with local repository authority' : ''}.`
)
