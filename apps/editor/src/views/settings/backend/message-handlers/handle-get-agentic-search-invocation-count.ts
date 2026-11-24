import * as vscode from 'vscode'
import { SettingsViewProvider } from '../settings-view-provider'

export const handle_get_agentic_search_invocation_count = async (
  provider: SettingsViewProvider
) => {
  const config = vscode.workspace.getConfiguration('codeWebChat')
  const default_count = config.inspect<1 | 2 | 3>(
    'agenticSearchInvocationCount'
  )!.defaultValue!
  const count =
    config.get<1 | 2 | 3>('agenticSearchInvocationCount') ?? default_count

  provider.postMessage({
    command: 'AGENTIC_SEARCH_INVOCATION_COUNT',
    count
  })
}
