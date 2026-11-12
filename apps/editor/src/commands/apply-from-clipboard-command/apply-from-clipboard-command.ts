import * as vscode from 'vscode'
import { t } from '@/i18n'
import { apply_response } from '@/features/apply-response/apply-response'

export const apply_from_clipboard_command = (): vscode.Disposable => {
  return vscode.commands.registerCommand(
    'codeWebChat.applyFromClipboard',
    async (args?: {
      raw_instructions?: string
      web_configuration_details?: any
    }) => {
      const clipboard_text = await vscode.env.clipboard.readText()
      if (!clipboard_text) {
        vscode.window.showInformationMessage(
          t('command.apply-from-clipboard-command.info.clipboard-empty')
        )
        return false
      }

      return await apply_response({
        response: clipboard_text,
        raw_instructions: args?.raw_instructions,
        web_configuration_details: args?.web_configuration_details
      })
    }
  )
}
