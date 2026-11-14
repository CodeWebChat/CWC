import * as vscode from 'vscode'
import { t } from '@/i18n'

export const prompt_for_additional_instructions = async (options?: {
  show_back_button?: boolean
  initial_value?: string
  on_change?: (value: string) => void
}): Promise<{ value: string | undefined; back?: boolean }> => {
  const close_button = {
    iconPath: new vscode.ThemeIcon('close'),
    tooltip: t('common.close')
  }

  const input_box = vscode.window.createInputBox()
  input_box.title = t('feature.agentic-search.title.agentic-search')
  input_box.prompt = t('feature.agentic-search.prompt.additional-instructions')
  input_box.placeholder = t(
    'feature.agentic-search.placeholder.additional-instructions'
  )
  input_box.value = ''

  if (options?.initial_value) {
    input_box.value = options.initial_value
  }

  const buttons: vscode.QuickInputButton[] = []
  if (options?.show_back_button) {
    buttons.push(vscode.QuickInputButtons.Back)
  }
  buttons.push(close_button)

  input_box.buttons = buttons
  input_box.ignoreFocusOut = true

  return new Promise<{ value: string | undefined; back?: boolean }>(
    (resolve) => {
      let is_resolved = false
      const disposables: vscode.Disposable[] = []

      disposables.push(
        input_box.onDidTriggerButton((button) => {
          if (button === vscode.QuickInputButtons.Back) {
            is_resolved = true
            resolve({ value: undefined, back: true })
            input_box.hide()
          } else if (button === close_button) {
            is_resolved = true
            resolve({ value: undefined })
            input_box.hide()
          }
        }),
        input_box.onDidChangeValue(() => {
          if (options?.on_change) {
            options.on_change(input_box.value)
          }
        }),
        input_box.onDidAccept(() => {
          const value = input_box.value.trim()
          is_resolved = true
          resolve({ value })
          input_box.hide()
        }),
        input_box.onDidHide(() => {
          if (!is_resolved) {
            resolve({ value: undefined })
          }
          disposables.forEach((d) => d.dispose())
          input_box.dispose()
        })
      )
      input_box.show()
    }
  )
}
