import * as vscode from 'vscode'
import { TERMINAL_INTERACTIVITY_STATE_KEY } from '@/constants/state-keys'
import { PromptViewProvider } from '@/views/prompt/backend/prompt-view-provider'
import { SelectTerminalInteractivityMessage } from '@/views/prompt/types/messages'
import { TerminalInteractivity } from '@shared/types/terminal-interactivity'
import { t } from '@/i18n'

export const handle_select_terminal_interactivity = async (
  prompt_view_provider: PromptViewProvider,
  _: SelectTerminalInteractivityMessage
): Promise<void> => {
  const current_interactivity = prompt_view_provider.terminal_interactivity

  const items: (vscode.QuickPickItem & { value: TerminalInteractivity })[] = [
    {
      label: t(
        'views.prompt.handlers.handle-select-terminal-interactivity.items.non-interactive'
      ),
      detail: t(
        'views.prompt.handlers.handle-select-terminal-interactivity.items.non-interactive.description'
      ),
      value: 'non-interactive'
    },
    {
      label: t(
        'views.prompt.handlers.handle-select-terminal-interactivity.items.interactive'
      ),
      detail: t(
        'views.prompt.handlers.handle-select-terminal-interactivity.items.interactive.description'
      ),
      value: 'interactive'
    }
  ]

  const quick_pick = vscode.window.createQuickPick<
    vscode.QuickPickItem & { value: TerminalInteractivity }
  >()
  quick_pick.items = items
  quick_pick.activeItems = items.filter(
    (item) => item.value === current_interactivity
  )
  quick_pick.placeholder = t(
    'views.prompt.handlers.handle-select-terminal-interactivity.placeholder'
  )
  quick_pick.title = t(
    'views.prompt.handlers.handle-select-terminal-interactivity.title'
  )
  quick_pick.buttons = [
    { iconPath: new vscode.ThemeIcon('close'), tooltip: t('common.close') }
  ]

  const selection = await new Promise<
    (vscode.QuickPickItem & { value: TerminalInteractivity }) | undefined
  >((resolve) => {
    quick_pick.onDidAccept(() => {
      resolve(quick_pick.selectedItems[0])
      quick_pick.hide()
    })
    quick_pick.onDidTriggerButton(() => {
      quick_pick.hide()
    })
    quick_pick.onDidHide(() => {
      resolve(undefined)
      quick_pick.dispose()
    })
    quick_pick.show()
  })

  if (!selection) {
    return
  }

  prompt_view_provider.terminal_interactivity = selection.value

  await Promise.all([
    prompt_view_provider.extension_context.workspaceState.update(
      TERMINAL_INTERACTIVITY_STATE_KEY,
      selection.value
    ),
    prompt_view_provider.extension_context.globalState.update(
      TERMINAL_INTERACTIVITY_STATE_KEY,
      selection.value
    )
  ])

  prompt_view_provider.send_message({
    command: 'TERMINAL_INTERACTIVITY',
    terminal_interactivity: prompt_view_provider.terminal_interactivity
  })
}
