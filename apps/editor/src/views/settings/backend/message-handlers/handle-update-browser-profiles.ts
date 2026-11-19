import * as vscode from 'vscode'
import { UpdateBrowserProfilesMessage } from '@/views/settings/types/messages'

export const handle_update_browser_profiles = async (
  message: UpdateBrowserProfilesMessage
): Promise<void> => {
  const config = vscode.workspace.getConfiguration('codeWebChat')
  await config.update(
    'browserProfiles',
    message.browser_profiles,
    vscode.ConfigurationTarget.Global
  )
}
