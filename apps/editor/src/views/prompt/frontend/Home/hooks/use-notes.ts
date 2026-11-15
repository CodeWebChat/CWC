import { useState, useEffect } from 'react'
import { BackendMessage } from '../../../types/messages'
import { post_message } from '../../utils/post-message'

export const use_notes = (vscode: any) => {
  const [notes, set_notes] = useState<Record<string, string>>({})

  useEffect(() => {
    const handle_message = (event: MessageEvent<BackendMessage>) => {
      const message = event.data
      if (message.command === 'NOTES') {
        set_notes(message.notes)
      }
    }

    window.addEventListener('message', handle_message)
    post_message(vscode, { command: 'GET_NOTES' })

    return () => window.removeEventListener('message', handle_message)
  }, [])

  const handle_note_change = (root: string, note_text: string) => {
    const new_notes = { ...notes, [root]: note_text }
    set_notes(new_notes)
    post_message(vscode, {
      command: 'SAVE_NOTES',
      notes: new_notes
    })
  }

  return {
    notes,
    handle_note_change
  }
}
