import * as vscode from 'vscode'
import { t } from '@/i18n'
import { PromptViewProvider } from '@/views/prompt/backend/prompt-view-provider'
import { handle_agentic_search } from '../handle-agentic-search'

export const show_context_cannot_be_empty_warning = async (
  prompt_view_provider: PromptViewProvider
): Promise<void> => {
  const config = vscode.workspace.getConfiguration('codeWebChat')
  const default_run_automatically = config.inspect<boolean>(
    'agenticSearchRunAutomatically'
  )!.defaultValue!
  const run_automatically =
    config.get<boolean>('agenticSearchRunAutomatically') ??
    default_run_automatically

  if (run_automatically) {
    void vscode.window.showWarningMessage(
      t(
        'views.common.handlers.utils.show-context-cannot-be-empty-warning.context-cannot-be-empty'
      )
    )
    await handle_agentic_search(prompt_view_provider)
    return
  }

  const agentic_search_action = t('feature.agentic-search.title.agentic-search')
  const selection = await vscode.window.showWarningMessage(
    t(
      'views.common.handlers.utils.show-context-cannot-be-empty-warning.context-cannot-be-empty'
    ),
    agentic_search_action
  )

  if (selection === agentic_search_action) {
    await handle_agentic_search(prompt_view_provider)
  }
}
