import * as vscode from 'vscode'
import { t } from '@/i18n'
import { PromptViewProvider } from '@/views/prompt/backend/prompt-view-provider'
import { ApplyMessage } from '@/views/prompt/types/messages'

export const handle_apply = async (
  prompt_view_provider: PromptViewProvider,
  _: ApplyMessage
): Promise<void> => {
  const target = prompt_view_provider.target

  if (target === 'WEB') {
    await vscode.commands.executeCommand('codeWebChat.applyFromClipboard')
  } else if (target === 'CLI') {
    await vscode.commands.executeCommand('codeWebChat.applyFromTerminal')
  } else {
    vscode.window.showInformationMessage(
      t('views.prompt.handlers.handle-apply.applying-is-not-available-here')
    )
  }
}
