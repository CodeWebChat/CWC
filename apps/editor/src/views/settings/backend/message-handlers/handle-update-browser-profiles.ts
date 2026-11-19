import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import * as vscode from 'vscode'
import { UpdateBrowserProfilesMessage } from '@/views/settings/types/messages'
import { SettingsViewProvider } from '@/views/settings/backend/settings-view-provider'
import { Logger } from '@shared/utils/logger'
import { t } from '@/i18n'
import { handle_get_browser_profiles } from './handle-get-browser-profiles'

export const handle_update_browser_profiles = async (
  settings_provider: SettingsViewProvider,
  message: UpdateBrowserProfilesMessage
): Promise<void> => {
  const config = vscode.workspace.getConfiguration('codeWebChat')
  const existing_profiles = config.get<string[]>('browserProfiles', []) || []

  const updated_profiles_set = new Set(
    message.browser_profiles.map((p) => p.trim())
  )
  const removed_profiles = Array.from(
    new Set(
      existing_profiles
        .map((p) => p.trim())
        .filter(
          (p) =>
            p.length > 0 &&
            p.toLowerCase() !== 'default' &&
            !updated_profiles_set.has(p)
        )
    )
  )

  if (removed_profiles.length > 0) {
    const delete_button = t('common.delete')
    const result = await vscode.window.showWarningMessage(
      t('settings.browser-profiles.confirm-delete.message', {
        name: removed_profiles.join(', ')
      }),
      {
        modal: true,
        detail: t('settings.browser-profiles.confirm-delete.detail')
      },
      delete_button
    )

    if (result !== delete_button) {
      await handle_get_browser_profiles(settings_provider)
      return
    }
  }

  await config.update(
    'browserProfiles',
    message.browser_profiles,
    vscode.ConfigurationTarget.Global
  )

  if (removed_profiles.length === 0) {
    return
  }

  const profiles_dir = path.join(os.homedir(), '.cwc', 'browser', 'profiles')

  for (const profile of removed_profiles) {
    const profile_dir = path.resolve(profiles_dir, profile)
    const relative = path.relative(profiles_dir, profile_dir)
    if (
      !relative ||
      relative === '..' ||
      relative.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relative)
    ) {
      continue
    }

    if (fs.existsSync(profile_dir)) {
      try {
        await fs.promises.rm(profile_dir, {
          recursive: true,
          force: true
        })
      } catch (error) {
        Logger.error({
          function_name: 'handle_update_browser_profiles',
          message: `Failed to remove browser profile folder "${profile}"`,
          data: error
        })
      }
    }
  }
}
