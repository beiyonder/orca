#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { delimiter, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const labRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const node = process.execPath
const pnpmInvocation =
  process.platform === 'win32'
    ? { command: node, args: [resolveWindowsPnpmCli()] }
    : { command: 'pnpm', args: [] }

function resolveWindowsPnpmCli() {
  const searchRoots = [process.env.PNPM_HOME, ...(process.env.PATH ?? '').split(delimiter)].filter(
    Boolean
  )
  for (const root of searchRoots) {
    for (const candidate of [
      join(root, 'pnpm.cjs'),
      resolve(root, '..', 'pnpm', 'bin', 'pnpm.cjs'),
      join(root, 'node_modules', 'pnpm', 'bin', 'pnpm.cjs'),
      join(root, '.tools', 'pnpm', '10.24.0', 'bin', 'pnpm.cjs'),
      join(root, 'node_modules', 'corepack', 'dist', 'pnpm.js')
    ]) {
      if (existsSync(candidate)) {
        return candidate
      }
    }
  }
  throw new Error('Unable to locate the pnpm JavaScript entrypoint on Windows')
}

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

function runPnpm(args) {
  return run(pnpmInvocation.command, [...pnpmInvocation.args, ...args])
}

function runPnpmScript(name) {
  return runPnpm(['run', name])
}

function verify() {
  for (const script of [
    'context:check:internal',
    'format:check:internal',
    'lint:internal',
    'typecheck:internal',
    'test:internal',
    'build:internal',
    'contracts:check:internal'
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
  node scripts/migration-control-plane-lab.mjs contracts generate|check
  node scripts/migration-control-plane-lab.mjs database migrate|fingerprint|verify
  node scripts/migration-control-plane-lab.mjs experiment run --experiment <ID> --seed <N> --arm <baseline|candidate> --fault <name|none> --output <path>`)
  return 2
}

const [command, ...args] = process.argv.slice(2)
let status

switch (command) {
  case 'setup':
    status = runPnpm(['install', '--frozen-lockfile'])
    break
  case 'build':
  case 'typecheck':
  case 'test':
    status = runPnpmScript(`${command}:internal`)
    break
  case 'verify':
    status = verify()
    break
  case 'contracts': {
    if (args.length !== 1 || (args[0] !== 'generate' && args[0] !== 'check')) {
      status = usage()
      break
    }
    status = runPnpmScript('build:internal')
    if (status === 0) {
      status = runPnpmScript(`contracts:${args[0]}:internal`)
    }
    break
  }
  case 'database': {
    if (
      args.length !== 1 ||
      (args[0] !== 'migrate' && args[0] !== 'fingerprint' && args[0] !== 'verify')
    ) {
      status = usage()
      break
    }
    status = runPnpmScript('build:internal')
    if (status === 0) {
      status = runPnpmScript(
        args[0] === 'verify' ? 'test:postgres:internal' : `database:${args[0]}:internal`
      )
    }
    break
  }
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
