import { Plugin, Client } from '@bugsnag/core'

export interface BugsnagPluginAwsLambda extends Plugin {
  load(client: Client): BugsnagPluginAwsLambdaResult
}

type AsyncHandler = (event: any, context: any) => Promise<any>
type CallbackHandler = (event: any, context: any, callback: any) => void

export type BugsnagPluginAwsLambdaHandler = (handler: AsyncHandler|CallbackHandler) => AsyncHandler

export interface BugsnagPluginAwsLambdaConfiguration {
  flushTimeoutMs?: number
}

export interface BugsnagPluginAwsLambdaResult {
  createHandler(configuration: BugsnagPluginAwsLambdaConfiguration): BugsnagPluginAwsLambdaHandler
}

// add a new call signature for the getPlugin() method that types the plugin result
declare module '@bugsnag/core' {
  interface Client {
    getPlugin(id: 'awsLambda'): BugsnagPluginAwsLambdaResult | undefined
  }
}

export default BugsnagPluginAwsLambda
