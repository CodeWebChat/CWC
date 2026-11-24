import * as vscode from 'vscode'
import { SettingsViewProvider } from '@/views/settings/backend/settings-view-provider'

export const handle_get_send_with_shift_enter = async (
  provider: SettingsViewProvider
): Promise<void> => {
  const config = vscode.workspace.getConfiguration('codeWebChat')
  const default_enabled =
    config.inspect<boolean>('sendWithShiftEnter')!.defaultValue!
  const enabled = config.get<boolean>('sendWithShiftEnter') ?? default_enabled
  provider.postMessage({
    command: 'SEND_WITH_SHIFT_ENTER',
    enabled
  })
}
