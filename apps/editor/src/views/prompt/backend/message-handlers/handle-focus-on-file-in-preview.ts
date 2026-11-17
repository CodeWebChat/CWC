import { code_review_promise_resolve } from '@/features/apply-response/utils/code-review'
import { FocusOnFileInPreviewMessage } from '@/views/prompt/types/messages'

export const handle_focus_on_file_in_preview = (
  message: FocusOnFileInPreviewMessage
) => {
  if (code_review_promise_resolve) {
    code_review_promise_resolve({
      jump_to: {
        file_path: message.file_path,
        workspace_name: message.workspace_name
      }
    })
  }
}
