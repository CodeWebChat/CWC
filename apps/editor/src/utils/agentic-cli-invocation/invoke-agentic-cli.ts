import * as vscode from 'vscode'
import * as os from 'os'
import * as fs from 'fs'
import * as path from 'path'
import { WorkspaceProvider } from '@/context/providers/workspace/workspace-provider'
import { t } from '@/i18n'
import { spawn } from 'child_process'
import { CLI_AGENTS } from './agents'
import { CodingAgent } from './types'
import { Logger } from '@shared/utils/logger'
import { generate_diff_markdown } from './utils/generate-diff-markdown'
import { format_duration } from './utils/format-duration'
import { ConfigAgentConfigurationFormat } from '@/utils/cli-configuration-format-converters'
import { AGENTS } from '@/constants/agents'
import { WaitingChain } from '@/utils/waiting-chain'

let _output_channel: vscode.OutputChannel | undefined

const get_output_channel = () => {
  if (!_output_channel) {
    _output_channel = vscode.window.createOutputChannel('CWC Agent')
  }
  return _output_channel
}

export const show_agentic_cli_output_channel = () => {
  get_output_channel().show(true)
}

const cli_waiting_chain = new WaitingChain()

type AgentPickItem = vscode.QuickPickItem & {
  cmd: string
  agent_id: string
  flag_value: string
  config_name: string
}

type AgentSelectionResult =
  | 'back'
  | undefined
  | { cmd: string; flag_value: string; config_name: string }

const parse_flags = (flags_string?: string): string[] => {
  const custom_args: string[] = []
  if (!flags_string?.trim()) return custom_args

  let current_arg = ''
  let in_single_quote = false
  let in_double_quote = false

  for (let i = 0; i < flags_string.length; i++) {
    const char = flags_string[i]
    if (char === "'" && !in_double_quote) {
      in_single_quote = !in_single_quote
    } else if (char === '"' && !in_single_quote) {
      in_double_quote = !in_double_quote
    } else if (char === ' ' && !in_single_quote && !in_double_quote) {
      if (current_arg.length > 0) {
        custom_args.push(current_arg)
        current_arg = ''
      }
    } else {
      current_arg += char
    }
  }
  if (current_arg.length > 0) {
    custom_args.push(current_arg)
  }

  return custom_args
}

const build_agent_picks = (): AgentPickItem[] => {
  const agent_picks: AgentPickItem[] = []
  const config = vscode.workspace.getConfiguration('codeWebChat')
  const default_agents =
    config.inspect<ConfigAgentConfigurationFormat[]>('agents')!.defaultValue!
  const current_agents_config =
    config.get<ConfigAgentConfigurationFormat[]>('agents') ?? default_agents

  for (const agent_config of current_agents_config) {
    const agent_info = CLI_AGENTS.find((a) => a.label === agent_config.agent)
    if (!agent_info) continue

    const is_unnamed =
      !agent_config.name || /^\(\d+\)$/.test(agent_config.name.trim())
    const display_name = is_unnamed
      ? agent_config.agent!
      : agent_config.name!.replace(/ \(\d+\)$/, '')

    const details: string[] = []
    if (!is_unnamed && agent_config.agent) {
      details.push(agent_config.agent)
    }

    if (agent_config.flags) {
      details.push(agent_config.flags)
    }

    agent_picks.push({
      label: display_name,
      description: details.join(' · ') || undefined,
      cmd: agent_info.cmd,
      agent_id: agent_info.id,
      flag_value: agent_config.flags || '',
      config_name: agent_config.name!
    })
  }
  return agent_picks
}

