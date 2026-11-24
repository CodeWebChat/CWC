import * as vscode from 'vscode'
import { SettingsViewProvider } from '@/views/settings/backend/settings-view-provider'
import { DefaultActionForCommitMessage } from '@/views/settings/types/messages'

export const handle_get_default_action_for_commit_message = async (
  provider: SettingsViewProvider
): Promise<void> => {
  const config = vscode.workspace.getConfiguration('codeWebChat')
  const default_value = config.inspect<DefaultActionForCommitMessage>(
    'defaultActionForCommitMessage'
  )!.defaultValue!
  const value =
    config.get<DefaultActionForCommitMessage>(
      'defaultActionForCommitMessage'
    ) ?? default_value
  provider.postMessage({
    command: 'DEFAULT_ACTION_FOR_COMMIT_MESSAGE',
    value
  })
}
