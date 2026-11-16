import * as vscode from 'vscode'
import * as os from 'os'
import * as fs from 'fs'
import * as path from 'path'
import { get_response_preview_promise_resolve } from '@/features/apply-response/utils/preview'
import { apply_response } from '@/features/apply-response/apply-response'
import { t } from '@/i18n'
import { generate_diff_markdown } from '../utils/agentic-cli-invocation/utils/generate-diff-markdown'
import { Logger } from '@shared/utils/logger'

const build_diff_from_sandbox = async (
  sandbox_dir: string
): Promise<string> => {
  const file_mappings = new Map<
    string,
    { original: string; dest_rel: string }
  >()

  const workspace_folders = vscode.workspace.workspaceFolders || []

  const resolve_original_path = (unix_rel_path: string) => {
    if (workspace_folders.length === 1) {
      return path.join(workspace_folders[0].uri.fsPath, unix_rel_path)
    } else if (workspace_folders.length > 1) {
      const parts = unix_rel_path.split('/')
      const ws_name = parts[0]
      const folder = workspace_folders.find((f) => f.name === ws_name)
      if (folder) {
        return path.join(folder.uri.fsPath, parts.slice(1).join('/'))
      } else {
        return path.join(workspace_folders[0].uri.fsPath, unix_rel_path)
      }
    }
    return undefined
  }

  try {
    const metadata_path = path.join(sandbox_dir, '.cwc', 'metadata.json')
    const metadata_content = await fs.promises.readFile(metadata_path, 'utf-8')
    const metadata = JSON.parse(metadata_content)
    if (metadata && metadata.files && Array.isArray(metadata.files)) {
      for (const rel_path of metadata.files) {
        const original_backup_path = path.join(
          sandbox_dir,
          '.cwc',
          'originals',
          rel_path
        )
        const original_exists = await fs.promises
          .access(original_backup_path)
          .then(() => true)
          .catch(() => false)

        if (original_exists) {
          file_mappings.set(path.join(sandbox_dir, rel_path), {
            original: original_backup_path,
            dest_rel: rel_path
          })
        } else {
          const original = resolve_original_path(rel_path)
          if (original) {
            file_mappings.set(path.join(sandbox_dir, rel_path), {
              original,
              dest_rel: rel_path
            })
          }
        }
      }
    }
  } catch {
    // Ignore
  }

  return await generate_diff_markdown(sandbox_dir, file_mappings)
}

export const apply_from_terminal_command = (): vscode.Disposable => {
  return vscode.commands.registerCommand(
    'codeWebChat.applyFromTerminal',
    async () => {
      if (get_response_preview_promise_resolve()) {
        vscode.window.showInformationMessage(
          t('command.apply-from-terminal-command.disabled-during-preview')
        )
        return
      }

      const active_terminal = vscode.window.activeTerminal
      if (!active_terminal) {
        vscode.window.showWarningMessage(
          t('command.apply-from-terminal-command.warning.no-active-terminal')
        )
        return
      }

      const creation_options = active_terminal.creationOptions as
        | vscode.TerminalOptions
        | undefined
      const cwd = creation_options?.cwd

      let is_cwc_cli = false
      let cwd_path = ''

      if (cwd) {
        cwd_path = typeof cwd === 'string' ? cwd : cwd.fsPath

        if (cwd_path.startsWith(path.join(os.tmpdir(), 'cwc-cli-edit-'))) {
          is_cwc_cli = true
        }
      }

      if (is_cwc_cli) {
        try {
          const diff_markdown = await build_diff_from_sandbox(cwd_path)

          if (!diff_markdown.trim()) {
            vscode.window.showInformationMessage(
              t('command.apply-from-terminal-command.info.no-changes')
            )
            return
          }

          let cli_configuration_details:
            | { agent: string; flags?: string }
            | undefined
          let raw_instructions: string | undefined
          try {
            const metadata_path = path.join(cwd_path, '.cwc', 'metadata.json')
            const metadata_content = await fs.promises.readFile(
              metadata_path,
              'utf-8'
            )
            const metadata = JSON.parse(metadata_content)
            if (metadata) {
              if (metadata.agent) {
                cli_configuration_details = {
                  agent: metadata.agent,
                  flags: metadata.flags
                }
              }
              if (metadata.instructions) {
                raw_instructions = metadata.instructions
              }
            }
          } catch {
            // Ignore
          }

          const accepted = await apply_response({
            response: diff_markdown,
            raw_instructions,
            is_from_agentic_cli: true,
            cli_configuration_details
          })

          if (accepted) {
            try {
              await fs.promises.rm(cwd_path, { recursive: true, force: true })
            } catch (error) {
              Logger.error({
                function_name: 'apply_from_terminal_command',
                message: 'Failed to clean up sandbox directory',
                data: error
              })
            }
            active_terminal.dispose()
          }
        } catch (error) {
          Logger.error({
            function_name: 'apply_from_terminal_command',
            message: 'Failed to generate diff',
            data: error
          })
          vscode.window.showErrorMessage(
            `Failed to apply from terminal: ${error}`
          )
        }
      } else {
        vscode.window.showWarningMessage(
          t('command.apply-from-terminal-command.warning.not-cwc-cli')
        )
      }
    }
  )
}
