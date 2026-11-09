import * as vscode from 'vscode'
import { SaveTargetsOrderMessage } from '../../types/messages'

export const handle_save_targets_order = async (
  message: SaveTargetsOrderMessage
) => {
  const config = vscode.workspace.getConfiguration('codeWebChat')
  await config.update(
    'targetsOrder',
    message.targets_order,
    vscode.ConfigurationTarget.Global
  )
}