const show_agent_quick_pick = async (options: {
  title: string
  active_config_name?: string
  show_back_button?: boolean
  ignore_focus_out?: boolean
  on_hide_result: 'back' | undefined
  abort_signal?: AbortSignal
}): Promise<AgentSelectionResult> => {
  if (options.abort_signal?.aborted) {
    return undefined
  }

  const close_button: vscode.QuickInputButton = {
    iconPath: new vscode.ThemeIcon('close'),
    tooltip: t('common.close')
  }

  const agent_quick_pick = vscode.window.createQuickPick<AgentPickItem>()
  agent_quick_pick.items = build_agent_picks()

  if (options.active_config_name) {
    const active_item = agent_quick_pick.items.find(
      (i) => i.config_name === options.active_config_name
    )
    if (active_item) {
      agent_quick_pick.activeItems = [active_item]
    }
  }

  agent_quick_pick.title = options.title
  agent_quick_pick.placeholder = t(
    'utils.agentic-cli-invocation.agent.agents-placeholder'
  )
  agent_quick_pick.buttons = options.show_back_button
    ? [vscode.QuickInputButtons.Back, close_button]
    : [close_button]
  agent_quick_pick.ignoreFocusOut = !!options.ignore_focus_out

  const config_listener = vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration('codeWebChat.agents')) {
      const prev_active = agent_quick_pick.activeItems[0]
      agent_quick_pick.items = build_agent_picks()

      if (prev_active) {
        const item = agent_quick_pick.items.find(
          (i) =>
            i.label === prev_active.label &&
            i.description === prev_active.description
        )
        if (item) {
          agent_quick_pick.activeItems = [item]
        }
      }
    }
  })

  return await new Promise<AgentSelectionResult>((resolve) => {
    let is_resolved = false

    const abort_handler = () => {
      if (!is_resolved) {
        is_resolved = true
        resolve(undefined)
        agent_quick_pick.hide()
      }
    }

    if (options.abort_signal) {
      options.abort_signal.addEventListener('abort', abort_handler)
    }

    agent_quick_pick.onDidTriggerButton((button) => {
      if (button === vscode.QuickInputButtons.Back) {
        is_resolved = true
        resolve('back')
        agent_quick_pick.hide()
      } else if (button === close_button) {
        is_resolved = true
        resolve(undefined)
        agent_quick_pick.hide()
      }
    })

    agent_quick_pick.onDidAccept(() => {
      const selected = agent_quick_pick.selectedItems[0]
      if (selected) {
        is_resolved = true
        resolve({
          cmd: selected.cmd,
          flag_value: selected.flag_value,
          config_name: selected.config_name
        })
        agent_quick_pick.hide()
      }
    })

    agent_quick_pick.onDidHide(() => {
      if (!is_resolved) {
        resolve(options.on_hide_result)
      }
      if (options.abort_signal) {
        options.abort_signal.removeEventListener('abort', abort_handler)
      }
      config_listener.dispose()
      agent_quick_pick.dispose()
    })

    agent_quick_pick.show()
  })
}

const ensure_agent_installed = async (
  agent_info: CodingAgent
): Promise<boolean> => {
  if (agent_info.is_installed()) {
    return true
  }

  const response = await vscode.window.showWarningMessage(
    t('utils.agentic-cli-invocation.error.not-installed', {
      agent: agent_info.label
    }),
    t('utils.agentic-cli-invocation.error.installation-instructions')
  )

  if (
    response ==
    t('utils.agentic-cli-invocation.error.installation-instructions')
  ) {
    const agent_label = agent_info.label as keyof typeof AGENTS
    const url = AGENTS[agent_label]?.homepage_url
    if (url) {
      vscode.env.openExternal(vscode.Uri.parse(url))
    }
  }

  return false
}

export const invoke_agentic_cli = async (params: {
  workspace_provider: WorkspaceProvider
  extension_context: vscode.ExtensionContext
  build_prompt: (
    selected_root: string,
    temp_dir_path?: string
  ) => Promise<string | 'back' | undefined>
  notification_title: string
  last_selected_workspace_state_key: string
  agent_state_key?: string
  on_agent_selected?: (name: string) => void
  show_back_button?: boolean
  isolate_in_temp_dir?: boolean
  copy_selected_files?: boolean
  generate_diff_for_temp_dir?: boolean
  execution_mode: 'headless' | 'interactive-terminal'
  cli_prompt_type?: 'edit' | 'ask'
  cli_configuration_name?: string
  use_quick_pick?: boolean
  default_agent_key?: keyof ConfigAgentConfigurationFormat
  invocation_count?: number
  allow_adding_invocations?: boolean
  target_folder?: string
  raw_instructions?: string
  abort_signal?: AbortSignal
}): Promise<
  | {
      agent_output: string
      selected_root: string
      cli_configuration_details?: { agent: string; flags?: string }
    }
  | undefined
  | 'back'
