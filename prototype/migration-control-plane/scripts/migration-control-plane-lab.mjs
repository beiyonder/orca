#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const labRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
const node = process.execPath

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: labRoot,
    env: process.env,
    stdio: 'inherit',
    shell: false
  })
  if (result.error) {
    console.error(result.error.message)
    return 1
  }
  return result.status ?? 1
}

function runPnpmScript(name) {
  return run(pnpm, ['run', name])
}

function verify() {
  for (const script of [
    'format:check:internal',
    'lint:internal',
    'typecheck:internal',
    'test:internal',
    'build:internal'
  ]) {
    const status = runPnpmScript(script)
    if (status !== 0) return status
  }
  return 0
}

function usage() {
  console.error(`Usage:
  node scripts/migration-control-plane-lab.mjs setup
  node scripts/migration-control-plane-lab.mjs build
  node scripts/migration-control-plane-lab.mjs typecheck
  node scripts/migration-control-plane-lab.mjs test
  node scripts/migration-control-plane-lab.mjs verify
  node scripts/migration-control-plane-lab.mjs experiment run --experiment <ID> --seed <N> --arm <baseline|candidate> --fault <name|none> --output <path>`)
  return 2
}

const [command, ...args] = process.argv.slice(2)
let status

switch (command) {
  case 'setup':
    status = run(pnpm, ['install', '--frozen-lockfile'])
    break
  case 'build':
  case 'typecheck':
  case 'test':
    status = runPnpmScript(`${command}:internal`)
    break
  case 'verify':
    status = verify()
    break
  case 'experiment': {
    if (args[0] !== 'run') {
      status = usage()
      break
    }
    status = runPnpmScript('build:internal')
    if (status === 0) {
      status = run(node, [join(labRoot, 'dist', 'cli.js'), ...args])
    }
    break
  }
  default:
    status = usage()
}

process.exitCode = status
