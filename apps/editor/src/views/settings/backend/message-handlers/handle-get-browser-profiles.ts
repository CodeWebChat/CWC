import * as vscode from 'vscode'
import { SettingsViewProvider } from '@/views/settings/backend/settings-view-provider'

export const handle_get_browser_profiles = async (
  settings_provider: SettingsViewProvider
): Promise<void> => {
  const config = vscode.workspace.getConfiguration('codeWebChat')
  const browser_profiles = config.get<string[]>('browserProfiles', []) || []
  settings_provider.postMessage({
    command: 'BROWSER_PROFILES',
    browser_profiles
  })
}
