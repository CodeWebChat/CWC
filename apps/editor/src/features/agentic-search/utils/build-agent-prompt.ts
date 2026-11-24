import * as vscode from 'vscode'
import {
  agentic_search_requirements,
  ai_file_search_format_instructions
} from '@/constants/instructions'

export const build_agent_prompt = (
  query: string,
  completed_tasks?: string[],
  search_instructions?: string
) => {
  const config = vscode.workspace.getConfiguration('codeWebChat')
  const task_instructions =
    config.get<string>('agenticSearchInstructions') ||
    config.inspect<string>('agenticSearchInstructions')?.defaultValue ||
    ''

  let prompt = `# Task\n\n${task_instructions}\n\n# Output formatting\n\n${ai_file_search_format_instructions}\n\n# Requirements\n\n- ${agentic_search_requirements}`

  prompt += `\n\n# Query\n\n${query}`

  if (search_instructions && search_instructions.trim() !== '') {
    prompt += `\n${search_instructions.trim()}`
  }

  if (completed_tasks && completed_tasks.length > 0) {
    const tasks_str = completed_tasks.map((t) => `- [x] ${t}`).join('\n')
    prompt += `\n\n${tasks_str}`
  }

  return prompt
}
