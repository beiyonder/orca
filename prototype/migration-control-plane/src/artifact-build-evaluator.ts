import { execFile } from 'node:child_process'
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { version as typescriptVersion } from 'typescript'
import { canonicalJson, sha256Text } from './canonical-json.js'
import {
  ArtifactBuildBundleV1Schema,
  ArtifactBuildEvaluationReportV1Schema,
  type ArtifactBuildBundleV1,
  type ArtifactBuildEvaluationReportV1
} from './domain/artifact-build-evaluator-contracts.js'
import { evaluationRecordDigest } from './evaluation-contract-registry.js'

const execFileAsync = promisify(execFile)
const TSC_PATH = fileURLToPath(new URL('../node_modules/typescript/bin/tsc', import.meta.url))
const COMPILER_OPTIONS = {
  strict: true,
  noEmitOnError: true,
  target: 'ES2022',
  module: 'NodeNext',
  moduleResolution: 'NodeNext',
  rootDir: 'src',
  resolveJsonModule: true,
  skipLibCheck: true
} as const

export const ARTIFACT_COMPILER_OPTIONS_DIGEST = sha256Text(canonicalJson(COMPILER_OPTIONS))

type BuildRun = {
  diagnostics: ArtifactBuildEvaluationReportV1['diagnostics']
  emittedDigest: string | null
}
function compilerEnvironment(): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = {}
  for (const name of ['PATH', 'SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP', 'TMPDIR']) {
    const value = process.env[name]
    if (value !== undefined) {
      environment[name] = value
    }
  }
  return environment
}

async function build(bundle: ArtifactBuildBundleV1): Promise<BuildRun> {
  const root = await mkdtemp(join(tmpdir(), 'orca-artifact-evaluator-'))
  const output = join(root, 'output')
  try {
    for (const file of bundle.files) {
      const target = resolve(root, file.path)
      const fromRoot = relative(root, target)
      if (isAbsolute(fromRoot) || fromRoot === '..' || fromRoot.startsWith(`..${sep}`)) {
        throw new TypeError(`Artifact path escapes sandbox: ${file.path}`)
      }
      await mkdir(dirname(target), { recursive: true })
      await writeFile(target, file.content, 'utf8')
    }
    const config = join(root, 'tsconfig.json')
    await writeFile(
      config,
      canonicalJson({
        compilerOptions: { ...COMPILER_OPTIONS, outDir: output },
        include: ['src/**/*']
      }),
      'utf8'
    )
    let diagnostics: ArtifactBuildEvaluationReportV1['diagnostics'] = []
    try {
      await execFileAsync(process.execPath, [TSC_PATH, '--project', config], {
        cwd: root,
        timeout: 60_000,
        maxBuffer: 1_048_576,
        env: compilerEnvironment()
      })
    } catch (error) {
      const outputText =
        typeof error === 'object' && error !== null
          ? `${'stdout' in error ? String(error.stdout) : ''}\n${'stderr' in error ? String(error.stderr) : ''}`
          : String(error)
      diagnostics = [
        {
          code: 'typescript-build',
          file: null,
          line: null,
          message:
            outputText.replaceAll(root, '<sandbox>').trim().slice(0, 512) ||
            'TypeScript build failed.'
        }
      ]
    }
    if (diagnostics.length > 0) {
      return { diagnostics, emittedDigest: null }
    }
    const emittedFiles = (await readdir(output, { recursive: true }))
      .filter((file) => file.endsWith('.js') || file.endsWith('.json'))
      .toSorted()
    const emitted = await Promise.all(
      emittedFiles.map(async (file) => [file, await readFile(join(output, file), 'utf8')] as const)
    )
    return { diagnostics: [], emittedDigest: sha256Text(canonicalJson(emitted)) }
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

export async function evaluateArtifactBuild(input: {
  bundle: unknown
  evaluatedAt: string
}): Promise<ArtifactBuildEvaluationReportV1> {
  const bundle = ArtifactBuildBundleV1Schema.parse(input.bundle)
  const [first, second] = await Promise.all([build(bundle), build(bundle)])
  const checks = {
    manifestValid:
      bundle.files.some((file) => file.path === bundle.entrypoint) &&
      bundle.compiler.name === 'typescript' &&
      bundle.compiler.version === typescriptVersion &&
      bundle.compiler.optionsDigest === ARTIFACT_COMPILER_OPTIONS_DIGEST,
    digestsExact: bundle.files.every((file) => sha256Text(file.content) === file.sha256),
    provenanceComplete: bundle.provenanceEvidenceIds.length > 0,
    cleanBuildPassed: first.diagnostics.length === 0 && first.emittedDigest !== null,
    rebuildDigestExact: first.emittedDigest !== null && first.emittedDigest === second.emittedDigest
  }
  return ArtifactBuildEvaluationReportV1Schema.parse({
    schemaVersion: 1,
    kind: 'artifact-build-evaluation-report',
    id: `artifact_build_report_${sha256Text(canonicalJson({ bundle: bundle.id, digest: evaluationRecordDigest(bundle) })).slice(0, 32)}`,
    tenantId: bundle.tenantId,
    missionId: bundle.missionId,
    createdAt: input.evaluatedAt,
    bundleId: bundle.id,
    bundleDigest: evaluationRecordDigest(bundle),
    checks,
    diagnostics: first.diagnostics,
    emittedDigest: first.emittedDigest,
    status: Object.values(checks).every(Boolean) ? 'passed' : 'failed',
    evidenceIds: bundle.provenanceEvidenceIds,
    evaluatedAt: input.evaluatedAt,
    evaluatedBy: { kind: 'evaluator', id: 'artifact-build', version: '1' },
    limitations: ['Private temporary TypeScript build; no package installation or network.'],
    acceptanceAuthority: 'none'
  })
}

export { typescriptVersion as ARTIFACT_TYPESCRIPT_VERSION }
