import styles from './PromptInstructions.module.scss'
import cn from '@shared/utils/classnames'
import { IconButton } from '../../common/IconButton'
import { SortableList } from '../SortableList'

export namespace PromptInstructions {
  export type Item = {
    name?: string
    value: string
  }

  export type Props = {
    items: {
      key: string
      label: string
      icon?: string
      accent_color?: 'blue' | 'purple'
      items: Item[]
    }[]
    on_reorder: (key: string, items: Item[]) => void
    on_delete: (key: string, index: number) => void
    on_edit: (key: string, index: number) => void
    on_add: (
      key: string,
      params?: { insertion_index?: number; exact_insertion?: boolean }
    ) => void
    translations: {
      item_text: string
      items_text: string
      items_text_many: string
      add_new: string
    }
  }
}

export const PromptInstructions: React.FC<PromptInstructions.Props> = (
  props
) => {
  return (
    <div className={styles.container}>
      {props.items.map(({ key, label, icon, accent_color, items }) => {
        const sortable_items = items.map((t, index) => ({
          id: `${index}-${t.name}-${t.value}`,
          original_index: index,
          ...t
        }))

        return (
          <div
            key={key}
            className={cn(styles.group, {
              [styles[`group--accent-${accent_color}`]]: !!accent_color
            })}
          >
            <div className={styles.group__header}>
              <div className={styles.group__title}>
                {icon && (
                  <span
                    className={cn(
                      'codicon',
                      `codicon-${icon}`,
                      styles.group__icon
                    )}
                  />
                )}
                <span className={styles.group__label}>{label}</span>
              </div>
            </div>

            <div className={styles.group__content}>
              <SortableList
                items={sortable_items}
                on_reorder={(new_list) => {
                  props.on_reorder(
                    key,
                    new_list.map((i) => ({
                      name: i.name,
                      value: i.value
                    }))
                  )
                }}
                on_add={(params) => props.on_add(key, params)}
                translations={{
                  add_title: props.translations.add_new,
                  item_text: props.translations.item_text,
                  items_text: props.translations.items_text,
                  items_text_many: props.translations.items_text_many
                }}
                render_content={(item) => (
                  <div className={styles['item-text']}>
                    <span>{item.name || 'Unnamed'}</span>
                  </div>
                )}
                render_actions={(item, index) => (
                  <>
                    <IconButton
                      codicon_icon="insert"
                      title="Insert"
                      on_click={(e) => {
                        e.stopPropagation()
                        props.on_add(key, { insertion_index: index })
                      }}
                    />
                    <IconButton
                      codicon_icon="edit"
                      title="Edit"
                      on_click={(e) => {
                        e.stopPropagation()
                        props.on_edit(key, item.original_index)
                      }}
                    />
                    <IconButton
                      codicon_icon="trash"
                      title="Delete"
                      on_click={(e) => {
                        e.stopPropagation()
                        props.on_delete(key, item.original_index)
                      }}
                    />
                  </>
                )}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
