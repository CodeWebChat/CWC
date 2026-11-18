import React from 'react'
import { StatusBar } from '@ui/components/editor/prompt-view/StatusBar'
import { Spacer as UiSpacer } from '@ui/components/editor/prompt-view/Spacer'

type Props = {
  is_connected: boolean
  is_visible: boolean
  is_closed: boolean
  translations: {
    connected: string
    not_connected: string
    run_browser: string
    hide: string
  }
  on_run_browser: () => void
  on_close: () => void
}

export const BrowserConnectionStatus: React.FC<Props> = (props) => {
  if (props.is_closed || !props.is_visible) {
    return null
  }

  const actions = []
  if (!props.is_connected) {
    actions.push({
      id: 'run',
      icon: 'codicon-play',
      label: props.translations.run_browser,
      title: props.translations.run_browser,
      on_click: props.on_run_browser
    })
  } else {
    actions.push({
      id: 'hide',
      icon: 'codicon-close-small',
      label: props.translations.hide,
      title: props.translations.hide,
      on_click: props.on_close
    })
  }

  return (
    <>
      <StatusBar
        theme={props.is_connected ? 'success' : 'default'}
        icon={
          props.is_connected
            ? 'codicon-debug-connected'
            : 'codicon-debug-disconnect'
        }
        label={
          props.is_connected
            ? props.translations.connected
            : props.translations.not_connected
        }
        actions={actions}
      />
      <UiSpacer height={6} />
    </>
  )
}
