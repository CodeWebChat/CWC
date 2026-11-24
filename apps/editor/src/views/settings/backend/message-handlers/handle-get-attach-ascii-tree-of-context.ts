import * as vscode from 'vscode'
import { SettingsViewProvider } from '@/views/settings/backend/settings-view-provider'

export const handle_get_attach_ascii_tree_of_context = async (
  provider: SettingsViewProvider
): Promise<void> => {
  const config = vscode.workspace.getConfiguration('codeWebChat')
  const default_value = config.inspect<'ask' | 'always' | 'never'>(
    'attachAsciiTreeOfContext'
  )!.defaultValue!
  const value =
    config.get<'ask' | 'always' | 'never'>('attachAsciiTreeOfContext') ??
    default_value
  provider.postMessage({
    command: 'ATTACH_ASCII_TREE_OF_CONTEXT',
    value
  })
}
