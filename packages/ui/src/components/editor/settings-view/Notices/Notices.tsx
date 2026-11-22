import styles from './Notices.module.scss'
import React from 'react'
import cn from '@shared/utils/classnames'

type NoticeProps = {
  message: React.ReactNode
  type: 'info' | 'warning'
  slot_right?: React.ReactNode
}

type Props = {
  notices: NoticeProps[]
}

export const Notices: React.FC<Props> = (props) => {
  if (!props.notices || props.notices.length === 0) return null

  const render_message = (message: React.ReactNode): React.ReactNode => {
    if (typeof message === 'string') {
      return message.split('`').map((part, i) =>
        i % 2 === 1 ? (
          <code key={i} className={styles.code}>
            {part}
          </code>
        ) : (
          part
        )
      )
    }

    if (
      React.isValidElement<{ children?: React.ReactNode }>(message) &&
      message.type === React.Fragment
    ) {
      return React.Children.map(message.props.children, render_message)
    }

    return message
  }

  return (
    <div className={styles.wrapper}>
      {props.notices.map((notice, index) => (
        <div
          key={index}
          className={cn(styles.container, {
            [styles['container--info']]: notice.type === 'info',
            [styles['container--warning']]: notice.type === 'warning'
          })}
        >
          <div
            className={cn(styles.left, {
              [styles['left--warning']]: notice.type === 'warning'
            })}
          >
            <span
              className={cn(
                'codicon',
                notice.type === 'info' ? 'codicon-info' : 'codicon-warning'
              )}
            />
            <span>{render_message(notice.message)}</span>
          </div>
          {notice.slot_right && <div>{notice.slot_right}</div>}
        </div>
      ))}
    </div>
  )
}
