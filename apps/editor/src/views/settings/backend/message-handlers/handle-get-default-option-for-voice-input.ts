import * as vscode from 'vscode'
import { SettingsViewProvider } from '@/views/settings/backend/settings-view-provider'

export const handle_get_default_option_for_voice_input = async (
  provider: SettingsViewProvider
): Promise<void> => {
  const config = vscode.workspace.getConfiguration('codeWebChat')
  const default_value = config.inspect<'ask' | 'send-request' | 'invoke-agent'>(
    'defaultOptionForVoiceInput'
  )!.defaultValue!
  const value =
    config.get<'ask' | 'send-request' | 'invoke-agent'>(
      'defaultOptionForVoiceInput'
    ) ?? default_value
  provider.postMessage({
    command: 'DEFAULT_OPTION_FOR_VOICE_INPUT',
    value
  })
}
