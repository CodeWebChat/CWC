import * as os from 'os'
import * as path from 'path'
import * as vscode from 'vscode'
import { execFileSync } from 'child_process'
import { WorkspaceProvider } from '@/context/providers/workspace/workspace-provider'
import { get_git_diff, get_git_info, is_git_repository } from './git-utils'
import { sync_directory } from './sync-directory'
import { Logger } from '@shared/utils/logger'
import { t } from '@/i18n'

export interface WorkspaceSnapshotData {
  uses_git: boolean
  git_data?: Record<string, any>
  skipped_folders?: string[]
}

export const create_workspace_snapshot = async (
  dest_dir_path: string
): Promise<WorkspaceSnapshotData> => {
  await vscode.workspace.saveAll()

  const workspace_folders = vscode.workspace.workspaceFolders!

  const folder_git_statuses = await Promise.all(
    workspace_folders.map((folder) => is_git_repository(folder))
  )

  const git_data: Record<string, any> = {}
  const skipped_folders: string[] = []

  await Promise.all(
    workspace_folders.map(async (folder, index) => {
      const has_git = folder_git_statuses[index]
      if (!has_git) {
        skipped_folders.push(folder.name)
        return
      }

      const folder_key = `${index}-${folder.name}`
      const git_info = await get_git_info(folder)
      const diff = await get_git_diff(folder)

      if (git_info && diff !== null) {
        git_data[folder_key] = {
          branch: git_info.branch,
          commit_hash: git_info.commit_hash
        }

        const diff_file_path = path.join(dest_dir_path, `${folder_key}.diff`)
        await vscode.workspace.fs.writeFile(
          vscode.Uri.file(diff_file_path),
          new Uint8Array(Buffer.from(diff, 'utf8'))
        )
      } else {
        Logger.warn({
          function_name: 'create_workspace_snapshot',
          message: `Failed to get git information for repository in ${folder.name}. Skipping folder.`
        })
      }
    })
  )

  const has_git_data = Object.keys(git_data).length > 0

  return {
    uses_git: has_git_data,
    git_data: has_git_data ? git_data : undefined,
    skipped_folders: skipped_folders.length > 0 ? skipped_folders : undefined
  }
}

