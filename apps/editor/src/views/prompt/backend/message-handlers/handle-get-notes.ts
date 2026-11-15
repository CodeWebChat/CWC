import { PromptViewProvider } from '@/views/prompt/backend/prompt-view-provider'
import { NotesStorage } from '@/utils/global-workspace-storage'

export const handle_get_notes = async (
  prompt_view_provider: PromptViewProvider
): Promise<void> => {
  const workspace_roots =
    prompt_view_provider.workspace_provider.get_workspace_roots()
  const all_data = NotesStorage.load_all(prompt_view_provider.extension_context)

  const notes: Record<string, string> = {}

  for (const root of workspace_roots) {
    notes[root] = all_data[root] || ''
  }

  prompt_view_provider.send_message({
    command: 'NOTES',
    notes
  })
}
