import * as vscode from 'vscode'
import { SettingsViewProvider } from '../settings-view-provider'

export const handle_get_agentic_search_instructions = async (
  provider: SettingsViewProvider
) => {
  const config = vscode.workspace.getConfiguration('codeWebChat')
  const default_instructions = config.inspect<string>(
    'agenticSearchInstructions'
  )!.defaultValue!
  const instructions =
    config.get<string>('agenticSearchInstructions') ?? default_instructions

  provider.postMessage({
    command: 'AGENTIC_SEARCH_INSTRUCTIONS',
    instructions,
    default_instructions
  })
}
