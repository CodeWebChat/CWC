import { useContext } from 'react'
import styles from './Footer.module.scss'
import { use_compacting } from '@shared/hooks'
import { LayoutContext } from '../../../contexts/LayoutContext'
import { use_translation } from '../../../i18n/use-translation'
import { CompactableActionButton } from '@ui/components/editor/prompt-view/CompactableActionButton'

type Props = {
  on_history_click?: () => void
}

export const Footer: React.FC<Props> = (props) => {
  const { can_undo, on_apply_click, on_undo_click } = useContext(LayoutContext)

  const { t } = use_translation()

  const history_label = t('footer.action.history')
  const undo_label = t('footer.action.undo')
  const apply_label = t('footer.action.apply-from')

  const { container_ref, compact_step } = use_compacting()

  const handle_apply_click = () => {
    on_apply_click()
  }

  return (
    <div className={styles.footer} ref={container_ref}>
      <div className={styles.footer__left}>
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
      </div>

      <div>
        <button
          className={styles['apply-button']}
          onClick={handle_apply_click}
          title={t('footer.apply-title')}
        >
          {apply_label}
        </button>
      </div>
    </div>
  )
}
