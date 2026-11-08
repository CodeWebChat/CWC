import * as fs from 'fs'
import * as path from 'path'
import * as vscode from 'vscode'
import { normalize_path } from './normalize-path'

export namespace RangesUtils {
  const GLOBAL_RANGES_FILENAME = 'ranges.json'

  export const get_file_path = (params: {
    extension_context: vscode.ExtensionContext
  }) => {
    return path.join(
      params.extension_context.globalStorageUri.fsPath,
      GLOBAL_RANGES_FILENAME
    )
  }

  export const load_all = (
    extension_context: vscode.ExtensionContext
  ): Record<string, Record<string, string>> => {
    const file_path = get_file_path({ extension_context })
    try {
      if (fs.existsSync(file_path)) {
        const content = fs.readFileSync(file_path, 'utf8')
        const raw = JSON.parse(content)
        const normalized: Record<string, Record<string, string>> = {}
        for (const root in raw) {
          normalized[root] = {}
          for (const [rel_path, range] of Object.entries(
            raw[root] as Record<string, string>
          )) {
            normalized[root][normalize_path(rel_path)] = range
          }
        }
        return normalized
      }
    } catch (error) {
      console.error('Error loading global ranges:', error)
    }
    return {}
  }

  export const save_all = (params: {
    extension_context: vscode.ExtensionContext
    ranges: Record<string, Record<string, string>>
  }) => {
    const filtered_ranges: Record<string, Record<string, string>> = {}

    for (const root in params.ranges) {
      const normalized_files: Record<string, string> = {}
      for (const [rel_path, range] of Object.entries(params.ranges[root])) {
        normalized_files[normalize_path(rel_path)] = range
      }
      filtered_ranges[root] = normalized_files
    }

    const file_path = get_file_path({
      extension_context: params.extension_context
    })
    const dir_path = path.dirname(file_path)

    if (!fs.existsSync(dir_path)) {
      fs.mkdirSync(dir_path, { recursive: true })
    }

    try {
      fs.writeFileSync(
        file_path,
        JSON.stringify(filtered_ranges, null, 2),
        'utf8'
      )
    } catch (error) {
      console.error('Failed to save ranges', error)
    }
  }
}
