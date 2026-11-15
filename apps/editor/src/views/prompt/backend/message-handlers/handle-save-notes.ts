import { PromptViewProvider } from '@/views/prompt/backend/prompt-view-provider'
import { SaveNotesMessage } from '@/views/prompt/types/messages'
import { NotesStorage } from '@/utils/global-workspace-storage'

export const handle_save_notes = async (
  prompt_view_provider: PromptViewProvider,
  message: SaveNotesMessage
): Promise<void> => {
  let all_data = NotesStorage.load_all(prompt_view_provider.extension_context)

  all_data = {
    ...all_data,
    ...message.notes
  }

  NotesStorage.save_all(prompt_view_provider.extension_context, all_data)
}
