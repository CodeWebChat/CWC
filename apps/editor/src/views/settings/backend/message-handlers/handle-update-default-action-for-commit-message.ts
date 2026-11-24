import * as vscode from 'vscode'
import { UpdateDefaultActionForCommitMessageMessage } from '@/views/settings/types/messages'

export const handle_update_default_action_for_commit_message = async (
  message: UpdateDefaultActionForCommitMessageMessage
): Promise<void> => {
  await vscode.workspace
    .getConfiguration('codeWebChat')
    .update(
      'defaultActionForCommitMessage',
      message.value,
      vscode.ConfigurationTarget.Global
    )
}
