import styles from './Layout.module.scss'
import { Footer } from './Footer'

type Props = {
  children: React.ReactNode
  on_history_click?: () => void
  on_donate_click?: () => void
  is_home_active?: boolean
}

export const Layout: React.FC<Props> = (props) => {
  return (
    <div className={styles.container}>
      <div className={styles.content}>{props.children}</div>
      <Footer
        on_history_click={props.on_history_click}
        on_donate_click={props.on_donate_click}
        is_home_active={props.is_home_active}
      />
    </div>
  )
}
