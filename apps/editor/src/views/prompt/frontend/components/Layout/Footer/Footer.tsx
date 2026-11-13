import { useContext } from 'react'
import styles from './Footer.module.scss'
import { use_compacting } from '@shared/hooks'
import { LayoutContext } from '../../../contexts/LayoutContext'
import { use_translation } from '../../../i18n/use-translation'
import cn from 'classnames'
import { CompactableActionButton } from '@ui/components/editor/prompt-view/CompactableActionButton'
import { Icon as UiIcon } from '@ui/components/editor/common/Icon'
import { use_dimmed_icons } from './hooks/use-dimmed-icons'

type Props = {
  on_history_click?: () => void
  on_donate_click?: () => void
  is_home_active?: boolean
}

export const Footer: React.FC<Props> = (props) => {
  const {
    can_undo,
    has_changes_to_commit,
    on_apply_click,
    on_undo_click,
    on_commit_click
  } = useContext(LayoutContext)
  const { t } = use_translation()
  const { container_ref, compact_step } = use_compacting()
  const {
    is_alt,
    clear_leave_timeout,
    handle_left_mouse_enter,
    handle_footer_mouse_leave
  } = use_dimmed_icons()

  const is_alt_style = is_alt && !props.is_home_active

  const get_icon_button_class = (variant_class: string) =>
    cn(styles['footer__icon-button'], variant_class, {
      [styles['footer__icon-button--alt']]: is_alt_style
    })

  return (
    <div
      className={styles.footer}
      ref={container_ref}
      onMouseEnter={clear_leave_timeout}
      onMouseLeave={handle_footer_mouse_leave}
    >
      <div
        className={styles.footer__left}
        onMouseEnter={handle_left_mouse_enter}
      >
        <a
          href="https://discord.gg/KJySXsrSX5"
          className={get_icon_button_class(
            styles['footer__icon-button--discord']
          )}
          title="Discord"
          target="_blank"
          rel="noopener noreferrer"
        >
          <UiIcon variant="DISCORD" />
        </a>
        <button
          type="button"
          className={get_icon_button_class(
            styles['footer__icon-button--donate']
          )}
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
          label={t('footer.action.history')}
        />
        <CompactableActionButton
          is_compact={compact_step >= 1}
          on_click={on_undo_click}
          title={t('footer.undo-title')}
          disabled={!can_undo}
          codicon="discard"
          label={t('footer.action.undo')}
        />
        <CompactableActionButton
          is_compact={compact_step >= 3}
          on_click={on_commit_click}
          title={t('footer.commit-title')}
          disabled={!has_changes_to_commit}
          codicon="git-commit"
          label={t('footer.action.commit')}
        />
        <CompactableActionButton
          is_compact={compact_step >= 4}
          on_click={on_apply_click}
          title={t('footer.apply-title')}
          codicon="check-all"
          label={t('footer.action.apply')}
        />
      </div>
    </div>
  )
}
