import * as vscode from 'vscode'

export const replace_snippet_symbol = async (params: {
  instructions: string[]
}): Promise<{ instructions: string[] }> => {
  const config = vscode.workspace.getConfiguration('codeWebChat')
  const default_ask_instructions = config.inspect<
    { name: string; instruction: string }[]
  >('snippetsForAskAboutFiles')!.defaultValue!
  const ask_instructions =
    config.get<{ name: string; instruction: string }[]>(
      'snippetsForAskAboutFiles'
    ) ?? default_ask_instructions
  const default_edit_instructions = config.inspect<
    { name: string; instruction: string }[]
  >('snippetsForEditFiles')!.defaultValue!
  const edit_instructions =
    config.get<{ name: string; instruction: string }[]>(
      'snippetsForEditFiles'
    ) ?? default_edit_instructions

  const all_snippets = [...ask_instructions, ...edit_instructions]

  const regex = /#Snippet\("((?:\\.|[^"\\])*)"\)/g

  const instructions = params.instructions.map((instruction) => {
    return instruction.replace(regex, (match, name) => {
      const decoded_name = name.replace(/\\"/g, '"').replace(/\\\\/g, '\\')
      const found = all_snippets.find((i) => i.name === decoded_name)
      return found ? found.instruction : match
    })
  })

  return { instructions }
}
