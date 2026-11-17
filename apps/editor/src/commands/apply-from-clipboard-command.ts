import * as vscode from 'vscode'
import { t } from '@/i18n'
import { apply_response } from '@/features/apply-response/apply-response'
import { PromptViewProvider } from '@/views/prompt/backend/prompt-view-provider'
import { is_response_applicable } from '@/utils/is-response-applicable'
import { get_all_workspace_files } from '@/context/helpers/get-all-workspace-files'

export const apply_from_clipboard_command = (params: {
  prompt_view_provider: PromptViewProvider
}): vscode.Disposable => {
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

      const is_single_root_folder_workspace =
        (vscode.workspace.workspaceFolders?.length ?? 0) <= 1
      const workspace_files = await get_all_workspace_files({
        workspace_provider: params.prompt_view_provider.workspace_provider
      })

      const is_applicable = is_response_applicable({
        response: clipboard_text,
        is_single_root_folder_workspace,
        workspace_files
      })

      if (!is_applicable) {
        vscode.window.showWarningMessage(
          t('command.apply-from-clipboard-command.warning.no-valid-response')
        )
        return false
      }

      await vscode.env.clipboard.writeText('')
      await params.prompt_view_provider.check_clipboard_for_applicable_response()

      apply_response({
        response: clipboard_text,
        raw_instructions: args?.raw_instructions,
        web_configuration_details: args?.web_configuration_details
      })
    }
  )
}
