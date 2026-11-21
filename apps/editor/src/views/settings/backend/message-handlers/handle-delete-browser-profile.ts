import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import * as vscode from 'vscode'
import { DeleteBrowserProfileMessage } from '@/views/settings/types/messages'
import { Logger } from '@shared/utils/logger'
import { t } from '@/i18n'

export const handle_delete_browser_profile = async (
  message: DeleteBrowserProfileMessage
): Promise<void> => {
  const profile = message.name.trim()
  if (!profile || profile.toLowerCase() === 'default') {
    return
  }

  const delete_button = t('common.delete')
  const result = await vscode.window.showWarningMessage(
    t('settings.browser-profiles.confirm-delete.message', {
      name: profile
    }),
    {
      modal: true,
      detail: t('settings.browser-profiles.confirm-delete.detail')
    },
    delete_button
  )

  if (result !== delete_button) {
    return
  }

  const config = vscode.workspace.getConfiguration('codeWebChat')
  const existing_profiles = config.get<string[]>('browserProfiles', []) || []
  const updated_profiles = existing_profiles.filter((p) => p.trim() !== profile)

  await config.update(
    'browserProfiles',
    updated_profiles,
    vscode.ConfigurationTarget.Global
  )

  const profiles_dir = path.join(os.homedir(), '.cwc', 'browser', 'profiles')
  const profile_dir = path.resolve(profiles_dir, profile)
  const relative = path.relative(profiles_dir, profile_dir)
  if (
    relative &&
    relative !== '..' &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative) &&
    fs.existsSync(profile_dir)
  ) {
    try {
      await fs.promises.rm(profile_dir, {
        recursive: true,
        force: true
      })
    } catch (error) {
      Logger.error({
        function_name: 'handle_delete_browser_profile',
        message: `Failed to remove browser profile folder "${profile}"`,
        data: error
      })
    }
  }

  vscode.window.showInformationMessage(
    t('settings.browser-profiles.deleted', {
      name: profile
    })
  )
}
