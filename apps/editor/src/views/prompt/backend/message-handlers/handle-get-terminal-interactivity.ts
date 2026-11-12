import { PromptViewProvider } from '@/views/prompt/backend/prompt-view-provider'

export const handle_get_terminal_interactivity = (
  prompt_view_provider: PromptViewProvider
) => {
  prompt_view_provider.send_message({
    command: 'TERMINAL_INTERACTIVITY',
    terminal_interactivity: prompt_view_provider.terminal_interactivity
  })
}
