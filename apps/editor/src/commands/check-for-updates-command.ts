import * as vscode from 'vscode'
import { t } from '../i18n'
import { PromptViewProvider } from '../views/prompt/backend/prompt-view-provider'
import { update_extension } from '../utils/update-extension'
import { MINIMUM_WAIT_TIME } from '../constants/values'
import { fetch_update_info } from '../utils/fetch-update-info'
import * as state_keys from '../constants/state-keys'

export const check_for_updates_command = (
  prompt_view_provider: PromptViewProvider
) => {
  return vscode.commands.registerCommand(
    'codeWebChat.checkForUpdates',
    async () => {
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: t(
            'command.check-for-updates-command.info.checking-for-updates'
          ),
          cancellable: false
        },
        async () => {
          const start_time = Date.now()
          const current_version =
            prompt_view_provider.extension_context.extension.packageJSON.version

          if (!current_version) return

          const update_info = await fetch_update_info(current_version, 0)

          prompt_view_provider.extension_context.globalState.update(
            state_keys.LAST_UPDATE_CHECK_TIMESTAMP_STATE_KEY,
            Date.now()
          )
          prompt_view_provider.extension_context.globalState.update(
            state_keys.CACHED_UPDATE_INFO_STATE_KEY,
            update_info
          )

          const elapsed_time = Date.now() - start_time

          if (elapsed_time < MINIMUM_WAIT_TIME) {
            await new Promise((resolve) =>
              setTimeout(resolve, MINIMUM_WAIT_TIME - elapsed_time)
            )
          }

          prompt_view_provider.update_info = update_info
          prompt_view_provider.send_message({
            command: 'UPDATE_INFO',
            update_info: prompt_view_provider.update_info
          })
        }
      )

      if (prompt_view_provider.update_info.is_available) {
        const action = await vscode.window.showInformationMessage(
          t('command.check-for-updates-command.info.new-version-available'),
          t('command.check-for-updates-command.action.update')
        )

        if (action === t('command.check-for-updates-command.action.update')) {
          if (prompt_view_provider.is_updating) {
            return
          }

          if (prompt_view_provider.update_info.latest_version_tag) {
            prompt_view_provider.is_updating = true
            prompt_view_provider.send_message({
              command: 'UPDATE_INFO',
              update_info: {
                ...prompt_view_provider.update_info,
                is_updating: true
              }
            })
            update_extension({
              tag_name: prompt_view_provider.update_info.latest_version_tag
            })
          }
        }
      } else {
        vscode.window.showInformationMessage(
          t('command.check-for-updates-command.info.no-updates-available')
        )
      }
    }
  )
}
