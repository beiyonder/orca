import { spawn } from 'node:child_process'

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
