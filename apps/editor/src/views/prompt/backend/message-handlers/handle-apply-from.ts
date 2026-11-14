import * as vscode from 'vscode'
import * as os from 'os'
import * as path from 'path'
import { t } from '@/i18n'
import { PromptViewProvider } from '@/views/prompt/backend/prompt-view-provider'
import { ShowApplyFromQuickPickMessage } from '@/views/prompt/types/messages'
import { LAST_APPLY_FROM_STATE_KEY } from '@/constants/state-keys'

type ApplyFromOption = 'clipboard' | 'terminal'

export const handle_apply_from = async (
  prompt_view_provider: PromptViewProvider,
  _: ShowApplyFromQuickPickMessage
): Promise<void> => {
  const active_terminal = vscode.window.activeTerminal
  let is_cwc_cli = false

  if (active_terminal) {
    const creation_options = active_terminal.creationOptions as
      | vscode.TerminalOptions
      | undefined
    const cwd = creation_options?.cwd

    if (cwd) {
      const cwd_path = typeof cwd === 'string' ? cwd : cwd.fsPath

      if (cwd_path.startsWith(path.join(os.tmpdir(), 'cwc-cli-edit-'))) {
        is_cwc_cli = true
      }
    }
  }

  if (!is_cwc_cli) {
    await vscode.commands.executeCommand('codeWebChat.applyFromClipboard')
    return
  }

  const last_option =
    prompt_view_provider.extension_context.workspaceState.get<ApplyFromOption>(
      LAST_APPLY_FROM_STATE_KEY
    ) ??
    prompt_view_provider.extension_context.globalState.get<ApplyFromOption>(
      LAST_APPLY_FROM_STATE_KEY
    ) ??
    'clipboard'

  const items: (vscode.QuickPickItem & { value: ApplyFromOption })[] = [
    {
      label: t('views.prompt.handlers.handle-apply-from.items.clipboard'),
      description: t(
        'views.prompt.handlers.handle-apply-from.items.clipboard-description'
      ),
      value: 'clipboard'
    },
    {
      label: t('views.prompt.handlers.handle-apply-from.items.terminal'),
      description: t(
        'views.prompt.handlers.handle-apply-from.items.terminal-description'
      ),
      value: 'terminal'
    }
  ]

  const quick_pick = vscode.window.createQuickPick<
    vscode.QuickPickItem & { value: ApplyFromOption }
  >()
  quick_pick.items = items
  quick_pick.activeItems = items.filter((item) => item.value === last_option)
  quick_pick.title = t('views.prompt.handlers.handle-apply-from.title')
  quick_pick.placeholder = t(
    'views.prompt.handlers.handle-apply-from.placeholder'
  )
  quick_pick.buttons = [
    { iconPath: new vscode.ThemeIcon('close'), tooltip: t('common.close') }
  ]

  const selection = await new Promise<
    (vscode.QuickPickItem & { value: ApplyFromOption }) | undefined
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

  await Promise.all([
    prompt_view_provider.extension_context.workspaceState.update(
      LAST_APPLY_FROM_STATE_KEY,
      selection.value
    ),
    prompt_view_provider.extension_context.globalState.update(
      LAST_APPLY_FROM_STATE_KEY,
      selection.value
    )
  ])

  if (selection.value === 'clipboard') {
    await vscode.commands.executeCommand('codeWebChat.applyFromClipboard')
  } else {
    await vscode.commands.executeCommand('codeWebChat.applyFromTerminal')
  }
}
