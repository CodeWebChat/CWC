import * as vscode from 'vscode'

export const get_terminal_cwd = (
  terminal?: vscode.Terminal
): string | undefined => {
  if (!terminal) {
    return undefined
  }

  const creation_options = terminal.creationOptions as
    | vscode.TerminalOptions
    | undefined
  const cwd_from_creation = creation_options?.cwd
  const cwd_from_shell = terminal.shellIntegration?.cwd

  if (cwd_from_shell) {
    return cwd_from_shell.fsPath
  }

  if (cwd_from_creation) {
    return typeof cwd_from_creation === 'string'
      ? cwd_from_creation
      : cwd_from_creation.fsPath
  }

  return undefined
}
