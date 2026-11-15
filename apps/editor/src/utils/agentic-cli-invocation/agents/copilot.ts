import * as os from 'os'
import { CodingAgent } from '../types'
import { check_command_exists } from '../utils/check-command-exists'
import { get_progress_dots } from '../utils/get-progress-dots'
import { AGENTS } from '../../../constants/agents'

let last_action_name = ''
let action_count = 0
const delta_buffers = new Map<string, string>()

const agent_name = 'GitHub Copilot'

export const copilot_agent: CodingAgent = {
  id: 'copilot',
  label: agent_name,
  cmd: 'copilot',
  is_installed: () => check_command_exists('copilot'),
  get_documentation_url: () => AGENTS[agent_name].docs_url,
  get_headless_args: () => {
    last_action_name = ''
    action_count = 0
    delta_buffers.clear()
    return ['--allow-all', '--no-ask-user', '--output-format', 'json']
  },
  get_integrated_terminal_edit_args: () => ['--allow-all'],
  get_integrated_terminal_ask_args: () => [],
  get_integrated_terminal_prompt_args: (temp_prompt_path: string) => {
    if (os.platform() === 'win32') {
      return `"-i" "$(Get-Content -Raw '${temp_prompt_path.replace(/'/g, "''")}')"`
    }
    return `'-i' "$(cat '${temp_prompt_path.replace(/'/g, "'\\''")}')"`
  },
  parse_stream_line: (parsed, report_progress) => {
    if (parsed.type === 'tool.execution_start' && parsed.data?.toolName) {
      const action_name = parsed.data.toolName.replace(/_/g, ' ').toLowerCase()

      if (action_name === last_action_name) {
        action_count++
      } else {
        last_action_name = action_name
        action_count = 1
      }

      report_progress(`${action_name}${get_progress_dots(action_count)}`)
    } else if (
      parsed.type === 'assistant.message_delta' &&
      parsed.data?.deltaContent
    ) {
      const message_id = parsed.data.messageId || 'default'
      const updated =
        (delta_buffers.get(message_id) || '') + parsed.data.deltaContent
      delta_buffers.set(message_id, updated)
      return { output: updated }
    } else if (parsed.type === 'assistant.message') {
      if (parsed.data?.messageId) {
        delta_buffers.delete(parsed.data.messageId)
      }
      if (parsed.data?.content) {
        return { output: parsed.data.content }
      }
    } else if (parsed.type === 'session.error' && parsed.data?.message) {
      return { output: parsed.data.message }
    } else if (parsed.type === 'result') {
      last_action_name = ''
      action_count = 0
      if (parsed.result) {
        const text =
          typeof parsed.result === 'string'
            ? parsed.result
            : parsed.result.text || parsed.result.response || ''
        if (text) {
          return { output: text }
        }
      }
    } else if (parsed.type === 'session.idle') {
      last_action_name = ''
      action_count = 0
    }
  },
  parse_final_output: (parsed, current_output) => {
    last_action_name = ''
    action_count = 0

    if (parsed.type === 'assistant.message' && parsed.data?.content) {
      return parsed.data.content
    } else if (
      parsed.type === 'session.error' &&
      parsed.data?.message &&
      !current_output
    ) {
      return parsed.data.message
    } else if (parsed.type === 'result' && parsed.result) {
      const text =
        typeof parsed.result === 'string'
          ? parsed.result
          : parsed.result.text || parsed.result.response || ''
      return text || current_output
    }
    return current_output
  }
}
