import * as vscode from 'vscode'
import { PromptViewProvider } from '@/views/prompt/backend/prompt-view-provider'
import { DeleteTaskMessage } from '@/views/prompt/types/messages'
import { Task } from '@shared/types/task'
import { TasksStorage } from '@/utils/global-workspace-storage'
import { t } from '@/i18n'

const delete_from_tree = (params: {
  tasks: Task[]
  timestamp: number
}): Task[] => {
  return params.tasks
    .filter((t) => t.created_at !== params.timestamp)
    .map((t) => ({
      ...t,
      children: t.children
        ? delete_from_tree({
            tasks: t.children,
            timestamp: params.timestamp
          })
        : []
    }))
}

const find_in_tree_with_location = (params: {
  tasks: Task[]
  id: number
  parent_id?: number | null
}): { task: Task; parent_id: number | null; index: number } | null => {
  const effective_parent_id =
    params.parent_id !== undefined ? params.parent_id : null
  for (let i = 0; i < params.tasks.length; i++) {
    if (params.tasks[i].created_at === params.id) {
      return {
        task: params.tasks[i],
        parent_id: effective_parent_id,
        index: i
      }
    }
    if (params.tasks[i].children) {
      const result = find_in_tree_with_location({
        tasks: params.tasks[i].children!,
        id: params.id,
        parent_id: params.tasks[i].created_at
      })
      if (result) return result
    }
  }
  return null
}

const insert_in_tree = (params: {
  tasks: Task[]
  task: Task
  parent_id: number | null
  index: number
}): { tasks: Task[]; success: boolean } => {
  if (params.parent_id === null) {
    const new_tasks = [...params.tasks]
    if (params.index >= 0 && params.index <= new_tasks.length) {
      new_tasks.splice(params.index, 0, params.task)
    } else {
      new_tasks.push(params.task)
    }
    return { tasks: new_tasks, success: true }
  }

  let success = false
  const new_tasks = params.tasks.map((t) => {
    if (t.created_at === params.parent_id) {
      success = true
      const new_children = t.children ? [...t.children] : []
      if (params.index >= 0 && params.index <= new_children.length) {
        new_children.splice(params.index, 0, params.task)
      } else {
        new_children.push(params.task)
      }
      return { ...t, children: new_children }
    }
    if (t.children) {
      const result = insert_in_tree({
        tasks: t.children,
        task: params.task,
        parent_id: params.parent_id,
        index: params.index
      })
      if (result.success) {
        success = true
        return { ...t, children: result.tasks }
      }
    }
    return t
  })
  return { tasks: new_tasks, success }
}

export const handle_delete_task = async (
  prompt_view_provider: PromptViewProvider,
  message: DeleteTaskMessage
): Promise<void> => {
  const broadcast_tasks = (all_data: Record<string, Task[]>) => {
    const workspace_roots =
      prompt_view_provider.workspace_provider.get_workspace_roots()
    const tasks: Record<string, Task[]> = {}
    for (const root of workspace_roots) {
      tasks[root] = all_data[root] || []
    }
    prompt_view_provider.send_message({
      command: 'TASKS',
      tasks
    })
  }

  let all_data = TasksStorage.load_all(prompt_view_provider.extension_context)
  const root_tasks = all_data[message.root] || []
  const task_info = find_in_tree_with_location({
    tasks: root_tasks,
    id: message.timestamp
  })

  if (!task_info) {
    return
  }

  const new_root_tasks = delete_from_tree({
    tasks: root_tasks,
    timestamp: message.timestamp
  })
  all_data[message.root] = new_root_tasks
  TasksStorage.save_all(prompt_view_provider.extension_context, all_data)
  broadcast_tasks(all_data)

  const is_empty = (task: Task): boolean => {
    if (task.text.trim().length > 0) return false
    return (task.children || []).every(is_empty)
  }

  if (is_empty(task_info.task)) {
    return
  }

  const selection = await vscode.window.showInformationMessage(
    t('common.success.item-deleted', { item: 'Task' }),
    t('common.undo')
  )

  if (selection === t('common.undo')) {
    all_data = TasksStorage.load_all(prompt_view_provider.extension_context)
    const current_root_tasks = all_data[message.root] || []

    const result = insert_in_tree({
      tasks: current_root_tasks,
      task: task_info.task,
      parent_id: task_info.parent_id,
      index: task_info.index
    })

    if (result.success) {
      all_data[message.root] = result.tasks
    } else {
      all_data[message.root] = [...current_root_tasks, task_info.task]
    }

    TasksStorage.save_all(prompt_view_provider.extension_context, all_data)
    broadcast_tasks(all_data)
  }
}
