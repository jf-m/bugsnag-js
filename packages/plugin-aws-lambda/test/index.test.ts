import Plugin from '../src/'
import { Event } from '@bugsnag/core'
import Client, { Delivery } from '@bugsnag/core/client'

type NodeDelivery = Delivery & { _flush(timeoutMs?: number): Promise<void> }

const createDeliveryMock = (): NodeDelivery => ({
  sendEvent: jest.fn(),
  sendSession: jest.fn(),
  _flush: jest.fn()
})

const createClientMock = (): Client => ({
  Event,
  _notify: jest.fn(),
  addMetadata: jest.fn(),
  _delivery: createDeliveryMock(),
  _logger: {
    error: jest.fn()
  }
} as unknown as Client)

const createExpectedEvent = (error: Error): Event => {
  // @ts-ignore
  const stacktrace = Event.getStacktrace(error, 0, 1)
  const handledState = {
    severity: 'error',
    unhandled: true,
    severityReason: { type: 'unhandledException' }
  }

  // @ts-ignore
  return new Event(error.name, error.message, stacktrace, handledState, error)
}

describe('plugin: aws lambda', () => {
  it('has a name', () => {
    expect(Plugin.name).toBe('awsLambda')
  })

  it('adds the context as metadata', async () => {
    const handler = (event: any, context: any) => 'abc'

    const event = { very: 'eventy' }
    const context = { extremely: 'contextual' }

    const client = createClientMock()

    const { createHandler } = Plugin.load(client)
    const wrappedHandler = createHandler()(handler)

    expect(await wrappedHandler(event, context)).toBe('abc')

    expect(client.addMetadata).toBeCalledWith('AWS Lambda context', context)
  })

  it('calls flush after calling the handler', async () => {
    const client = createClientMock()
    const handler = (client._delivery as NodeDelivery)._flush
    const flushTimeoutMs = 1234
    const event = { very: 'eventy' }
    const context = { extremely: 'contextual' }

    const { createHandler } = Plugin.load(client)
    const wrappedHandler = createHandler({ flushTimeoutMs })(handler)

    expect(handler).not.toHaveBeenCalled()

    await wrappedHandler(event, context)

    expect(handler).toHaveBeenNthCalledWith(1, event, context)
    expect(handler).toHaveBeenNthCalledWith(2, flushTimeoutMs)
  })

  it('logs an error if flush times out', async () => {
    const handler = () => 'abc'

    const client = createClientMock()

    const timeoutError = new Error('_flush timed out after 2000ms')
    const flush = (client._delivery as NodeDelivery)._flush
    ;(flush as jest.MockedFunction<typeof flush>).mockRejectedValue(timeoutError)

    const { createHandler } = Plugin.load(client)
    const wrappedHandler = createHandler()(handler)

    expect(await wrappedHandler()).toBe('abc')
    expect(client._logger.error).toHaveBeenCalledWith('Delivery may be unsuccessful: _flush timed out after 2000ms')
  })

  it('returns a wrapped handler that resolves to the original return value (async)', async () => {
    const handler = () => 'abc'

    const client = createClientMock()

    const { createHandler } = Plugin.load(client)
    const wrappedHandler = createHandler()(handler)

    expect(await handler()).toBe('abc')
    expect(await wrappedHandler()).toBe('abc')
  })

  it('notifies when an error is thrown (async)', async () => {
    const error = new Error('oh no')
    const handler = (event: any, context: any) => { throw error }

    const event = { very: 'eventy' }
    const context = { extremely: 'contextual' }

    const client = createClientMock()

    const { createHandler } = Plugin.load(client)
    const wrappedHandler = createHandler()(handler)

    expect(client._notify).not.toHaveBeenCalled()

    await expect(() => wrappedHandler(event, context)).rejects.toThrow(error)

    expect(client._notify).toHaveBeenCalledWith(createExpectedEvent(error))
  })

  it('returns a wrapped handler that resolves to the value passed to the callback (callback)', async () => {
    const handler = (event: any, context: any, callback: any) => { callback(null, 'xyz') }

    const client = createClientMock()

    const event = { very: 'eventy' }
    const context = { extremely: 'contextual' }

    const { createHandler } = Plugin.load(client)
    const wrappedHandler = createHandler()(handler)

    expect(await wrappedHandler(event, context)).toBe('xyz')
  })

  it('notifies when an error is passed (callback)', async () => {
    const error = new Error('uh oh')
    const handler = (event: any, context: any, callback: any) => { callback(error, 'xyz') }

    const event = { very: 'eventy' }
    const context = { extremely: 'contextual' }

    const client = createClientMock()

    const { createHandler } = Plugin.load(client)
    const wrappedHandler = createHandler()(handler)

    expect(client._notify).not.toHaveBeenCalled()

    await expect(() => wrappedHandler(event, context)).rejects.toThrow(error)

    expect(client._notify).toHaveBeenCalledWith(createExpectedEvent(error))
  })

  it('works when an async handler has the callback parameter', async () => {
    const handler = async (event: any, context: any, callback: any) => 'abcxyz'

    const client = createClientMock()

    const event = { very: 'eventy' }
    const context = { extremely: 'contextual' }

    const { createHandler } = Plugin.load(client)
    const wrappedHandler = createHandler()(handler)

    expect(await wrappedHandler(event, context)).toBe('abcxyz')
  })

  it('works when an async handler has the callback parameter and calls it', async () => {
    const handler = async (event: any, context: any, callback: any) => { callback(null, 'abcxyz') }

    const client = createClientMock()

    const event = { very: 'eventy' }
    const context = { extremely: 'contextual' }

    const { createHandler } = Plugin.load(client)
    const wrappedHandler = createHandler()(handler)

    expect(await wrappedHandler(event, context)).toBe('abcxyz')
  })

  it('works when an async handler has the callback parameter and throws', async () => {
    const error = new Error('abcxyz')
    const handler = async (event: any, context: any, callback: any) => { throw error }

    const client = createClientMock()

    const event = { very: 'eventy' }
    const context = { extremely: 'contextual' }

    const { createHandler } = Plugin.load(client)
    const wrappedHandler = createHandler()(handler)

    expect(client._notify).not.toHaveBeenCalled()

    await expect(() => wrappedHandler(event, context)).rejects.toThrow(error)

    expect(client._notify).toHaveBeenCalledWith(createExpectedEvent(error))
  })

  it('works when an async handler has the callback parameter and calls it with an error', async () => {
    const error = new Error('abcxyz')
    const handler = async (event: any, context: any, callback: any) => { callback(error) }

    const client = createClientMock()

    const event = { very: 'eventy' }
    const context = { extremely: 'contextual' }

    const { createHandler } = Plugin.load(client)
    const wrappedHandler = createHandler()(handler)

    expect(client._notify).not.toHaveBeenCalled()

    await expect(() => wrappedHandler(event, context)).rejects.toThrow(error)

    expect(client._notify).toHaveBeenCalledWith(createExpectedEvent(error))
  })
})