export const restore_workspace_snapshot = async (
  source_dir_path: string,
  snapshot_data: WorkspaceSnapshotData,
  workspace_provider: WorkspaceProvider,
  progress?: vscode.Progress<{ message?: string; increment?: number }>
) => {
  if (!snapshot_data.uses_git || !snapshot_data.git_data) {
    return
  }

  const workspace_folders = vscode.workspace.workspaceFolders!

  for (let index = 0; index < workspace_folders.length; index++) {
    const folder = workspace_folders[index]
    const folder_key = `${index}-${folder.name}`
    const git_info = snapshot_data.git_data[folder_key]

    if (!git_info || !(await is_git_repository(folder))) {
      continue
    }

    {
      const current_git_info = await get_git_info(folder)
      if (
        current_git_info &&
        current_git_info.commit_hash === git_info.commit_hash
      ) {
        try {
          execFileSync('git', ['restore', '.'], {
            cwd: folder.uri.fsPath,
            stdio: 'pipe'
          })
          execFileSync('git', ['clean', '-fd'], {
            cwd: folder.uri.fsPath,
            stdio: 'pipe'
          })
        } catch (error) {
          Logger.warn({
            function_name: 'restore_workspace_snapshot',
            message: `git restore/clean failed for ${folder.name}, falling back to checkout`,
            data: error
          })
          try {
            execFileSync('git', ['checkout', '.'], {
              cwd: folder.uri.fsPath,
              stdio: 'pipe'
            })
            execFileSync('git', ['clean', '-fd'], {
              cwd: folder.uri.fsPath,
              stdio: 'pipe'
            })
          } catch (e) {
            Logger.error({
              function_name: 'restore_workspace_snapshot',
              message: `Failed to reject changes for ${folder.name}`,
              data: e
            })
            throw new Error(
              t('command.history-command.error.reject-changes-failed', {
                folder: folder.name
              })
            )
          }
        }

        const diff_file_path = path.join(source_dir_path, `${folder_key}.diff`)

        let diff = ''
        try {
          const diff_content = await vscode.workspace.fs.readFile(
            vscode.Uri.file(diff_file_path)
          )
          diff = Buffer.from(diff_content).toString('utf8')
        } catch {
          // Ignore
        }

        if (diff.trim().length > 0) {
          const temp_diff_path = path.join(
            os.tmpdir(),
            `cwc-diff-${Date.now()}-${Math.random().toString().slice(2)}.diff`
          )

          await vscode.workspace.fs.writeFile(
            vscode.Uri.file(temp_diff_path),
            new Uint8Array(Buffer.from(diff, 'utf8'))
          )
          try {
            execFileSync(
              'git',
              ['apply', '--whitespace=nowarn', temp_diff_path],
              {
                cwd: folder.uri.fsPath,
                stdio: 'pipe'
              }
            )
          } catch {
            try {
              execFileSync(
                'git',
                ['apply', '--reject', '--whitespace=nowarn', temp_diff_path],
                {
                  cwd: folder.uri.fsPath,
                  stdio: 'pipe'
                }
              )
              vscode.window.showWarningMessage(
                t('command.history-command.warning.diff-apply-issues', {
                  folder: folder.name
                })
              )
            } catch (reject_error) {
              Logger.error({
                function_name: 'restore_workspace_snapshot',
                message: `Failed to apply git diff even with --reject for ${folder.name}`,
                data: reject_error
              })
              throw new Error(
                t('command.history-command.error.diff-apply-failed', {
                  folder: folder.name
                })
              )
            }
          } finally {
            try {
              await vscode.workspace.fs.delete(vscode.Uri.file(temp_diff_path))
            } catch {
              // Ignore
            }
          }
        }
        continue
      }

      const temp_git_clone_path = path.join(
        os.tmpdir(),
        `cwc-git-clone-${Date.now()}-${Math.random().toString().slice(2)}`
      )
      const temp_git_dir_uri = vscode.Uri.file(temp_git_clone_path)
      const temp_index_path = path.join(
        os.tmpdir(),
        `cwc-index-${Date.now()}-${Math.random().toString().slice(2)}.index`
      )

      try {
        await vscode.workspace.fs.createDirectory(temp_git_dir_uri)

        const git_env = {
          ...process.env,
          GIT_INDEX_FILE: temp_index_path,
          GIT_WORK_TREE: temp_git_clone_path
        }

        execFileSync('git', ['read-tree', git_info.commit_hash], {
          cwd: folder.uri.fsPath,
          env: git_env,
          stdio: 'pipe'
        })

        execFileSync('git', ['checkout-index', '-a', '-f'], {
          cwd: folder.uri.fsPath,
          env: git_env,
          stdio: 'pipe'
        })

        const diff_file_path = path.join(source_dir_path, `${folder_key}.diff`)

        let diff = ''
        try {
          const diff_content = await vscode.workspace.fs.readFile(
            vscode.Uri.file(diff_file_path)
          )
          diff = Buffer.from(diff_content).toString('utf8')
        } catch {
          // Ignore
        }

        if (diff.trim().length > 0) {
          const temp_diff_path = path.join(temp_git_clone_path, 'cwc.diff')
          await vscode.workspace.fs.writeFile(
            vscode.Uri.file(temp_diff_path),
            new Uint8Array(Buffer.from(diff, 'utf8'))
          )
          try {
            execFileSync(
              'git',
              ['apply', '--whitespace=nowarn', temp_diff_path],
              {
                cwd: temp_git_clone_path,
                stdio: 'pipe'
              }
            )
          } catch {
            try {
              execFileSync(
                'git',
                ['apply', '--reject', '--whitespace=nowarn', temp_diff_path],
                {
                  cwd: temp_git_clone_path,
                  stdio: 'pipe'
                }
              )
              vscode.window.showWarningMessage(
                t('command.history-command.warning.diff-apply-issues', {
                  folder: folder.name
                })
              )
            } catch (reject_error) {
              Logger.error({
                function_name: 'restore_workspace_snapshot',
                message: `Failed to apply git diff even with --reject for ${folder.name}`,
                data: reject_error
              })
              throw new Error(
                t('command.history-command.error.diff-apply-failed', {
                  folder: folder.name
                })
              )
            }
          } finally {
            try {
              await vscode.workspace.fs.delete(vscode.Uri.file(temp_diff_path))
            } catch {
              // Ignore
            }
          }
        }

        await sync_directory({
          source_dir: temp_git_dir_uri,
          dest_dir: folder.uri,
          root_path: folder.uri.fsPath,
          workspace_provider,
          progress
        })
      } catch (err) {
        Logger.error({
          function_name: 'restore_workspace_snapshot',
          message: `Error restoring git checkpoint for ${folder.name}`,
          data: err
        })
        throw err
      } finally {
        if (temp_git_dir_uri) {
          try {
            await vscode.workspace.fs.delete(temp_git_dir_uri, {
              recursive: true
            })
          } catch {
            // Ignore
          }
        }
        if (temp_index_path) {
          try {
            await vscode.workspace.fs.delete(vscode.Uri.file(temp_index_path))
          } catch {
            // Ignore
          }
        }
      }
    }
  }
}
