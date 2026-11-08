import * as vscode from 'vscode'
import * as fs from 'fs'
import * as path from 'path'
import { Logger } from '@shared/utils/logger'
import { get_error_message } from '@/utils/get-error-message'
import { RangesStorage } from '@/utils/global-workspace-storage'
import { normalize_path } from '@/utils/normalize-path'
import { RANGES_STATE_KEY } from '@/constants/state-keys'

const MIGRATION_ID = 'ranges-to-global-storage-migration-20261108'

export async function migrate_ranges_to_global_storage(
  extension_context: vscode.ExtensionContext
): Promise<void> {
  try {
    if (extension_context.workspaceState.get(MIGRATION_ID)) {
      return
    }

    const state_ranges =
      extension_context.workspaceState.get<Record<string, string>>(
        RANGES_STATE_KEY
      )

    if (state_ranges && Object.keys(state_ranges).length > 0) {
      const all_global_ranges = RangesStorage.load_all(extension_context)

      const workspace_folders = vscode.workspace.workspaceFolders || []
      const workspace_roots = workspace_folders.map((f) => f.uri.fsPath)
      const workspace_names = workspace_folders.map((f) => f.name)

      const resolve_state_path = (
        key: string
      ): { root: string; rel: string } | undefined => {
        if (workspace_roots.length === 1) {
          return { root: workspace_roots[0], rel: key }
        }

        const parts = key.split(':')
        if (parts.length > 1) {
          const name = parts[0]
          const rel_path = parts.slice(1).join(':')
          const index = workspace_names.indexOf(name)
          if (index !== -1) {
            return { root: workspace_roots[index], rel: rel_path }
          }
        }

        for (const root of workspace_roots) {
          const abs = path.join(root, key)
          if (fs.existsSync(abs)) {
            return { root, rel: key }
          }
        }

        return undefined
      }

      for (const [key, range] of Object.entries(state_ranges)) {
        const resolved = resolve_state_path(key)
        if (resolved) {
          if (!all_global_ranges[resolved.root]) {
            all_global_ranges[resolved.root] = {}
          }
          all_global_ranges[resolved.root][normalize_path(resolved.rel)] = range
        }
      }

      RangesStorage.save_all(extension_context, all_global_ranges)
    }

    await extension_context.workspaceState.update(MIGRATION_ID, true)
    await extension_context.workspaceState.update(RANGES_STATE_KEY, undefined)

    Logger.info({
      function_name: 'migrate_ranges_to_global_storage',
      message: 'Successfully migrated ranges to global storage'
    })
  } catch (error) {
    Logger.error({
      function_name: 'migrate_ranges_to_global_storage',
      message: 'Error migrating ranges to global storage',
      data: get_error_message(error)
    })
  }
}
