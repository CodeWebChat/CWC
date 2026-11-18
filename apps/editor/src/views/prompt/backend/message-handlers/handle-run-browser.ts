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

const is_wsl = () =>
  process.platform === 'linux' &&
  (vscode.env.remoteName === 'wsl' || /microsoft/i.test(os.release()))

const get_log_tail = (log_path: string) => {
  try {
    return fs
      .readFileSync(log_path, 'utf-8')
      .trim()
      .split('\n')
      .slice(-5)
      .join('\n')
  } catch {
    return ''
  }
}

const chrome_debian_packages = [
  'libnss3',
  'libatk1.0-0',
  'libatk-bridge2.0-0',
  'libcups2',
  'libdrm2',
  'libxkbcommon0',
  'libxcomposite1',
  'libxdamage1',
  'libxfixes3',
  'libxrandr2',
  'libgbm1'
]

const get_distro_ids = (): string[] => {
  try {
    const content = fs.readFileSync('/etc/os-release', 'utf-8')
    const ids: string[] = []
    for (const line of content.split('\n')) {
      const match = line.match(/^(ID|ID_LIKE)=(.*)$/)
      if (match) {
        ids.push(
          ...match[2]
            .replace(/["']/g, '')
            .trim()
            .toLowerCase()
            .split(/\s+/)
            .filter(Boolean)
        )
      }
    }
    return ids
  } catch {
    return []
  }
}

const get_install_command = (): string | undefined => {
  const ids = get_distro_ids()
  const is_distro = (...names: string[]) =>
    names.some((name) => ids.includes(name))

  if (is_distro('debian', 'ubuntu')) {
    const asound_package =
      '$(apt-cache show libasound2t64 >/dev/null 2>&1 && echo libasound2t64 || echo libasound2)'
    return `sudo apt-get update && sudo apt-get install -y ${chrome_debian_packages.join(' ')} ${asound_package}`
  }

  if (is_distro('fedora', 'rhel', 'centos')) {
    return 'sudo dnf install -y nss atk at-spi2-atk cups-libs libdrm libxkbcommon libXcomposite libXdamage libXfixes libXrandr mesa-libgbm alsa-lib pango cairo'
  }

  if (is_distro('arch')) {
    return 'sudo pacman -S --needed --noconfirm nss atk at-spi2-core cups libdrm libxkbcommon libxcomposite libxdamage libxfixes libxrandr mesa alsa-lib pango cairo'
  }

  if (is_distro('opensuse', 'suse', 'sles')) {
    return 'sudo zypper install -y mozilla-nss libatk-1_0-0 libatk-bridge-2_0-0 cups-libs libdrm2 libxkbcommon0 libXcomposite1 libXdamage1 libXfixes3 libXrandr2 libgbm1 libasound2'
  }

  return undefined
}

const run_in_terminal = (command: string) => {
  const terminal = vscode.window.createTerminal({
    name: 'Install browser dependencies'
  })
  terminal.show()
  terminal.sendText(command)
}

const show_launch_error = (reason: string, log_path: string) => {
  const log_tail = get_log_tail(log_path)

  if (is_wsl() && /shared libraries/i.test(log_tail)) {
    const install_command = get_install_command()
    if (install_command) {
      run_in_terminal(install_command)
      return
    }
  }

  const hint = /shared libraries/i.test(log_tail)
    ? '\nSystem libraries required by Chrome are missing. Install them, e.g. on Ubuntu/Debian: sudo apt install -y libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2 (libasound2t64 on newer releases).'
    : ''
  vscode.window.showErrorMessage(
    `Failed to launch Browser: ${reason}${hint}\nLog: ${log_path}${
      log_tail ? `\n${log_tail}` : ''
    }`
  )
}

const launch_browser = (
  executable_path: string,
  user_data_dir: string,
  extension_path: string
): Promise<void> => {
  const args = [
    `--user-data-dir=${user_data_dir}`,
    `--load-extension=${extension_path}`
  ]
  const env: NodeJS.ProcessEnv = { ...process.env }

  if (process.platform === 'darwin') {
    args.push('--use-mock-keychain')
  } else if (process.platform === 'linux') {
    args.push('--password-store=basic')

    if (is_wsl()) {
      args.push('--no-sandbox', '--disable-dev-shm-usage')
      env.DISPLAY ??= ':0'
      env.WAYLAND_DISPLAY ??= 'wayland-0'
      env.XDG_RUNTIME_DIR ??= '/mnt/wslg/runtime-dir'
    }
  }

  const log_path = path.join(os.homedir(), '.cwc', 'browser.log')

  return new Promise<void>((resolve) => {
    let settled = false
    let timer: NodeJS.Timeout | undefined

    const settle = () => {
      if (settled) return
      settled = true
      if (timer) clearTimeout(timer)
      resolve()
    }

    let log_fd: number
    try {
      log_fd = fs.openSync(log_path, 'w')
    } catch {
      log_fd = -1
    }

    try {
      const child = spawn(executable_path, args, {
        detached: true,
        stdio: log_fd >= 0 ? ['ignore', log_fd, log_fd] : 'ignore',
        env
      })

      child.on('error', (error) => {
        if (settled) return
        show_launch_error(error.message, log_path)
        settle()
      })

      child.on('exit', (code, signal) => {
        if (settled) return
        if (code !== 0) {
          show_launch_error(
            `process exited early (${signal ? `signal ${signal}` : `code ${code}`})`,
            log_path
          )
        }
        settle()
      })

      timer = setTimeout(() => {
        // Still running after 3s, so startup succeeded
        child.unref()
        settle()
      }, 3000)
    } catch (error: any) {
      show_launch_error(error.message, log_path)
      settle()
    } finally {
      if (log_fd >= 0) fs.closeSync(log_fd)
    }
  })
}

export const handle_run_browser = async () => {
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
