import { PromptViewProvider } from '@/views/prompt/backend/prompt-view-provider'
import * as vscode from 'vscode'

const get_has_changes_to_commit = (): boolean => {
  try {
    const git_extension = vscode.extensions.getExtension('vscode.git')
    if (!git_extension || !git_extension.isActive) return false

    const git_api = git_extension.exports?.getAPI(1)
    if (!git_api) return false

    const repositories = git_api.repositories
    if (!repositories) return false

    return repositories.some(
      (repo: any) =>
        (repo.state.indexChanges && repo.state.indexChanges.length > 0) ||
        (repo.state.workingTreeChanges &&
          repo.state.workingTreeChanges.length > 0)
    )
  } catch {
    return false
  }
}

export const handle_get_workspace_state = (
  prompt_view_provider: PromptViewProvider
) => {
  prompt_view_provider.send_message({
    command: 'WORKSPACE_STATE',
    folder_count:
      prompt_view_provider.workspace_provider.get_workspace_roots().length,
    has_changes_to_commit: get_has_changes_to_commit()
  })
}
