import { TERMINAL_INTERACTIVITY_STATE_KEY } from '@/constants/state-keys'
import { PromptViewProvider } from '@/views/prompt/backend/prompt-view-provider'
import { SaveTerminalInteractivityMessage } from '@/views/prompt/types/messages'

export const handle_save_terminal_interactivity = (
  prompt_view_provider: PromptViewProvider,
  message: SaveTerminalInteractivityMessage
): void => {
  prompt_view_provider.terminal_interactivity = message.terminal_interactivity

  prompt_view_provider.extension_context.workspaceState.update(
    TERMINAL_INTERACTIVITY_STATE_KEY,
    message.terminal_interactivity
  )
  prompt_view_provider.extension_context.globalState.update(
    TERMINAL_INTERACTIVITY_STATE_KEY,
    message.terminal_interactivity
  )
}
