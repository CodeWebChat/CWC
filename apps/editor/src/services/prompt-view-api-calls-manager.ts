import { PromptViewProvider } from '@/views/prompt/backend/prompt-view-provider'
import { ChatsViewProvider } from '@/views/chats/backend/chats-view-provider'
import { send_llm_message } from '@/utils/send-llm-message'
import { randomUUID, createHash } from 'crypto'
import { display_token_count } from '@shared/utils/display-token-count'
import { Logger } from '@shared/utils/logger'
import { WaitingChain } from '@/utils/waiting-chain'
import * as vscode from 'vscode'
import { t } from '@/i18n'

export class PromptViewApiCallsManager {
  private abort_controllers: Map<string, AbortController> = new Map()
  private next_allowed_finish_time = 0
  private waiting_chain = new WaitingChain()

  constructor(
    private prompt_view_provider: PromptViewProvider,
    private chats_view_provider: ChatsViewProvider
  ) {}

  private broadcast_message(message: any) {
    this.prompt_view_provider.send_message(message)
    this.chats_view_provider.send_message(message)
  }

  async send_llm_message(params: {
    base_url: string
    api_key: string
    body: any
    provider_name: string
    model?: string
    reasoning_effort?: string
    raw_instructions: string
  }): Promise<{ response: string; thoughts?: string } | null> {
    const request_id = randomUUID()
    const abort_controller = new AbortController()
    this.abort_controllers.set(request_id, abort_controller)

    const body_to_hash = JSON.parse(JSON.stringify(params.body))
    delete body_to_hash.reasoning_effort
    delete body_to_hash.reasoning
    delete body_to_hash.thinking
    delete body_to_hash.output_config
    if (body_to_hash.extra_body?.google?.thinking_config) {
      delete body_to_hash.extra_body.google.thinking_config
    }

    const body_hash = createHash('md5')
      .update(JSON.stringify(body_to_hash))
      .digest('hex')

    const gate = this.waiting_chain.enqueue({
      key: `${params.base_url}:${body_hash}`
    })

    return await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: t('service.prompt-view-api-calls-manager.edit-with-api'),
        cancellable: true
      },
      async (progress, token) => {
        token.onCancellationRequested(() => {
          this.cancel_api_call(request_id)
        })

        try {
          const is_queued = gate.must_wait

          const queued_msg = t(
            'service.prompt-view-api-calls-manager.progress.queued'
          )
          const waiting_msg = t('common.progress.waiting-for-server')
          const thinking_msg = t('common.progress.thinking')
          const receiving_msg = t('common.progress.receiving')

          progress.report({ message: is_queued ? queued_msg : waiting_msg })

          this.broadcast_message({
            command: 'SHOW_PROMPT_VIEW_API_CALLS_MANAGER_PROGRESS',
            id: request_id,
            status: is_queued ? queued_msg : waiting_msg,
            provider_name: params.provider_name,
            model: params.model,
            reasoning_effort: params.reasoning_effort
          })

          if (is_queued) {
            await gate.wait(abort_controller.signal)

            progress.report({ message: waiting_msg })

            this.broadcast_message({
              command: 'SHOW_PROMPT_VIEW_API_CALLS_MANAGER_PROGRESS',
              id: request_id,
              status: waiting_msg,
              provider_name: params.provider_name,
              model: params.model,
              reasoning_effort: params.reasoning_effort
            })
          }

          const result = await send_llm_message({
            base_url: params.base_url,
            api_key: params.api_key,
            body: params.body,
            abort_signal: abort_controller.signal,
            on_thinking_chunk: () => {
              gate.release()
              progress.report({ message: thinking_msg })
              this.broadcast_message({
                command: 'SHOW_PROMPT_VIEW_API_CALLS_MANAGER_PROGRESS',
                id: request_id,
                status: thinking_msg,
                provider_name: params.provider_name,
                model: params.model,
                reasoning_effort: params.reasoning_effort
              })
            },
            on_chunk: (tokens_per_second, total_tokens) => {
              gate.release()

              const msg =
                tokens_per_second && total_tokens
                  ? t(
                      'service.prompt-view-api-calls-manager.progress.receiving-stats',
                      {
                        total_tokens: display_token_count(total_tokens),
                        tokens_per_second: Math.round(tokens_per_second)
                      }
                    )
                  : receiving_msg

              progress.report({ message: msg })
              this.broadcast_message({
                command: 'SHOW_PROMPT_VIEW_API_CALLS_MANAGER_PROGRESS',
                id: request_id,
                status: msg,
                tokens_per_second,
                total_tokens,
                provider_name: params.provider_name,
                model: params.model,
                reasoning_effort: params.reasoning_effort
              })
            }
          })

          if (result) {
            this.chats_view_provider.add_chat({
              timestamp: Date.now(),
              provider_name: params.provider_name,
              model: params.model,
              reasoning_effort: params.reasoning_effort,
              raw_instructions: params.raw_instructions,
              response: result.response,
              thoughts: result.thoughts
            })
          }

          return result
        } catch (error: any) {
          if (abort_controller.signal.aborted) {
            throw error
          }

          Logger.error({
            function_name: 'send_llm_message',
            message: 'API call error',
            data: error
          })

          return null
        } finally {
          gate.release()

          this.broadcast_message({
            command: 'HIDE_PROMPT_VIEW_API_CALLS_MANAGER_PROGRESS',
            id: request_id
          })
          this.abort_controllers.delete(request_id)

          const now = Date.now()
          const wait_until = Math.max(now, this.next_allowed_finish_time)
          const delay = wait_until - now
          this.next_allowed_finish_time = wait_until + 500

          if (delay > 0) {
            await new Promise((resolve) => setTimeout(resolve, delay))
          }
        }
      }
    )
  }

  cancel_api_call(request_id: string) {
    const controller = this.abort_controllers.get(request_id)
    if (controller) {
      controller.abort('Cancelled by user.')
      this.abort_controllers.delete(request_id)
    }
  }

  cancel_all_requests() {
    this.abort_controllers.forEach((controller) => {
      controller.abort('Cancelled by user.')
    })
    this.abort_controllers.clear()
  }
}
