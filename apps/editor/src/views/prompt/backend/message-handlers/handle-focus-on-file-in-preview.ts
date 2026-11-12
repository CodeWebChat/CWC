import { response_preview_promise_resolve } from '@/features/apply-response/utils/preview'
import { FocusOnFileInPreviewMessage } from '@/views/prompt/types/messages'

export const handle_focus_on_file_in_preview = (
  message: FocusOnFileInPreviewMessage
) => {
  if (response_preview_promise_resolve) {
    response_preview_promise_resolve({
      jump_to: {
        file_path: message.file_path,
        workspace_name: message.workspace_name
      }
    })
  }
}
