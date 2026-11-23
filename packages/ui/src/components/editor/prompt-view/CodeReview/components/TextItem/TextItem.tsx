import { FC, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import styles from './TextItem.module.scss'
import { IconButton } from '../../../../common/IconButton'

const remark_strong_asterisks = () => {
  const transform = (node: any) => {
    if (!node.children || !Array.isArray(node.children)) return

    const new_children: any[] = []
    for (const child of node.children) {
      if (child.type === 'text' && child.value.includes('**')) {
        const regex = /\*\*([\s\S]+?)\*\*/g
        let last_index = 0
        let match: RegExpExecArray | null

        while ((match = regex.exec(child.value)) !== null) {
          if (match.index > last_index) {
            new_children.push({
              type: 'text',
              value: child.value.slice(last_index, match.index)
            })
          }

          const inner = match[1].trim()
          if (inner) {
            new_children.push({
              type: 'strong',
              children: [{ type: 'text', value: inner }]
            })
          } else {
            new_children.push({
              type: 'text',
              value: match[0]
            })
          }

          last_index = regex.lastIndex
        }

        if (last_index < child.value.length) {
          new_children.push({
            type: 'text',
            value: child.value.slice(last_index)
          })
        }
      } else {
        if (child.type !== 'code' && child.type !== 'inlineCode') {
          transform(child)
        }
        new_children.push(child)
      }
    }

    node.children = new_children
  }

  return transform
}

type Props = {
  content: string
  is_expanded: boolean
  on_toggle: (element: HTMLDivElement) => void
}

export const TextItem: FC<Props> = (props) => {
  const header_ref = useRef<HTMLDivElement>(null)

  return (
    <div className={styles.container}>
      <div
        ref={header_ref}
        className={styles.header}
        onClick={() => props.on_toggle(header_ref.current!)}
      >
        <IconButton
          codicon_icon={props.is_expanded ? 'chevron-down' : 'chevron-right'}
        />
        <div className={styles.header__line} />
      </div>
      {props.is_expanded && (
        <div className={styles.text}>
          <ReactMarkdown remarkPlugins={[remark_strong_asterisks]}>
            {props.content}
          </ReactMarkdown>
          <div
            className={styles.text__collapse}
            onClick={() => {
              props.on_toggle(header_ref.current!)
            }}
          >
            <span>Show less</span>
          </div>
        </div>
      )}
    </div>
  )
}
