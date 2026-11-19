import * as vscode from 'vscode'
import * as path from 'path'
import * as os from 'os'
import * as fs from 'fs'
import { spawn } from 'child_process'
import {
  Browser,
  detectBrowserPlatform,
  install,
  resolveBuildId
} from '@puppeteer/browsers'
import { t } from '@/i18n'
import { PromptViewProvider } from '../prompt-view-provider'
import { LAST_SELECTED_BROWSER_PROFILE_STATE_KEY } from '@/constants/state-keys'

const launch_browser = (params: {
  executable_path: string
  user_data_dir: string
  extension_path: string
}) => {
  const args = [
    `--user-data-dir=${params.user_data_dir}`,
    `--load-extension=${params.extension_path}`,
    '--disable-infobars',
    '--no-first-run'
  ]

  if (process.platform === 'darwin') {
    args.push('--use-mock-keychain')
  } else if (process.platform === 'linux') {
    args.push('--password-store=basic')
  }

  const child = spawn(params.executable_path, args, {
    detached: true,
    stdio: 'ignore'
  })
  child.unref()
}

export const handle_run_browser = async (
  prompt_view_provider: PromptViewProvider
) => {
  if (vscode.env.remoteName) {
    const action = t('views.prompt.handlers.handle-run-browser.forward-port')
    const actions = vscode.env.remoteName === 'ssh-remote' ? [action] : []
    vscode.window
      .showWarningMessage(
        t('views.prompt.handlers.handle-run-browser.remote-not-supported'),
        ...actions
      )
      .then((selection) => {
        if (selection === action) {
          vscode.commands.executeCommand(
            'codeWebChat.settings',
            'section:web:group:remote-machines'
          )
        }
      })
    return
  }

  const browser_profiles = Array.from(
    new Set(
      vscode.workspace
        .getConfiguration('codeWebChat')
        .get<string[]>('browserProfiles', [])
        .map((p) => p.trim())
        .filter((p) => p.length > 0 && p !== 'Default')
    )
  )

  let selected_profile: string | undefined = 'Default'

  if (browser_profiles.length > 0) {
    const items = ['Default', ...browser_profiles].map((profile) => ({
      label: profile
    }))
    const last_selected_profile =
      prompt_view_provider.extension_context.globalState.get<string>(
        LAST_SELECTED_BROWSER_PROFILE_STATE_KEY
      )

    selected_profile = await new Promise<string | undefined>((resolve) => {
      const quick_pick = vscode.window.createQuickPick<vscode.QuickPickItem>()
      quick_pick.items = items
      if (last_selected_profile) {
        const active_item = items.find(
          (item) => item.label === last_selected_profile
        )
        if (active_item) {
          quick_pick.activeItems = [active_item]
        }
      }
      quick_pick.title = t(
        'views.prompt.handlers.handle-run-browser.select-profile.title'
      )
      quick_pick.placeholder = t(
        'views.prompt.handlers.handle-run-browser.select-profile.placeholder'
      )

      const close_button: vscode.QuickInputButton = {
        iconPath: new vscode.ThemeIcon('close'),
        tooltip: t('common.close')
      }
      quick_pick.buttons = [close_button]

      let is_accepted = false
      const disposables: vscode.Disposable[] = []
      const cleanup = () => {
        disposables.forEach((d) => d.dispose())
        quick_pick.dispose()
      }

      disposables.push(
        quick_pick.onDidAccept(() => {
          is_accepted = true
          const selected = quick_pick.selectedItems[0]
          if (selected) {
            prompt_view_provider.extension_context.globalState.update(
              LAST_SELECTED_BROWSER_PROFILE_STATE_KEY,
              selected.label
            )
          }
          resolve(selected?.label)
          quick_pick.hide()
        }),
        quick_pick.onDidTriggerButton((button) => {
          if (button === close_button) {
            quick_pick.hide()
          }
        }),
        quick_pick.onDidHide(() => {
          if (!is_accepted) {
            resolve(undefined)
          }
          cleanup()
        })
      )

      quick_pick.show()
    })

    if (!selected_profile) {
      return
    }
  }

  const cwc_dir = path.join(os.homedir(), '.cwc')
  const browser_dir = path.join(cwc_dir, 'browser')

  if (!fs.existsSync(browser_dir)) {
    fs.mkdirSync(browser_dir, { recursive: true })
  }

  const scheme = vscode.env.uriScheme
  const extension_path = path.join(
    cwc_dir,
    `repository-${scheme}`,
    'apps',
    'browser',
    'out'
  )
  const user_data_dir = path.join(browser_dir, 'profiles', selected_profile)
  const cached_path_file = path.join(browser_dir, '.chrome-157-path')

  if (fs.existsSync(cached_path_file)) {
    const executable_path = fs.readFileSync(cached_path_file, 'utf-8').trim()
    if (fs.existsSync(executable_path)) {
      launch_browser({ executable_path, user_data_dir, extension_path })
      return
    }
  }

  vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: t('views.prompt.handlers.handle-run-browser.downloading-browser'),
      cancellable: true
    },
    async (progress, token) => {
      try {
        const platform = detectBrowserPlatform()
        if (!platform) {
          throw new Error('Unsupported platform for Chrome for Testing.')
        }

        const build_id = await resolveBuildId(Browser.CHROME, platform, '157')

        if (token.isCancellationRequested) {
          return
        }

        let last_percentage = 0
        const installed_browser = await install({
          browser: Browser.CHROME,
          buildId: build_id,
          cacheDir: browser_dir,
          downloadProgressCallback: (downloaded_bytes, total_bytes) => {
            if (token.isCancellationRequested) {
              throw new Error('Download cancelled')
            }
            const percentage = Math.round(
              (downloaded_bytes / total_bytes) * 100
            )
            if (percentage > last_percentage) {
              progress.report({
                message: `${percentage}%`,
                increment: percentage - last_percentage
              })
              last_percentage = percentage
            }
          }
        })

        if (token.isCancellationRequested) {
          return
        }

        const executable_path = installed_browser.executablePath
        if (!executable_path || !fs.existsSync(executable_path)) {
          throw new Error('Could not determine Browser path.')
        }

        fs.writeFileSync(cached_path_file, executable_path)
        launch_browser({ executable_path, user_data_dir, extension_path })
      } catch (error: any) {
        if (error.message === 'Download cancelled') {
          return
        }
        vscode.window.showErrorMessage(
          `Failed to install Browser: ${error.message}`
        )
        throw error
      }
    }
  )
}
