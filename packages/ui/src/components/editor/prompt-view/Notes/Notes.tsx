import React from 'react'
import cn from 'classnames'
import styles from './Notes.module.scss'
import {
  get_caret_position_from_div,
  set_caret_position_for_div
} from '../../common/prompts/shared/symbols'

type Props = {
  value: string
  placeholder?: string
  on_change: (value: string) => void
}

export const Notes: React.FC<Props> = (props) => {
  const internal_ref = React.useRef<HTMLDivElement | null>(null)
  const [undo_stack, set_undo_stack] = React.useState<
    { value: string; caret_pos: number }[]
  >([])
  const [redo_stack, set_redo_stack] = React.useState<
    { value: string; caret_pos: number }[]
  >([])
  const caret_pos_ref = React.useRef(0)

  React.useEffect(() => {
    const on_selection_change = () => {
      if (
        document.activeElement === internal_ref.current &&
        internal_ref.current
      ) {
        caret_pos_ref.current = get_caret_position_from_div(
          internal_ref.current
        )
      }
    }
    document.addEventListener('selectionchange', on_selection_change)
    return () =>
      document.removeEventListener('selectionchange', on_selection_change)
  }, [])

  React.useEffect(() => {
    if (!internal_ref.current) return

    const current_inner_text = internal_ref.current.innerText || ''
    if (
      current_inner_text !== props.value &&
      !(current_inner_text === '\n' && !props.value)
    ) {
      internal_ref.current.innerText = props.value || ''
    }
  }, [props.value])

  const update_value = (new_value: string) => {
    if (new_value === props.value) return
    set_undo_stack((prev) => [
      ...prev,
      { value: props.value || '', caret_pos: caret_pos_ref.current }
    ])
    set_redo_stack([])
    props.on_change(new_value)
  }

  const handle_input = (e: React.FormEvent<HTMLDivElement>) => {
    let new_value = e.currentTarget.innerText || ''
    if (new_value === '\n') {
      new_value = ''
    }
    update_value(new_value)
  }

  const handle_key_down = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (
      (e.ctrlKey || e.metaKey) &&
      !e.shiftKey &&
      e.key.toLowerCase() === 'z'
    ) {
      e.preventDefault()
      if (undo_stack.length > 0) {
        const prev_entry = undo_stack[undo_stack.length - 1]
        set_undo_stack((prev) => prev.slice(0, -1))
        set_redo_stack((prev) => [
          ...prev,
          { value: props.value || '', caret_pos: caret_pos_ref.current }
        ])
        props.on_change(prev_entry.value)
        setTimeout(() => {
          if (internal_ref.current) {
            set_caret_position_for_div(
              internal_ref.current,
              prev_entry.caret_pos
            )
          }
        }, 0)
      }
      return
    }

    if (
      ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') ||
      ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z')
    ) {
      e.preventDefault()
      if (redo_stack.length > 0) {
        const next_entry = redo_stack[redo_stack.length - 1]
        set_redo_stack((prev) => prev.slice(0, -1))
        set_undo_stack((prev) => [
          ...prev,
          { value: props.value || '', caret_pos: caret_pos_ref.current }
        ])
        props.on_change(next_entry.value)
        setTimeout(() => {
          if (internal_ref.current) {
            set_caret_position_for_div(
              internal_ref.current,
              next_entry.caret_pos
            )
          }
        }, 0)
      }
      return
    }

    if (e.key === 'Escape' && !e.shiftKey) {
      e.preventDefault()
      e.currentTarget.blur()
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (!document.execCommand('insertText', false, '\n')) {
        const selection = window.getSelection()
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0)
          range.deleteContents()
          const text_node = document.createTextNode('\n')
          range.insertNode(text_node)
          range.collapse(false)
          selection.removeAllRanges()
          selection.addRange(range)
          let new_value = e.currentTarget.innerText || ''
          if (new_value === '\n') new_value = ''
          update_value(new_value)
        }
      }
    }
  }

  const handle_paste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text/plain')
    if (!document.execCommand('insertText', false, text)) {
      const selection = window.getSelection()
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0)
        range.deleteContents()
        const text_node = document.createTextNode(text)
        range.insertNode(text_node)
        range.collapse(false)
        selection.removeAllRanges()
        selection.addRange(range)
        let new_value = e.currentTarget.innerText || ''
        if (new_value === '\n') new_value = ''
        update_value(new_value)
      }
    }
  }

  return (
    <div
      className={styles.wrapper}
      onClick={() => internal_ref.current?.focus()}
    >
      <div
        ref={internal_ref}
        contentEditable={true}
        suppressContentEditableWarning={true}
        className={cn(styles.textarea, {
          [styles['textarea--empty']]: !props.value
        })}
        onInput={handle_input}
        onKeyDown={handle_key_down}
        onPaste={handle_paste}
        data-placeholder={props.placeholder}
        role="textbox"
        aria-multiline="true"
      />
    </div>
  )
}
