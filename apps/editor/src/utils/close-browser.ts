import * as vscode from 'vscode'
import * as os from 'os'
import * as path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'

const exec_file = promisify(execFile)

const wait_for_exit = async (pid: number, timeout_ms: number) => {
  const deadline = Date.now() + timeout_ms
  while (Date.now() < deadline) {
    try {
      process.kill(pid, 0)
    } catch {
      return true
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  return false
}

export const close_browser = async () => {
  if (vscode.env.remoteName) {
    return
  }

  const chrome_dir_prefix =
    path.join(os.homedir(), '.cwc', 'browser', 'chrome') + path.sep

  try {
    if (process.platform === 'win32') {
      const script = [
        '$target = $env:CWC_CHROME_DIR',
        '$procs = Get-CimInstance Win32_Process -Filter "Name = \'chrome.exe\'" | Where-Object {',
        '  $_.ExecutablePath -and',
        '  $_.ExecutablePath.StartsWith($target, [System.StringComparison]::OrdinalIgnoreCase) -and',
        "  (-not $_.CommandLine -or $_.CommandLine.IndexOf('--type=', [System.StringComparison]::OrdinalIgnoreCase) -lt 0)",
        '}',
        'foreach ($p in $procs) {',
        '  $proc = Get-Process -Id $p.ProcessId -ErrorAction SilentlyContinue',
        '  if ($proc) {',
        '    taskkill /PID $p.ProcessId 2>$null | Out-Null',
        '    if (-not $proc.WaitForExit(3000)) {',
        '      taskkill /F /T /PID $p.ProcessId 2>$null | Out-Null',
        '    }',
        '  }',
        '}'
      ].join('\n')

      await exec_file(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-Command', script],
        {
          env: {
            ...process.env,
            CWC_CHROME_DIR: chrome_dir_prefix
          },
          windowsHide: true
        }
      )
    } else {
      const { stdout } = await exec_file(
        'ps',
        ['-e', '-ww', '-o', 'pid=,args='],
        { maxBuffer: 10 * 1024 * 1024 }
      )

      const pids = stdout
        .split('\n')
        .map((line) => line.trim())
        .map((line) => {
          const match = line.match(/^(\d+)\s+(.*)$/)
          if (!match) return null
          return {
            pid: parseInt(match[1], 10),
            args: match[2]
          }
        })
        .filter(
          (entry): entry is { pid: number; args: string } =>
            entry !== null &&
            entry.pid !== process.pid &&
            entry.args.startsWith(chrome_dir_prefix) &&
            !entry.args.includes('--type=')
        )
        .map((entry) => entry.pid)

      await Promise.all(
        pids.map(async (pid) => {
          try {
            process.kill(pid, 'SIGTERM')
          } catch {
            return
          }

          const exited = await wait_for_exit(pid, 3000)
          if (!exited) {
            try {
              process.kill(pid, 'SIGKILL')
            } catch {
              // Process already exited
            }
          }
        })
      )
    }
  } catch {
    // Best-effort cleanup; do not block the update if closing fails
  }
}
