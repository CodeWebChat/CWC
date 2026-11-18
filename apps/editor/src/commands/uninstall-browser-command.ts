import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import * as vscode from 'vscode'
import { close_browser } from '../utils/close-browser'
import { t } from '../i18n'
import { get_error_message } from '@/utils/get-error-message'

export const uninstall_browser_command = () => {
  return vscode.commands.registerCommand(
    'codeWebChat.uninstallBrowser',
    async () => {
      const browser_dir = path.join(os.homedir(), '.cwc', 'browser')

      if (!fs.existsSync(browser_dir)) {
        vscode.window.showInformationMessage(
          t('command.uninstall-browser-command.not-installed')
        )
        return
      }

      const confirm_action = t(
        'command.uninstall-browser-command.confirm-action'
      )
      const selection = await vscode.window.showWarningMessage(
        t('command.uninstall-browser-command.confirm-message'),
        {
          modal: true,
          detail: t('command.uninstall-browser-command.confirm-detail')
        },
        confirm_action
      )

      if (selection !== confirm_action) {
        return
      }

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: t('command.uninstall-browser-command.uninstalling'),
          cancellable: false
        },
        async () => {
          try {
            await close_browser()
            await fs.promises.rm(browser_dir, {
              recursive: true,
              force: true,
              maxRetries: 3,
              retryDelay: 200
            })
            vscode.window.showInformationMessage(
              t('command.uninstall-browser-command.success')
            )
          } catch (error) {
            vscode.window.showErrorMessage(
              t('command.uninstall-browser-command.failed', {
                message: get_error_message(error)
              })
            )
          }
        }
      )
    }
  )
}
