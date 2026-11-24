import * as vscode from 'vscode'

export const toggle_pinned = async (params: {
  cli_configuration_name: string
}): Promise<void> => {
  const config = vscode.workspace.getConfiguration('codeWebChat')
  const default_configs = config.inspect<any[]>('agents')!.defaultValue!
  const current_configs = config.get<any[]>('agents') ?? default_configs

  const updated_configs = current_configs.map((c) => {
    if (c.name === params.cli_configuration_name) {
      return { ...c, isPinned: !c.isPinned }
    }
    return c
  })

  await config.update(
    'agents',
    updated_configs,
    vscode.ConfigurationTarget.Global
  )
}
