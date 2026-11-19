import * as fs from 'fs'
import { FileItem } from './response-parser'
import {
  get_workspace_map_and_default,
  resolve_workspace_root
} from './workspace'
import { create_safe_path } from '@/utils/path-sanitizer'

export const check_for_conflict_markers = (files: FileItem[]): boolean => {
  for (const file of files) {
    const content = file.content
    if (
      content.includes('<<<<<<<') &&
      content.includes('=======') &&
      content.includes('>>>>>>>')
    ) {
      return true
    }
  }
  return false
}

export const get_invalid_file_path = (response_items: any[]): string | null => {
  const { workspace_map, default_workspace } = get_workspace_map_and_default()

  for (const item of response_items) {
    if (item.type === 'file') {
      const source_path = item.renamed_from ?? item.file_path
      const source_workspace = item.renamed_from
        ? item.renamed_from_workspace
        : item.workspace_name
      const root = resolve_workspace_root({
        workspace_name: source_workspace,
        workspace_map,
        default_workspace
      })
      const safe_path = create_safe_path(root, source_path)

      if (item.is_deleted || item.renamed_from) {
        if (!safe_path || !fs.existsSync(safe_path)) {
          return source_path
        }
      } else {
        const is_search_replace =
          item.content.includes('<<<<<<<') &&
          item.content.includes('=======') &&
          item.content.includes('>>>>>>>')
        if (is_search_replace) {
          if (!safe_path || !fs.existsSync(safe_path)) {
            return source_path
          }
        }
      }
    } else if (item.type === 'diff') {
      const is_new_file = item.content.includes('--- /dev/null')
      if (!is_new_file) {
        const root = resolve_workspace_root({
          workspace_name: item.workspace_name,
          workspace_map,
          default_workspace
        })
        const safe_path = create_safe_path(root, item.file_path)
        if (!safe_path || !fs.existsSync(safe_path)) {
          return item.file_path
        }
      }
    } else if (item.type === 'patch-repair' || item.type === 'code-at-cursor') {
      const root = resolve_workspace_root({
        workspace_name: item.workspace_name,
        workspace_map,
        default_workspace
      })
      const safe_path = create_safe_path(root, item.file_path)
      if (!safe_path || !fs.existsSync(safe_path)) {
        return item.file_path
      }
    }
  }

  return null
}
