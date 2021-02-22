const BugsnagPluginAwsLambda = {
  name: 'awsLambda',

  load (client) {
    return {
      createHandler ({ flushTimeoutMs = 2000 } = {}) {
        return wrapHandler.bind(null, client, flushTimeoutMs)
      }
    }
  }
}

function wrapHandler (client, flushTimeoutMs, handler) {
  let _handler = handler

  if (handler.length > 2) {
    // This is a handler expecting a 'callback' argument, so we convert
    // it to return a Promise so '_handler' always has the same API
    _handler = promisifyHandler(handler)
  }

  return async function (event, context) {
    client.addMetadata('AWS Lambda context', context)

    try {
      return await _handler(event, context)
    } catch (err) {
      const handledState = {
        severity: 'error',
        unhandled: true,
        severityReason: { type: 'unhandledException' }
      }

      const event = client.Event.create(err, true, handledState, 1)

      client._notify(event)

      throw err
    } finally {
      await client._delivery._flush(flushTimeoutMs)
    }
  }
}

// Convert a handler that uses callbacks to an async handler
function promisifyHandler (handler) {
  return function (event, context) {
    return new Promise(function (resolve, reject) {
      handler(event, context, function (err, response) {
        if (err) {
          reject(err)
          return
        }

        resolve(response)
      })
    })
  }
}

module.exports = BugsnagPluginAwsLambda
