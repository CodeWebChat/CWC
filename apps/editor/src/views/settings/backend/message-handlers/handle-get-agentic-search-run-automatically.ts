import * as vscode from 'vscode'
import { SettingsViewProvider } from '@/views/settings/backend/settings-view-provider'

export const handle_get_agentic_search_run_automatically = async (
  provider: SettingsViewProvider
): Promise<void> => {
  const config = vscode.workspace.getConfiguration('codeWebChat')
  const enabled = config.get<boolean>('agenticSearchRunAutomatically', false)
  provider.postMessage({
    command: 'AGENTIC_SEARCH_RUN_AUTOMATICALLY',
    enabled
  })
}
