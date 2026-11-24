import * as vscode from 'vscode'
import { SettingsViewProvider } from '@/views/settings/backend/settings-view-provider'

export const handle_get_gemini_user_id = async (
  provider: SettingsViewProvider
): Promise<void> => {
  const config = vscode.workspace.getConfiguration('codeWebChat')
  const default_user_id =
    config.inspect<number | null>('geminiUserId')?.defaultValue ?? null
  const geminiUserId =
    config.get<number | null>('geminiUserId') ?? default_user_id
  provider.postMessage({
    command: 'GEMINI_USER_ID',
    geminiUserId
  })
}
