#!/usr/bin/env node
import { resolve } from 'node:path'
import { runPrototypeQualification } from './prototype-qualification-runner.js'

function option(args: string[], name: string): string {
  const index = args.indexOf(name)
  const value = index === -1 ? undefined : args[index + 1]
  if (!value || value.startsWith('--')) {
    throw new TypeError(`Missing required qualification option: ${name}`)
  }
  return value
}

async function main(): Promise<void> {
  try {
    const args = process.argv.slice(2)
    if (args[0] !== 'run') {
      throw new TypeError('Qualification command must be run')
    }
    const controlConnectionString = process.env.MIGRATION_CONTROL_DATABASE_URL
    const targetConnectionString = process.env.MIGRATION_CONTROL_TARGET_DATABASE_URL
    const pagilaConnectionString = process.env.PAGILA_DISCOVERY_DATABASE_URL
    if (!controlConnectionString || !targetConnectionString || !pagilaConnectionString) {
      throw new TypeError(
        'MIGRATION_CONTROL_DATABASE_URL, MIGRATION_CONTROL_TARGET_DATABASE_URL, and PAGILA_DISCOVERY_DATABASE_URL are required'
      )
    }
    const labRoot = process.cwd()
    const result = await runPrototypeQualification({
      labRoot,
      profilePath: option(args, '--profile'),
      outputRoot: resolve(labRoot, option(args, '--output')),
      controlConnectionString,
      targetConnectionString,
      pagilaConnectionString,
      ...(process.env.ORCA_PROTOTYPE_REVISION === undefined
        ? {}
        : { revision: process.env.ORCA_PROTOTYPE_REVISION })
    })
    process.stdout.write(`${JSON.stringify(result)}\n`)
    process.exitCode = result.status === 'passed' ? 0 : 1
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    process.stderr.write(`${JSON.stringify({ status: 'error', error: message })}\n`)
    process.exitCode = 2
  }
}

await main()
