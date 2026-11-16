import * as vscode from 'vscode'
import { ai_file_search_format_instructions } from '@/constants/instructions'

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

  let prompt = `# Task\n\n${task_instructions}\n\n# Output formatting\n\n${ai_file_search_format_instructions}`

  prompt += `\n\n# Query\n\n${query}`

  if (completed_tasks && completed_tasks.length > 0) {
    const tasks_str = completed_tasks.map((t) => `- [x] ${t}`).join('\n')
    prompt += `\n\n## Past instructions\n\n${tasks_str}`
  }

  if (search_instructions && search_instructions.trim() !== '') {
    prompt += `\n\n## Search instructions\n\n${search_instructions.trim()}`
  }

  return prompt
}
