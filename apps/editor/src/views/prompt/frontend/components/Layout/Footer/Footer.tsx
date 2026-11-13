import { useContext, useEffect, useRef, useState } from 'react'
import styles from './Footer.module.scss'
import { use_compacting } from '@shared/hooks'
import { LayoutContext } from '../../../contexts/LayoutContext'
import { use_translation } from '../../../i18n/use-translation'
import cn from 'classnames'
import { CompactableActionButton } from '@ui/components/editor/prompt-view/CompactableActionButton'
import { Icon as UiIcon } from '@ui/components/editor/common/Icon'

const DIMMED_ICONS_TIMEOUT = 1000

type Props = {
  on_history_click?: () => void
  on_donate_click?: () => void
  is_home_active?: boolean
}

export const Footer: React.FC<Props> = (props) => {
  const { can_undo, on_apply_click, on_undo_click } = useContext(LayoutContext)

  const { t } = use_translation()

  const history_label = t('footer.action.history')
  const undo_label = t('footer.action.undo')
  const apply_label = t('footer.action.apply')

  const { container_ref, compact_step } = use_compacting()
  const [is_alt, set_is_alt] = useState(true)
  const leave_timeout_ref = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handle_mouse_enter = () => {
    if (leave_timeout_ref.current) {
      clearTimeout(leave_timeout_ref.current)
      leave_timeout_ref.current = null
    }
    set_is_alt(false)
  }

  const handle_mouse_leave = () => {
    leave_timeout_ref.current = setTimeout(() => {
      set_is_alt(true)
    }, DIMMED_ICONS_TIMEOUT)
  }

  useEffect(() => {
    return () => {
      if (leave_timeout_ref.current) {
        clearTimeout(leave_timeout_ref.current)
      }
    }
  }, [])

  const handle_apply_click = () => {
    on_apply_click()
  }

  const is_alt_style = is_alt && !props.is_home_active

  return (
    <div className={styles.footer} ref={container_ref}>
      <div
        className={styles.footer__left}
        onMouseEnter={handle_mouse_enter}
        onMouseLeave={handle_mouse_leave}
      >
        <a
          href="https://discord.gg/KJySXsrSX5"
          className={cn(styles['footer__discord-button'], {
            [styles['footer__discord-button--alt']]: is_alt_style
          })}
          title="Discord"
          target="_blank"
          rel="noopener noreferrer"
        >
          <UiIcon variant="DISCORD" />
        </a>
        <button
          type="button"
          className={cn(styles['footer__donate-button'], {
            [styles['footer__donate-button--alt']]: is_alt_style
          })}
          onClick={props.on_donate_click}
          title={t('header.buy-me-a-coffee')}
        >
          <span className={cn('codicon', 'codicon-coffee')} />
        </button>
      </div>

      <div className={styles.footer__right}>
        <CompactableActionButton
          is_compact={compact_step >= 2}
          on_click={props.on_history_click}
          title={t('footer.history-title')}
          codicon="history"
          label={history_label}
        />
        <CompactableActionButton
          is_compact={compact_step >= 1}
          on_click={on_undo_click}
          title={t('footer.undo-title')}
          disabled={!can_undo}
          codicon="discard"
          label={undo_label}
        />
        <CompactableActionButton
          is_compact={compact_step >= 3}
          on_click={handle_apply_click}
          title={t('footer.apply-title')}
          codicon="check-all"
          label={apply_label}
        />
      </div>
    </div>
  )
}
