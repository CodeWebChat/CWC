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

const launch_browser = (
  executable_path: string,
  user_data_dir: string,
  extension_path: string
) => {
  const args = [
    `--user-data-dir=${user_data_dir}`,
    `--load-extension=${extension_path}`
  ]

  if (process.platform === 'darwin') {
    args.push('--use-mock-keychain')
  } else if (process.platform === 'linux') {
    args.push('--password-store=basic')
  }

  const child = spawn(executable_path, args, {
    detached: true,
    stdio: 'ignore'
  })
  child.unref()
}

export const handle_run_browser = async () => {
  if (vscode.env.remoteName) {
    vscode.window.showWarningMessage(
      t('views.prompt.handlers.handle-run-browser.remote-not-supported')
    )
    return
  }

  const cwc_dir = path.join(os.homedir(), '.cwc')

  if (!fs.existsSync(cwc_dir)) {
    fs.mkdirSync(cwc_dir, { recursive: true })
  }

  const scheme = vscode.env.uriScheme
  const extension_path = path.join(
    cwc_dir,
    `repository-${scheme}`,
    'apps',
    'browser',
    'out'
  )
  const user_data_dir = path.join(cwc_dir, 'profiles', 'Default')
  const cached_path_file = path.join(cwc_dir, '.chrome-157-path')

  if (fs.existsSync(cached_path_file)) {
    const executable_path = fs.readFileSync(cached_path_file, 'utf-8').trim()
    if (fs.existsSync(executable_path)) {
      launch_browser(executable_path, user_data_dir, extension_path)
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
          cacheDir: cwc_dir,
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
        launch_browser(executable_path, user_data_dir, extension_path)
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
