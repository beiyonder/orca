import { createServer, type ServerResponse } from 'node:http'

export type OmpContainmentModelServer = {
  baseUrl: string
  requestBodies: readonly string[]
  cancelledRequests: () => number
  waitForRequest: (fragment: string, timeoutMs?: number) => Promise<void>
  waitForCancellation: (timeoutMs?: number) => Promise<void>
  close: () => Promise<void>
}

function writeSse(response: ServerResponse, value: unknown): void {
  response.write(`data: ${JSON.stringify(value)}\n\n`)
}

function completionChunk(
  delta: Record<string, unknown>,
  finishReason: string | null
): Record<string, unknown> {
  return {
    id: 'chatcmpl-containment',
    object: 'chat.completion.chunk',
    created: 1,
    model: 'deterministic',
    choices: [{ index: 0, delta, finish_reason: finishReason }]
  }
}

export async function startOmpContainmentModelServer(): Promise<OmpContainmentModelServer> {
  const requestBodies: string[] = []
  const heldResponses = new Set<ServerResponse>()
  let cancelledRequests = 0
  const requestWaiters = new Set<{
    fragment: string
    resolve: () => void
    reject: (error: unknown) => void
    timer: NodeJS.Timeout
  }>()
  const cancellationWaiters = new Set<{
    resolve: () => void
    reject: (error: unknown) => void
    timer: NodeJS.Timeout
  }>()
  const server = createServer((request, response) => {
    const chunks: Buffer[] = []
    request.on('data', (chunk: Buffer) => chunks.push(chunk))
    request.on('end', () => {
      const body = Buffer.concat(chunks).toString('utf8')
      requestBodies.push(body)
      for (const waiter of requestWaiters) {
        if (!body.includes(waiter.fragment)) {
          continue
        }
        clearTimeout(waiter.timer)
        requestWaiters.delete(waiter)
        waiter.resolve()
      }
      if (body.includes('CANCEL_PROBE')) {
        heldResponses.add(response)
        response.once('close', () => {
          heldResponses.delete(response)
          cancelledRequests += 1
          for (const waiter of cancellationWaiters) {
            clearTimeout(waiter.timer)
            cancellationWaiters.delete(waiter)
            waiter.resolve()
          }
        })
        return
      }
      response.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'close'
      })
      if (body.includes('"role":"tool"')) {
        writeSse(
          response,
          completionChunk({ role: 'assistant', content: 'artifact recorded' }, null)
        )
        writeSse(response, completionChunk({}, 'stop'))
      } else {
        writeSse(
          response,
          completionChunk(
            {
              role: 'assistant',
              tool_calls: [
                {
                  index: 0,
                  id: 'call_artifact_write',
                  type: 'function',
                  function: {
                    name: 'artifact_write',
                    arguments: JSON.stringify({
                      path: 'artifacts/identity-mapping.json',
                      content: '{"sourceKey":["facility_id","patient_num"]}'
                    })
                  }
                }
              ]
            },
            null
          )
        )
        writeSse(response, completionChunk({}, 'tool_calls'))
      }
      response.end('data: [DONE]\n\n')
    })
  })
  const listening = Promise.withResolvers<void>()
  server.once('error', listening.reject)
  server.listen(0, '127.0.0.1', listening.resolve)
  await listening.promise
  const address = server.address()
  if (address === null || typeof address === 'string') {
    server.close()
    throw new Error('Containment model server did not bind a TCP port')
  }
  return {
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    requestBodies,
    cancelledRequests: () => cancelledRequests,
    waitForRequest: (fragment, timeoutMs = 5_000) => {
      if (requestBodies.some((body) => body.includes(fragment))) {
        return Promise.resolve()
      }
      const pending = Promise.withResolvers<void>()
      const waiter = {
        fragment,
        resolve: pending.resolve,
        reject: pending.reject,
        timer: setTimeout(() => {
          requestWaiters.delete(waiter)
          pending.reject(new Error(`Containment model request timed out: ${fragment}`))
        }, timeoutMs)
      }
      requestWaiters.add(waiter)
      return pending.promise
    },
    waitForCancellation: (timeoutMs = 5_000) => {
      if (cancelledRequests > 0) {
        return Promise.resolve()
      }
      const pending = Promise.withResolvers<void>()
      const waiter = {
        resolve: pending.resolve,
        reject: pending.reject,
        timer: setTimeout(() => {
          cancellationWaiters.delete(waiter)
          pending.reject(new Error('Containment model cancellation timed out'))
        }, timeoutMs)
      }
      cancellationWaiters.add(waiter)
      return pending.promise
    },
    close: async () => {
      for (const response of heldResponses) {
        response.destroy()
      }
      const closed = Promise.withResolvers<void>()
      server.close((error) => {
        if (error) {
          closed.reject(error)
        } else {
          closed.resolve()
        }
      })
      await closed.promise
    }
  }
}
