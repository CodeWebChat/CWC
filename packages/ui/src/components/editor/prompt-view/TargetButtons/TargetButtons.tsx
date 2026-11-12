import styles from './TargetButtons.module.scss'
import { ReactSortable } from 'react-sortablejs'
import { TargetButton } from '../TargetButton'

export namespace TargetButtons {
  export type Item<T extends string = string> = {
    id: T
    label: string
    description?: string
    on_click: () => void
    hover_color: 'blue' | 'purple'
    keycap_char?: string
  }

  export type Props<T extends string = string> = {
    items: Item<T>[]
    on_reorder: (ids: T[]) => void
  }
}

export const TargetButtons = <T extends string>(
  props: TargetButtons.Props<T>
) => {
  return (
    <ReactSortable<TargetButtons.Item<T>>
      list={props.items}
      setList={(new_items) => {
        const current_ids = props.items.map((item) => item.id)
        const new_ids = new_items.map((item) => item.id)
        const has_order_changed = new_ids.some(
          (id, index) => id !== current_ids[index]
        )
        if (has_order_changed) {
          props.on_reorder(new_ids)
        }
      }}
      className={styles.targets}
      animation={150}
    >
      {props.items.map((item) => (
        <TargetButton
          key={item.id}
          label={item.label}
          description={item.description}
          on_click={item.on_click}
          hover_color={item.hover_color}
          keycap_char={item.keycap_char}
          has_gripper
        />
      ))}
    </ReactSortable>
  )
}
