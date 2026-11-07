import * as vscode from 'vscode'
import * as state_keys from '@/constants/state-keys'
import { UpdateInfo } from '@/views/prompt/types/messages'
import { PromptViewProvider } from '../prompt-view-provider'
import { fetch_update_info } from '@/utils/fetch-update-info'
import { is_newer } from '@/utils/is-newer'

export const check_for_updates = async (
  provider: PromptViewProvider,
  params?: { force?: boolean }
) => {
  const force = params?.force ?? false

  const current_version =
    provider.extension_context.extension.packageJSON.version
  if (!current_version) return

  const config = vscode.workspace.getConfiguration('codeWebChat')
  const minimum_release_age = force
    ? 0
    : config.get<number>('minimumReleaseAge', 0)

  if (!force) {
    const last_check = provider.extension_context.globalState.get<number>(
      state_keys.LAST_UPDATE_CHECK_TIMESTAMP_STATE_KEY,
      0
    )
    const now = Date.now()
    const frequency = config.get<'hourly' | 'daily' | 'weekly' | 'monthly'>(
      'updateCheckFrequency',
      'hourly'
    )

    let required_elapsed_time = 60 * 60 * 1000
    if (frequency === 'daily') {
      required_elapsed_time = 24 * 60 * 60 * 1000
    } else if (frequency === 'weekly') {
      required_elapsed_time = 7 * 24 * 60 * 60 * 1000
    } else if (frequency === 'monthly') {
      required_elapsed_time = 30 * 24 * 60 * 60 * 1000
    }

    if (now - last_check < required_elapsed_time) {
      const cached = provider.extension_context.globalState.get<UpdateInfo>(
        state_keys.CACHED_UPDATE_INFO_STATE_KEY
      )
      if (cached) {
        if (cached.is_available && cached.latest_version) {
          if (!is_newer(cached.latest_version, current_version)) {
            cached.is_available = false
            provider.extension_context.globalState.update(
              state_keys.CACHED_UPDATE_INFO_STATE_KEY,
              cached
            )
          }
        }
        provider.update_info = cached
      }

      provider.send_message({
        command: 'UPDATE_INFO',
        update_info: provider.update_info
      })

      return
    }
  }

  provider.update_info = await fetch_update_info(
    current_version,
    minimum_release_age
  )

  provider.extension_context.globalState.update(
    state_keys.LAST_UPDATE_CHECK_TIMESTAMP_STATE_KEY,
    Date.now()
  )
  provider.extension_context.globalState.update(
    state_keys.CACHED_UPDATE_INFO_STATE_KEY,
    provider.update_info
  )

  provider.send_message({
    command: 'UPDATE_INFO',
    update_info: provider.update_info
  })
}
