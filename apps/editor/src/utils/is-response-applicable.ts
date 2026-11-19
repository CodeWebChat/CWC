import { parse_response } from '@/features/apply-response/utils/response-parser'
import { get_invalid_file_path } from '@/features/apply-response/utils/file-checks'

export const is_response_applicable = (params: {
  response: string
  is_single_root_folder_workspace?: boolean
  workspace_files?: string[]
}): boolean => {
  if (!params.response) {
    return false
  }

  const response_items = parse_response({
    response: params.response,
    is_single_root_folder_workspace:
      params.is_single_root_folder_workspace ?? true,
    workspace_files: params.workspace_files
  })

  try {
    const invalid_file_path = get_invalid_file_path(response_items)
    if (invalid_file_path) {
      return false
    }
  } catch {
    // Ignore
  }

  return response_items.some(
    (item) =>
      item.type === 'commit-message' ||
      item.type === 'intelligent-file-search-results' ||
      item.type === 'patch-repair' ||
      item.type === 'code-at-cursor' ||
      item.type === 'file' ||
      item.type === 'diff'
  )
}
