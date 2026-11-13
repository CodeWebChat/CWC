import * as os from 'os'
import { CodingAgent } from '../types'
import { check_command_exists } from '../utils/check-command-exists'
import { get_progress_dots } from '../utils/get-progress-dots'
import { AGENTS } from '../../../constants/agents'

let last_action_name = ''
let action_count = 0

const agent_name = 'Antigravity'

export const antigravity_agent: CodingAgent = {
  id: 'antigravity',
  label: agent_name,
  cmd: 'agy',
  is_installed: () => check_command_exists('agy'),
  get_documentation_url: () => AGENTS[agent_name].docs_url,
  get_headless_args: () => [
    '--output-format',
    'stream-json',
    '--dangerously-skip-permissions'
  ],
  get_integrated_terminal_edit_args: () => [],
  get_integrated_terminal_ask_args: () => [],
  get_integrated_terminal_prompt_args: (temp_prompt_path: string) => {
    if (os.platform() === 'win32') {
      return `"--prompt-interactive" "$(Get-Content -Raw '${temp_prompt_path.replace(/'/g, "''")}')"`
    }
    return `'--prompt-interactive' "$(cat '${temp_prompt_path.replace(/'/g, "'\\''")}')"`
  },
  parse_stream_line: (parsed, report_progress) => {
    if (parsed.event === 'step_update' && parsed.step_update) {
      const step = parsed.step_update
      let action_name = ''

      if (step.step_type === 'tool') {
        if (step.tool_name) {
          action_name = step.tool_name.replace(/_/g, ' ')
        }
      } else if (step.subagent_info?.subagents?.length > 0) {
        const subagent = step.subagent_info.subagents[0]
        action_name = subagent.role || subagent.type_name
      }

      if (action_name) {
        if (action_name === last_action_name) {
          action_count++
        } else {
          last_action_name = action_name
          action_count = 1
        }
        report_progress(`${action_name}${get_progress_dots(action_count)}`)
      }
    } else if (parsed.event === 'result' && parsed.result) {
      last_action_name = ''
      action_count = 0
      return { output: parsed.result.response || '' }
    }
  },
  parse_final_output: (parsed, current_output) => {
    last_action_name = ''
    action_count = 0
    if (parsed.event === 'result' && parsed.result) {
      return parsed.result.response || ''
    } else if (parsed.response) {
      return parsed.response || ''
    }
    return current_output
  }
}
