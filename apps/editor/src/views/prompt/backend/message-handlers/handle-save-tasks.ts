import { PromptViewProvider } from '@/views/prompt/backend/prompt-view-provider'
import { SaveTasksMessage } from '@/views/prompt/types/messages'
import { TasksStorage } from '@/utils/global-workspace-storage'

export const handle_save_tasks = async (
  prompt_view_provider: PromptViewProvider,
  message: SaveTasksMessage
): Promise<void> => {
  let all_data = TasksStorage.load_all(prompt_view_provider.extension_context)

  all_data = {
    ...all_data,
    ...message.tasks
  }

  TasksStorage.save_all(prompt_view_provider.extension_context, all_data)
}