> => {
  const roots = params.workspace_provider.get_workspace_roots()

  if (roots.length === 0) {
    return undefined
  }

  const output_channel = get_output_channel()
  let go_back_to_caller = false

  let current_agent_config_name = params.cli_configuration_name
  let show_quick_pick = params.use_quick_pick
  const execution_mode = params.execution_mode

  while (true) {
    const config = vscode.workspace.getConfiguration('codeWebChat')
    const default_agents =
      config.inspect<ConfigAgentConfigurationFormat[]>('agents')!.defaultValue!
    const agents_config =
      config.get<ConfigAgentConfigurationFormat[]>('agents') ?? default_agents

    if (agents_config.length === 0) {
      vscode.window.showInformationMessage(
        t('utils.agentic-cli-invocation.info.no-agents')
      )
      return undefined
    }

    if (
      current_agent_config_name === undefined &&
      show_quick_pick === undefined &&
      params.default_agent_key
    ) {
      const default_agent = agents_config.find(
        (c) => c[params.default_agent_key!]
      )
      if (default_agent) {
        current_agent_config_name = default_agent.name
        show_quick_pick = false
      } else {
        show_quick_pick = true
      }
    }

    const close_button = {
      iconPath: new vscode.ThemeIcon('close'),
      tooltip: t('common.close')
    }

    let selected_agent_cmd: string | undefined
    let flags_string: string | undefined
    let selected_config_name: string | undefined

    if (current_agent_config_name !== undefined) {
      const config_item = agents_config.find(
        (c) => c.name === current_agent_config_name
      )
      if (config_item) {
        const agent_info = CLI_AGENTS.find((a) => a.label === config_item.agent)
        if (agent_info) {
          selected_agent_cmd = agent_info.cmd
          flags_string = config_item.flags || ''
          selected_config_name = config_item.name
        }
      }
    } else if (!show_quick_pick) {
      const last_used = params.agent_state_key
        ? (params.extension_context.workspaceState.get<string>(
            params.agent_state_key
          ) ??
          params.extension_context.globalState.get<string>(
            params.agent_state_key
          ))
        : undefined

      if (last_used) {
        const config_item = agents_config.find((c) => c.name === last_used)
        if (config_item) {
          const agent_info = CLI_AGENTS.find(
            (a) => a.label === config_item.agent
          )
          if (agent_info) {
            selected_agent_cmd = agent_info.cmd
            flags_string = config_item.flags || ''
            selected_config_name = config_item.name
          }
        }
      }

      if (!selected_agent_cmd && agents_config.length === 1) {
        const config_item = agents_config[0]
        const agent_info = CLI_AGENTS.find((a) => a.label === config_item.agent)
        if (agent_info) {
          selected_agent_cmd = agent_info.cmd
          flags_string = config_item.flags || ''
          selected_config_name = config_item.name
        }
      }
    }

    if (!selected_agent_cmd || show_quick_pick) {
      const last_used = params.agent_state_key
        ? (params.extension_context.workspaceState.get<string>(
            params.agent_state_key
          ) ??
          params.extension_context.globalState.get<string>(
            params.agent_state_key
          ))
        : undefined

      const agent_selection_result = await show_agent_quick_pick({
        title: t('utils.agentic-cli-invocation.agent.agents'),
        active_config_name: last_used,
        show_back_button: params.show_back_button,
        ignore_focus_out: !!params.show_back_button,
        on_hide_result: 'back',
        abort_signal: params.abort_signal
      })

      if (agent_selection_result === 'back') {
        return 'back'
      }

      if (!agent_selection_result) {
        return undefined
      }

      selected_agent_cmd = agent_selection_result.cmd
      flags_string = agent_selection_result.flag_value
      selected_config_name = agent_selection_result.config_name
    }

    const selected_agent_info = CLI_AGENTS.find(
      (a) => a.cmd === selected_agent_cmd
    )

    if (
      selected_agent_info &&
      !(await ensure_agent_installed(selected_agent_info))
    ) {
      show_quick_pick = true
      current_agent_config_name = undefined
      continue
    }

    if (selected_config_name) {
      if (params.agent_state_key) {
        params.extension_context.workspaceState.update(
          params.agent_state_key,
          selected_config_name
        )
        params.extension_context.globalState.update(
          params.agent_state_key,
          selected_config_name
        )
      }

      if (params.on_agent_selected) {
        params.on_agent_selected(selected_config_name)
      }
    }

    let go_back_to_agent = false

    while (true) {
      let selected_root: string | undefined
      let temp_dir_path: string | undefined
      const file_mappings = new Map<
        string,
        { original: string; dest_rel: string }
      >()

      if (params.isolate_in_temp_dir) {
        const base_prefix = `cwc-cli-${params.cli_prompt_type}`
        let i = 1
        while (true) {
          temp_dir_path = path.join(os.tmpdir(), `${base_prefix}-${i}`)
          try {
            await fs.promises.mkdir(temp_dir_path)
            break
          } catch (err: any) {
            if (err.code === 'EEXIST') {
              i++
            } else {
              throw err
            }
          }
        }

        const files_array: string[] = []

        if (params.copy_selected_files) {
          const selected_files = params.workspace_provider.get_selected_files()

          for (const file_path of selected_files) {
            const root =
              params.workspace_provider.get_workspace_root_for_file(file_path)
            if (!root) continue
            const rel = path.relative(root, file_path)
            const dest_rel =
              roots.length > 1
                ? path.join(
                    params.workspace_provider.get_workspace_name(root),
                    rel
                  )
                : rel
            const dest_path = path.join(temp_dir_path, dest_rel)

            await fs.promises.mkdir(path.dirname(dest_path), {
              recursive: true
            })
            await fs.promises.copyFile(file_path, dest_path)

            const original_backup_path = path.join(
              temp_dir_path,
              '.cwc',
              'originals',
              dest_rel
            )
            await fs.promises.mkdir(path.dirname(original_backup_path), {
              recursive: true
            })
            await fs.promises.copyFile(file_path, original_backup_path)

            const unix_dest_rel = dest_rel.replace(/\\/g, '/')

            file_mappings.set(dest_path, {
              original: original_backup_path,
              dest_rel: unix_dest_rel
            })

            files_array.push(unix_dest_rel)
          }
        }

        try {
          const metadata_dir = path.join(temp_dir_path, '.cwc')
          await fs.promises.mkdir(metadata_dir, { recursive: true })
          await fs.promises.writeFile(
            path.join(metadata_dir, 'metadata.json'),
            JSON.stringify({
              agent: selected_agent_info?.label,
              flags: flags_string,
              files: files_array,
              instructions: params.raw_instructions
            }),
            'utf-8'
          )
        } catch (e) {
          Logger.warn({
            function_name: 'invoke_agentic_cli',
            message: 'Failed to write metadata',
            data: e
          })
        }

        selected_root = temp_dir_path
      } else if (params.target_folder) {
        selected_root = params.target_folder
      } else {
        if (roots.length === 1) {
          selected_root = roots[0]
        } else {
          const picks = roots.map((root) => ({
            label: params.workspace_provider.get_workspace_name(root),
            description: root,
            root
          }))

          const last_selected_root =
            params.extension_context.workspaceState.get<string>(
              params.last_selected_workspace_state_key
            )
          const active_item =
            picks.find((p) => p.root === last_selected_root) || picks[0]

          const quick_pick = vscode.window.createQuickPick<
            vscode.QuickPickItem & { root: string }
          >()
          quick_pick.items = picks
          if (active_item) {
            quick_pick.activeItems = [active_item]
          }
          quick_pick.title = t(
            'utils.agentic-cli-invocation.agent.select-workspace'
          )
          quick_pick.placeholder = t(
            'utils.agentic-cli-invocation.agent.select-workspace-placeholder'
          )
          quick_pick.buttons = [vscode.QuickInputButtons.Back, close_button]
          quick_pick.ignoreFocusOut = true

          const res = await new Promise<string | undefined | 'back'>(
            (resolve) => {
              if (params.abort_signal?.aborted) {
                return resolve(undefined)
              }
              let is_resolved = false

              const quick_pick_abort_handler = () => {
                if (!is_resolved) {
                  is_resolved = true
                  resolve(undefined)
                  quick_pick.hide()
                }
              }

              if (params.abort_signal) {
                params.abort_signal.addEventListener(
                  'abort',
                  quick_pick_abort_handler
                )
              }

              quick_pick.onDidTriggerButton((button) => {
                if (button === vscode.QuickInputButtons.Back) {
                  is_resolved = true
                  resolve('back')
                  quick_pick.hide()
                } else if (button === close_button) {
                  is_resolved = true
                  resolve(undefined)
                  quick_pick.hide()
                }
              })

              quick_pick.onDidAccept(() => {
                const selected = quick_pick.selectedItems[0]
                if (selected) {
                  is_resolved = true
                  resolve(selected.root)
                  quick_pick.hide()
                }
              })

              quick_pick.onDidHide(() => {
                if (!is_resolved) {
                  resolve('back')
                }
                if (params.abort_signal) {
                  params.abort_signal.removeEventListener(
                    'abort',
                    quick_pick_abort_handler
                  )
                }
                quick_pick.dispose()
              })

              quick_pick.show()
            }
          )

          if (res === 'back') {
            go_back_to_agent = true
            show_quick_pick = true
            current_agent_config_name = undefined
            break
          }

          if (!res) {
            return undefined
          }

          selected_root = res
          await params.extension_context.workspaceState.update(
            params.last_selected_workspace_state_key,
            selected_root
          )
        }
      }

      const agent_info = CLI_AGENTS.find((a) => a.cmd === selected_agent_cmd)
      if (!agent_info) break

      const executable = agent_info.cmd
      const custom_args = parse_flags(flags_string)

      const final_prompt = await params.build_prompt(
        selected_root!,
        temp_dir_path
      )

      if (final_prompt === 'back') {
        if (roots.length === 1 || params.isolate_in_temp_dir) {
          go_back_to_agent = true
          show_quick_pick = true
          current_agent_config_name = undefined
          break
        } else {
          continue
        }
      }

      if (final_prompt === undefined) {
        return undefined
      }

      const temp_prompt_dir = await fs.promises.mkdtemp(
        path.join(os.tmpdir(), 'cwc-prompt-')
      )
      const temp_prompt_path = path.join(temp_prompt_dir, 'prompt.md')
      await fs.promises.writeFile(temp_prompt_path, final_prompt, {
        encoding: 'utf-8',
        mode: 0o600
      })

      if (execution_mode === 'interactive-terminal') {
        const prompt_type = params.cli_prompt_type
        const base_args =
          prompt_type === 'edit'
            ? agent_info.get_integrated_terminal_edit_args
              ? agent_info.get_integrated_terminal_edit_args({
                  cwd: selected_root!
                })
              : []
            : agent_info.get_integrated_terminal_ask_args
              ? agent_info.get_integrated_terminal_ask_args({
                  cwd: selected_root!
                })
              : []

        let args = [...base_args, ...custom_args]

        const quote_arg = (arg: string) => {
          if (os.platform() === 'win32') {
            return `"${arg.replace(/"/g, '""')}"`
          } else {
            return `'${arg.replace(/'/g, "'\\''")}'`
          }
        }

        let command: string
        if (agent_info.get_prompt_file_args) {
          args = [...args, ...agent_info.get_prompt_file_args(temp_prompt_path)]
          const command_args = [executable, ...args.map(quote_arg)].join(' ')
          command = command_args
        } else if (agent_info.get_integrated_terminal_prompt_args) {
          const command_args = [executable, ...args.map(quote_arg)].join(' ')
          const prompt_args =
            agent_info.get_integrated_terminal_prompt_args(temp_prompt_path)
          command = `${command_args} ${prompt_args}`
        } else {
          const command_args = [executable, ...args.map(quote_arg)].join(' ')
          if (os.platform() === 'win32') {
            command = `type "${temp_prompt_path}" | ${command_args}`
          } else {
            command = `cat '${temp_prompt_path}' | ${command_args}`
          }
        }

        const terminal = vscode.window.createTerminal({
          name: agent_info.label,
          cwd: selected_root
        })

        const terminal_closed = new Promise<
          vscode.TerminalExitStatus | undefined
        >((resolve) => {
          const disposable = vscode.window.onDidCloseTerminal((t) => {
            if (t === terminal) {
              disposable.dispose()
              resolve(t.exitStatus)
            }
          })
        })

        terminal.show()
        terminal.sendText(command)

        if (agent_info.get_post_integrated_terminal_args) {
          const post_args = agent_info.get_post_integrated_terminal_args()
          const post_command_args = [
            executable,
            ...post_args.map(quote_arg)
          ].join(' ')
          terminal.sendText(post_command_args)
        }

        await terminal_closed

        if (temp_dir_path) {
          try {
            await fs.promises.rm(temp_dir_path, {
              recursive: true,
              force: true
            })
          } catch {
            // Ignore
          }
        }

        try {
          await fs.promises.rm(temp_prompt_dir, {
            recursive: true,
            force: true
          })
        } catch {
          // Ignore
        }

        return undefined
      }

      const initial_invocation_count = params.invocation_count || 1
      let total_invocations = 0
      let active_invocations = 0
      let is_finished = false
      let cancelled_count = 0
      let last_invocation_config_name = selected_config_name
      const agent_outputs: string[] = []

      output_channel.clear()
      const start_time = Date.now()

      try {
        const run_invocation = async (
          index: number,
          invocation_agent: {
            agent_info: CodingAgent
            flags_string: string
            config_name?: string
          }
        ) => {
          const invocation_agent_info = invocation_agent.agent_info
          const invocation_executable = invocation_agent_info.cmd
          const invocation_custom_args = parse_flags(
            invocation_agent.flags_string
          )

          const gate = cli_waiting_chain.enqueue({
            key: invocation_agent.config_name || invocation_executable,
            meta: undefined
          })

          return vscode.window.withProgress(
            {
              location: vscode.ProgressLocation.Notification,
              title: params.notification_title,
              cancellable: true
            },
            async (progress, token) => {
              try {
                if (gate.must_wait) {
                  progress.report({
                    message: t(
                      'service.prompt-view-api-calls-manager.progress.queued'
                    )
                  })

                  try {
                    await gate.wait(token)
                  } catch (e: any) {
                    if (e.message === 'Cancelled') {
                      cancelled_count++
                      return
                    }
                    throw e
                  }
                }

                const waiting_msg = t(
                  'utils.agentic-cli-invocation.agent.waiting-for-agent'
                )

                progress.report({
                  message: waiting_msg
                })

                if (
                  token.isCancellationRequested ||
                  params.abort_signal?.aborted
                ) {
                  cancelled_count++
                  return
                }

                const base_args = invocation_agent_info.get_headless_args({
                  cwd: selected_root!
                })

                let args = [...base_args, ...invocation_custom_args]

                if (invocation_agent_info.get_prompt_file_args) {
                  args = [
                    ...args,
                    ...invocation_agent_info.get_prompt_file_args(
                      temp_prompt_path
                    )
                  ]
                }

                return await new Promise<void>((resolve, reject) => {
                  let current_agent_output = ''
                  let current_raw_stream_output = ''
                  const child = spawn(invocation_executable, args, {
                    cwd: selected_root,
                    shell: false,
                    stdio: invocation_agent_info.get_prompt_file_args
                      ? ['ignore', 'pipe', 'pipe']
                      : ['pipe', 'pipe', 'pipe']
                  })

                  let is_aborted = false
                  const child_abort_handler = () => {
                    if (is_aborted) return
                    is_aborted = true
                    cancelled_count++
                    child.kill()
                  }

                  if (params.abort_signal) {
                    params.abort_signal.addEventListener(
                      'abort',
                      child_abort_handler
                    )
                  }

                  if (
                    !invocation_agent_info.get_prompt_file_args &&
                    child.stdin
                  ) {
                    const read_stream = fs.createReadStream(temp_prompt_path)
                    read_stream.pipe(child.stdin)

                    read_stream.on('error', (err) => {
                      Logger.error({
                        function_name: 'invoke_agentic_cli',
                        message: 'Failed to read temp prompt file',
                        data: err
                      })
                    })
                  }

                  child.stdout?.on('data', (data) => {
                    const chunk = data.toString()
                    output_channel.append(chunk)
                    if (invocation_agent_info.parse_stream_line) {
                      current_raw_stream_output += chunk
                      const lines = current_raw_stream_output.split('\n')
                      current_raw_stream_output = lines.pop() || ''
                      for (const line of lines) {
                        const trimmed = line.trim()
                        if (!trimmed) continue
                        try {
                          const parsed = JSON.parse(trimmed)
                          const result =
                            invocation_agent_info.parse_stream_line(
                              parsed,
                              (msg) => {
                                progress.report({ message: msg })
                                if (msg && msg !== waiting_msg) {
                                  gate.release()
                                }
                              }
                            )

                          if (result?.output !== undefined) {
                            current_agent_output = result.output
                            if (result.output) {
                              gate.release()
                            }
                          }
                        } catch {
                          // Ignore
                        }
                      }
                    } else {
                      current_agent_output += chunk
                    }
                  })

                  child.stderr?.on('data', (data) => {
                    const chunk = data.toString()
                    output_channel.append(chunk)
                  })

                  token.onCancellationRequested(() => {
                    child_abort_handler()
                  })

                  child.on('close', async () => {
                    if (params.abort_signal) {
                      params.abort_signal.removeEventListener(
                        'abort',
                        child_abort_handler
                      )
                    }

                    if (
                      invocation_agent_info.parse_final_output &&
                      current_raw_stream_output.trim()
                    ) {
                      try {
                        const parsed = JSON.parse(
                          current_raw_stream_output.trim()
                        )
                        current_agent_output =
                          invocation_agent_info.parse_final_output(
                            parsed,
                            current_agent_output
                          ) ?? current_agent_output
                      } catch {
                        // Ignore
                      }
                    }

                    if (
                      params.generate_diff_for_temp_dir &&
                      temp_dir_path &&
                      total_invocations === 1
                    ) {
                      try {
                        const diff_markdown = await generate_diff_markdown(
                          temp_dir_path,
                          file_mappings
                        )

                        const trimmed_output = current_agent_output
                          .trim()
                          .replace(/\[([^\]]+)\]\([^)]+\)/g, '`$1`')
                          .replace(/```[\s\S]*?```/g, '')
                          .trim()
                        const trimmed_diff = diff_markdown.trim()

                        if (trimmed_output && trimmed_diff) {
                          current_agent_output =
                            trimmed_output + '\n\n' + trimmed_diff
                        } else {
                          current_agent_output = trimmed_diff || trimmed_output
                        }
                      } catch (e) {
                        Logger.error({
                          function_name: 'invoke_agentic_cli',
                          message: 'Failed to generate diff',
                          data: e
                        })
                      }
                    }

                    agent_outputs[index] = current_agent_output
                    resolve()
                  })

                  child.on('error', (err) => {
                    if (params.abort_signal) {
                      params.abort_signal.removeEventListener(
                        'abort',
                        child_abort_handler
                      )
                    }
                    Logger.error({
                      function_name: 'invoke_agentic_cli',
                      message: 'Agent execution failed',
                      data: err
                    })
                    reject(err)
                  })
                })
              } finally {
                gate.release()
              }
            }
          )
        }

        const tasks: Promise<void>[] = []
        const start_invocation = (invocation_agent: {
          agent_info: CodingAgent
          flags_string: string
          config_name?: string
        }) => {
          const index = total_invocations
          total_invocations++
          active_invocations++
          tasks.push(
            run_invocation(index, invocation_agent).finally(() => {
              active_invocations--
            })
          )
        }

        const pick_agent_for_additional_invocation = async (): Promise<
          | {
              agent_info: CodingAgent
              flags_string: string
              config_name: string
            }
          | undefined
        > => {
          while (!is_finished) {
            if (build_agent_picks().length === 0) {
              vscode.window.showInformationMessage(
                t('utils.agentic-cli-invocation.info.no-agents')
              )
              return undefined
            }

            const selection = await show_agent_quick_pick({
              title: t('utils.agentic-cli-invocation.agent.agents'),
              active_config_name: last_invocation_config_name,
              show_back_button: false,
              ignore_focus_out: false,
              on_hide_result: undefined,
              abort_signal: params.abort_signal
            })

            if (!selection || selection === 'back' || is_finished) {
              return undefined
            }

            const picked_agent_info = CLI_AGENTS.find(
              (a) => a.cmd === selection.cmd
            )
            if (!picked_agent_info) {
              return undefined
            }

            const is_installed = await ensure_agent_installed(picked_agent_info)
            if (!is_installed) {
              continue
            }

            return {
              agent_info: picked_agent_info,
              flags_string: selection.flag_value,
              config_name: selection.config_name
            }
          }

          return undefined
        }

        const show_add_invocation_button = () => {
          const label = t('utils.agentic-cli-invocation.agent.add-invocation')
          vscode.window
            .showInformationMessage(
              t('utils.agentic-cli-invocation.agent.add-invocation-message'),
              label
            )
            .then((selection) => {
              if (selection !== label || is_finished) return
              const selection_task = (async () => {
                const picked = await pick_agent_for_additional_invocation()
                if (is_finished) return
                if (picked) {
                  last_invocation_config_name = picked.config_name
                  start_invocation(picked)
                  show_add_invocation_button()
                } else if (active_invocations > 0) {
                  show_add_invocation_button()
                }
              })()
              tasks.push(selection_task)
            })
        }

        for (let i = 0; i < initial_invocation_count; i++) {
          start_invocation({
            agent_info,
            flags_string: flags_string || '',
            config_name: selected_config_name
          })
        }

        if (params.allow_adding_invocations) {
          show_add_invocation_button()
        }

        let awaited_count = 0
        while (awaited_count < tasks.length) {
          const batch = tasks.slice(awaited_count)
          awaited_count = tasks.length
          await Promise.all(batch)
        }
      } catch (err) {
        vscode.window.showErrorMessage(
          t('utils.agentic-cli-invocation.error.failed', {
            error: String(err)
          })
        )
        go_back_to_caller = true
        break
      } finally {
        is_finished = true
        await fs.promises
          .rm(temp_prompt_dir, { recursive: true, force: true })
          .catch(() => {})
      }

      if (params.abort_signal?.aborted) {
        return undefined
      }

      if (cancelled_count === total_invocations) {
        go_back_to_caller = true
        break
      }

      const agent_output = agent_outputs.filter(Boolean).join('\n\n')

      Logger.info({
        function_name: 'invoke_agentic_cli',
        message: "Agent's response",
        data: agent_output
      })

      vscode.window.showInformationMessage(
        t('utils.agentic-cli-invocation.agent.finished', {
          duration: format_duration(Date.now() - start_time)
        })
      )

      return {
        agent_output,
        selected_root: selected_root!,
        cli_configuration_details: selected_agent_info
          ? {
              agent: selected_agent_info.label,
              flags: flags_string
            }
          : undefined
      }
    }

    if (go_back_to_agent) {
      continue
    }

    if (go_back_to_caller) {
      return 'back'
    }

    break
  }

  return undefined
}
