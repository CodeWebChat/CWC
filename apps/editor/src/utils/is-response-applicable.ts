import { parse_response } from '@/features/apply-response/utils/response-parser'

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
