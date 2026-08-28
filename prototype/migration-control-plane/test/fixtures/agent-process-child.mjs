import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { access, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const mode = process.argv[2]

function writeAsync(stream, payload) {
  const { promise, resolve } = Promise.withResolvers()
  stream.write(payload, resolve)
  return promise
}

if (mode === 'echo') {
  process.stdout.write('ready\n')
  process.stderr.write('diagnostic\n')
  process.exitCode = 7
} else if (mode === 'flood') {
  const payload = Buffer.alloc(128 * 1024, 'x')
  await Promise.all([writeAsync(process.stdout, payload), writeAsync(process.stderr, payload)])
} else if (mode === 'print-env') {
  const names = [
    'HOME',
    'USERPROFILE',
    'XDG_CONFIG_HOME',
    'PI_CODING_AGENT_DIR',
    'AWS_ACCESS_KEY_ID',
    'ANTHROPIC_API_KEY',
    'OMP_PROFILE',
    'PI_CONFIG_FILES',
    'NODE_OPTIONS',
    'SSH_AUTH_SOCK'
  ]
  process.stdout.write(
    `${JSON.stringify({
      cwd: process.cwd(),
      variables: Object.fromEntries(names.map((name) => [name, process.env[name] ?? null]))
    })}\n`
  )
} else if (mode === 'reconstruct-context') {
  const contextPath = process.argv[3]
  const expectedDigest = process.argv[4]
  const markerPath = join(process.cwd(), '.worker-hidden-state')
  let hadHiddenState = true
  try {
    await access(markerPath)
  } catch {
    hadHiddenState = false
  }
  const contextBytes = await readFile(contextPath)
  const contextDigest = createHash('sha256').update(contextBytes).digest('hex')
  process.stdout.write(`${JSON.stringify({ contextDigest, expectedDigest, hadHiddenState })}\n`)
  await writeFile(markerPath, 'worker-local-state')
  if (contextDigest !== expectedDigest) {
    process.exitCode = 3
  } else {
    process.on('SIGTERM', () => {})
    process.on('SIGINT', () => {})
    setInterval(() => {}, 1_000)
  }
} else if (mode === 'idle' || mode === 'ignore-term' || mode === 'tree') {
  if (mode === 'idle') {
    process.on('SIGTERM', () => process.exit(0))
    process.on('SIGINT', () => process.exit(0))
  } else {
    process.on('SIGTERM', () => {})
    process.on('SIGINT', () => {})
  }
  if (mode === 'tree') {
    const grandchild = spawn(
      process.execPath,
      ['-e', "process.on('SIGTERM',()=>{});process.on('SIGINT',()=>{});setInterval(()=>{},1000)"],
      { stdio: 'ignore', windowsHide: true, shell: false }
    )
    process.stdout.write(`${JSON.stringify({ grandchildPid: grandchild.pid })}\n`)
  } else {
    process.stdout.write('ready\n')
  }
  setInterval(() => {}, 1_000)
} else {
  process.stderr.write(`unknown mode: ${String(mode)}\n`)
  process.exitCode = 2
}
