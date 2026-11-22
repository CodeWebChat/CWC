export interface GitCheckpointData {
  branch: string
  commit_hash: string
}

export interface CheckpointTab {
  uri: string
  view_column: number
  is_active: boolean
  is_group_active: boolean
}

export type VisibleCheckpointTrigger =
  | 'manual'
  | 'response-accepted'
  | 'before-code-reviewed'
  | 'before-checkpoint-restored'
  | 'commit'

export type HiddenCheckpointTrigger = 'temporary' | 'before-agentic-search'

export type CheckpointTrigger =
  | VisibleCheckpointTrigger
  | HiddenCheckpointTrigger

export interface Checkpoint {
  timestamp: number
  trigger: CheckpointTrigger
  description?: string
  is_pinned?: boolean
  git_data?: Record<string, GitCheckpointData>
  uses_git: boolean
  code_review_item_created_at?: number
  selected_files: string[]
  active_tabs: CheckpointTab[]
}
