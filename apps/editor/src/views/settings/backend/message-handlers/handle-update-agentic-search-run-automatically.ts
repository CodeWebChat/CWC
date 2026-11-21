import * as vscode from 'vscode'
import { UpdateAgenticSearchRunAutomaticallyMessage } from '@/views/settings/types/messages'

export const handle_update_agentic_search_run_automatically = async (
  message: UpdateAgenticSearchRunAutomaticallyMessage
): Promise<void> => {
  const config = vscode.workspace.getConfiguration('codeWebChat')
  await config.update(
    'agenticSearchRunAutomatically',
    message.enabled,
    vscode.ConfigurationTarget.Global
  )
}
