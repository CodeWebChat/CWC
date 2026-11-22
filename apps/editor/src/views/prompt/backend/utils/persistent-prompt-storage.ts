import * as fs from 'fs'
import * as path from 'path'
import * as vscode from 'vscode'
import * as crypto from 'crypto'
import {
  PROMPT_UPLOADS_LIFESPAN,
  PROMPT_HISTORY_ENTRIES_LIMIT
} from '@/constants/values'
import {
  HISTORY_ASK_ABOUT_FILES_STATE_KEY,
  HISTORY_EDIT_FILES_STATE_KEY,
  HistoryEntry
} from '@/constants/state-keys'

export class PersistentPromptStorage<T extends 'text' | 'image'> {
  private dir_path: string
  private extension: string

  constructor(
    extension_context: vscode.ExtensionContext,
    private type: T
  ) {
    this.dir_path = path.join(
      extension_context.globalStorageUri.fsPath,
      type === 'text' ? 'prompt-text' : 'prompt-images'
    )
    this.extension = type === 'text' ? '.txt' : '.png'
  }

  async save(content: string): Promise<string> {
    const is_text = this.type === 'text'
    const buffer = is_text ? null : Buffer.from(content, 'base64')

    const id = crypto.randomBytes(8).toString('hex')

    if (!fs.existsSync(this.dir_path)) {
      await fs.promises.mkdir(this.dir_path, { recursive: true })
    }
    const filename = `${id}${this.extension}`
    const file_path = path.join(this.dir_path, filename)

    if (is_text) {
      await fs.promises.writeFile(file_path, content, 'utf-8')
    } else {
      await fs.promises.writeFile(file_path, new Uint8Array(buffer!))
    }

    return id
  }

  async load(id: string): Promise<T extends 'text' ? string : Buffer> {
    const file_path = this.get_file_path(id)
    if (this.type === 'text') {
      return (await fs.promises.readFile(file_path, 'utf-8')) as any
    } else {
      return (await fs.promises.readFile(file_path)) as any
    }
  }

  get_file_path(id: string): string {
    if (!/^[a-fA-F0-9]{16,64}$/.test(id)) {
      throw new Error('Invalid storage ID')
    }
    const filename = `${id}${this.extension}`
    return path.join(this.dir_path, filename)
  }

  async delete(id: string): Promise<void> {
    try {
      const file_path = this.get_file_path(id)
      if (fs.existsSync(file_path)) {
        await fs.promises.unlink(file_path)
      }
    } catch {
      // Ignore
    }
  }

  static async cleanup(extension_context: vscode.ExtensionContext) {
    const text_storage = new PersistentPromptStorage(extension_context, 'text')
    const image_storage = new PersistentPromptStorage(
      extension_context,
      'image'
    )

    await Promise.all([
      text_storage.garbage_collect(),
      image_storage.garbage_collect(),
      PersistentPromptStorage.cleanup_history(
        extension_context,
        text_storage,
        image_storage
      )
    ])
  }

  private static async cleanup_history(
    extension_context: vscode.ExtensionContext,
    text_storage: PersistentPromptStorage<'text'>,
    image_storage: PersistentPromptStorage<'image'>
  ) {
    const ask_history = extension_context.workspaceState.get<HistoryEntry[]>(
      HISTORY_ASK_ABOUT_FILES_STATE_KEY,
      []
    )
    const edit_history = extension_context.workspaceState.get<HistoryEntry[]>(
      HISTORY_EDIT_FILES_STATE_KEY,
      []
    )

    const process_history = async (history: HistoryEntry[], key: string) => {
      if (!Array.isArray(history)) return { kept: [], removed: [] }

      if (history.length <= PROMPT_HISTORY_ENTRIES_LIMIT) {
        return { kept: history, removed: [] }
      }

      const kept = history.slice(0, PROMPT_HISTORY_ENTRIES_LIMIT)
      const removed = history.slice(PROMPT_HISTORY_ENTRIES_LIMIT)

      await extension_context.workspaceState.update(key, kept)

      return { kept, removed }
    }

    const { kept: kept_ask, removed: removed_ask } = await process_history(
      ask_history,
      HISTORY_ASK_ABOUT_FILES_STATE_KEY
    )
    const { kept: kept_edit, removed: removed_edit } = await process_history(
      edit_history,
      HISTORY_EDIT_FILES_STATE_KEY
    )

    const all_kept = [...kept_ask, ...kept_edit]
      .map((h: any) => (typeof h === 'string' ? h : h?.text))
      .filter(Boolean) as string[]
    const all_removed = [...removed_ask, ...removed_edit]
      .map((h: any) => (typeof h === 'string' ? h : h?.text))
      .filter(Boolean) as string[]

    const extract_hashes = (texts: string[]) => {
      const image_hashes = new Set<string>()
      const text_hashes = new Set<string>()

      for (const text of texts) {
        if (!text) continue

        for (const match of text.matchAll(/#Image\(([a-fA-F0-9]+)\)/g)) {
          image_hashes.add(match[1])
        }

        for (const match of text.matchAll(
          /#PastedText\(([a-fA-F0-9]+)(?::\d+)?\)/g
        )) {
          text_hashes.add(match[1])
        }

        for (const match of text.matchAll(
          /#Website\([^ ]+ ([a-fA-F0-9]+)(?::\d+)?(?: "((?:\\.|[^"\\])*)")?\)/g
        )) {
          text_hashes.add(match[1])
        }
      }

      return { image_hashes, text_hashes }
    }

    const kept_hashes = extract_hashes(all_kept)
    const removed_hashes = extract_hashes(all_removed)

    for (const hash of removed_hashes.image_hashes) {
      if (!kept_hashes.image_hashes.has(hash)) {
        await image_storage.delete(hash)
      }
    }

    for (const hash of removed_hashes.text_hashes) {
      if (!kept_hashes.text_hashes.has(hash)) {
        await text_storage.delete(hash)
      }
    }
  }

  private async garbage_collect() {
    try {
      if (!fs.existsSync(this.dir_path)) {
        return
      }
      const files = await fs.promises.readdir(this.dir_path)
      const threshold_time = Date.now() - PROMPT_UPLOADS_LIFESPAN
      for (const file of files) {
        if (file.endsWith(this.extension)) {
          const file_path = path.join(this.dir_path, file)
          try {
            const stats = await fs.promises.stat(file_path)
            if (stats.mtimeMs < threshold_time) {
              await fs.promises.unlink(file_path)
            }
          } catch {
            // Ignore
          }
        }
      }
    } catch (gc_error) {
      console.error(
        `Failed to garbage collect files in ${this.dir_path}:`,
        gc_error
      )
    }
  }
}
