import { code_review_promise_resolve } from '@/features/apply-response/utils/code-review'
import { CodeReviewMessage } from '@/views/prompt/types/messages'

export const handle_code_review = async (
  message: CodeReviewMessage
): Promise<void> => {
  if (code_review_promise_resolve) {
    code_review_promise_resolve({
      accepted_files: message.files,
      created_at: message.created_at
    })
  }
}
