import * as vscode from 'vscode'
import { SettingsViewProvider } from '@/views/settings/backend/settings-view-provider'

export const handle_get_prompt_instructions = async (
  provider: SettingsViewProvider
): Promise<void> => {
  const config = vscode.workspace.getConfiguration('codeWebChat')

  const map_templates = (items: any[]) =>
    items.map((i) => ({ name: i.name, value: i.template }))
  const map_instructions = (items: any[]) =>
    items.map((i) => ({ name: i.name, value: i.instruction }))

  provider.postMessage({
    command: 'PROMPT_INSTRUCTIONS',
    prompt_instructions: {
      templatesForEditFiles: map_templates(
        config.get<any[]>('templatesForEditFiles') ??
          config.inspect<any[]>('templatesForEditFiles')!.defaultValue!
      ),
      templatesForAskAboutFiles: map_templates(
        config.get<any[]>('templatesForAskAboutFiles') ??
          config.inspect<any[]>('templatesForAskAboutFiles')!.defaultValue!
      ),
      snippetsForEditFiles: map_instructions(
        config.get<any[]>('snippetsForEditFiles') ??
          config.inspect<any[]>('snippetsForEditFiles')!.defaultValue!
      ),
      snippetsForAskAboutFiles: map_instructions(
        config.get<any[]>('snippetsForAskAboutFiles') ??
          config.inspect<any[]>('snippetsForAskAboutFiles')!.defaultValue!
      )
    }
  })
}
