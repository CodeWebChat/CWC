import React, { useState } from 'react'
import { ReactSortable } from 'react-sortablejs'
import cn from '@shared/utils/classnames'
import styles from './SortableStringList.module.scss'
import { Input } from '../../common/Input'
import { Button } from '../../common/Button'
import { IconButton } from '../../common/IconButton'

export namespace SortableStringList {
  export type Translations = {
    placeholder: string
    add: string
    delete: string
  }

  export type Props = {
    items: string[]
    on_update: (items: string[]) => void
    on_delete?: (item: string, index: number) => void
    translations: Translations
    locked_first_item?: string
  }
}

export const SortableStringList: React.FC<SortableStringList.Props> = (
  props
) => {
  const [new_item, set_new_item] = useState('')

  const trimmed_item = new_item.trim()
  const is_valid =
    trimmed_item.length > 0 &&
    !props.items.includes(trimmed_item) &&
    (!props.locked_first_item ||
      trimmed_item.toLowerCase() !== props.locked_first_item.toLowerCase())

  const handle_add = () => {
    if (!is_valid) return
    props.on_update([...props.items, trimmed_item])
    set_new_item('')
  }

  const handle_delete = (index: number) => {
    if (props.on_delete) {
      props.on_delete(props.items[index], index)
    } else {
      props.on_update(props.items.filter((_, i) => i !== index))
    }
  }

  const seen = new Map<string, number>()
  const sortable_items = props.items.map((value) => {
    const count = seen.get(value) ?? 0
    seen.set(value, count + 1)
    return {
      id: count === 0 ? value : `${value}__${count}`,
      value
    }
  })

  return (
    <div className={styles.container}>
      <div className={styles.row}>
        <Input
          type="text"
          value={new_item}
          on_change={set_new_item}
          on_key_down={(e) => {
            if (e.key === 'Enter') handle_add()
          }}
          placeholder={props.translations.placeholder}
        />
        <Button on_click={handle_add} disabled={!is_valid}>
          {props.translations.add}
        </Button>
      </div>
      {(props.locked_first_item || sortable_items.length > 0) && (
        <div className={styles.list}>
          {props.locked_first_item && (
            <div className={cn(styles.item, styles['item--locked'])}>
              <div
                className={cn(
                  styles['drag-handle'],
                  styles['drag-handle--disabled']
                )}
              >
                <span className="codicon codicon-gripper" />
              </div>
              <span className={styles.value}>{props.locked_first_item}</span>
            </div>
          )}
          {sortable_items.length > 0 && (
            <ReactSortable
              list={sortable_items}
              setList={(new_list) => {
                const has_order_changed =
                  new_list.length !== sortable_items.length ||
                  new_list.some(
                    (item, index) => item.id !== sortable_items[index].id
                  )

                if (has_order_changed) {
                  props.on_update(new_list.map((item) => item.value))
                }
              }}
              tag="div"
              animation={150}
              className={styles.list}
            >
              {sortable_items.map((item, index) => (
                <div key={item.id} className={styles.item}>
                  <div className={styles['drag-handle']}>
                    <span className="codicon codicon-gripper" />
                  </div>
                  <span className={styles.value}>{item.value}</span>
                  <IconButton
                    codicon_icon="close"
                    title={props.translations.delete}
                    on_click={(e) => {
                      e.stopPropagation()
                      handle_delete(index)
                    }}
                  />
                </div>
              ))}
            </ReactSortable>
          )}
        </div>
      )}
    </div>
  )
}
