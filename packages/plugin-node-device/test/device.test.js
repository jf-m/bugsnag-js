const { describe, it, expect } = global

const plugin = require('../device')

const Client = require('@bugsnag/core/client')
const schema = {
  ...require('@bugsnag/core/config').schema,
  hostname: {
    defaultValue: () => 'foo',
    validate: () => true,
    message: 'should be a string'
  }
}
const VALID_NOTIFIER = { name: 't', version: '0', url: 'http://' }
const ISO_8601 = /^\d{4}(-\d\d(-\d\d(T\d\d:\d\d(:\d\d)?(\.\d+)?(([+-]\d\d:\d\d)|Z)?)?)?)?$/i

describe('plugin: node device', () => {
  it('should set device = { hostname} and add a beforeSend callback which adds device time', done => {
    const client = new Client(VALID_NOTIFIER, schema)
    client.configure({ apiKey: 'API_KEY_YEAH' })
    plugin.init(client)

    expect(client.config.beforeSend.length).toBe(1)
    expect(client.device.hostname).toBeDefined()

    client.delivery({
      sendReport: (logger, config, payload) => {
        expect(payload.events[0].device).toBeDefined()
        expect(payload.events[0].device.time).toMatch(ISO_8601)
        done()
      }
    })
    client.notify(new Error('noooo'))
  })
})
