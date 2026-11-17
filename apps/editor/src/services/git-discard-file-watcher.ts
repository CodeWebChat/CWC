import * as path from 'path'
import * as vscode from 'vscode'
import { CommitMessageDetails } from '../utils/commit-message-details'
import { normalize_path } from '../utils/normalize-path'

export const setup_git_discard_file_watcher = (
  extension_context: vscode.ExtensionContext
) => {
  const git_extension = vscode.extensions.getExtension('vscode.git')
  if (!git_extension) return

  const init = async () => {
    try {
      if (!git_extension.isActive) {
        await git_extension.activate()
      }
      const git_api = git_extension.exports.getAPI(1)

      const repo_states = new Map<string, Set<string>>()

      const update_repo_state = (repo: any) => {
        const workspace_root = repo.rootUri.fsPath
        const current_changes = new Set<string>()

        const all_changes = [
          ...(repo.state.indexChanges || []),
          ...(repo.state.workingTreeChanges || []),
          ...(repo.state.mergeChanges || [])
        ]

        for (const change of all_changes) {
          if (change.uri) {
            const relative_path = normalize_path(
              path.relative(workspace_root, change.uri.fsPath)
            )
            current_changes.add(relative_path)
          }
          if (change.originalUri) {
            const original_relative_path = normalize_path(
              path.relative(workspace_root, change.originalUri.fsPath)
            )
            current_changes.add(original_relative_path)
          }
        }

        const previous_changes = repo_states.get(workspace_root)

        if (previous_changes) {
          const has_removed_files = Array.from(previous_changes).some(
            (prev_change) => !current_changes.has(prev_change)
          )

          if (has_removed_files) {
            CommitMessageDetails.clean_up_stale_data({
              extension_context,
              repository: repo
            })
          }
        }

        repo_states.set(workspace_root, current_changes)
      }

      for (const repo of git_api.repositories) {
        update_repo_state(repo)
        extension_context.subscriptions.push(
          repo.state.onDidChange(() => update_repo_state(repo))
        )
      }

      extension_context.subscriptions.push(
        git_api.onDidOpenRepository((repo: any) => {
          update_repo_state(repo)
          extension_context.subscriptions.push(
            repo.state.onDidChange(() => update_repo_state(repo))
          )
        })
      )
    } catch (error) {
      console.error('Failed to initialize git state watcher:', error)
    }
  }

  init()
}
