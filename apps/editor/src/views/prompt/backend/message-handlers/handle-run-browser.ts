import * as vscode from 'vscode'
import * as path from 'path'
import * as os from 'os'
import * as fs from 'fs'
import { exec, spawn } from 'child_process'

export const handle_run_browser = async () => {
  const cwc_dir = path.join(os.homedir(), '.cwc')
  const browsers_dir = path.join(cwc_dir, 'browsers')

  if (!fs.existsSync(browsers_dir)) {
    fs.mkdirSync(browsers_dir, { recursive: true })
  }

  const scheme = vscode.env.uriScheme
  const extension_path = path.join(
    cwc_dir,
    `repository-${scheme}`,
    'apps',
    'browser',
    'out'
  )
  const user_data_dir = path.join(browsers_dir, 'chrome-user-data')

  vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Installing Browser...',
      cancellable: false
    },
    async () => {
      return new Promise<void>((resolve, reject) => {
        const exec_options: Record<string, any> = { cwd: browsers_dir }

        if (process.platform !== 'win32') {
          const env = { ...process.env }
          if (process.platform === 'darwin') {
            env.PATH = `${env.PATH || ''}:/usr/local/bin:/opt/homebrew/bin`
          }
          exec_options.env = env
          if (vscode.env.shell) {
            exec_options.shell = vscode.env.shell
          }
        }

        exec(
          'npx @puppeteer/browsers install chrome@157',
          exec_options,
          (error, stdout) => {
            if (error) {
              vscode.window.showErrorMessage(
                `Failed to install Browser: ${error.message}`
              )
              reject(error)
              return
            }

            const match = stdout.match(/chrome@\S+\s+(.+)/)
            const executable_path = match ? match[1].trim() : ''

            if (!executable_path || !fs.existsSync(executable_path)) {
              vscode.window.showErrorMessage(
                `Could not determine Browser path.`
              )
              reject(new Error('Could not find executable path'))
              return
            }

            const child = spawn(
              executable_path,
              [
                `--user-data-dir=${user_data_dir}`,
                `--load-extension=${extension_path}`
              ],
              {
                detached: true,
                stdio: 'ignore'
              }
            )
            child.unref()
            resolve()
          }
        )
      })
    }
  )
}
