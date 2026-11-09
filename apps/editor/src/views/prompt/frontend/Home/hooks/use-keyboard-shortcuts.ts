import { useEffect } from 'react'
import { use_alt_pressed } from '@/views/prompt/frontend/hooks/use-alt-pressed'
import { Target } from '@shared/types/target'

export const use_keyboard_shortcuts = (params: {
  is_active: boolean
  targets_order: Target[]
  on_chatbots_click: () => void
  on_api_calls_click: () => void
  on_cli_calls_click: () => void
}) => {
  const { is_alt_pressed, pressed_keys_ref } = use_alt_pressed({
    is_active: params.is_active
  })

  useEffect(() => {
    if (!params.is_active) return

    const handle_key_down = (event: KeyboardEvent) => {
      if (
        event.altKey &&
        pressed_keys_ref.current.has('AltLeft') &&
        !event.shiftKey &&
        !event.metaKey &&
        !event.ctrlKey
      ) {
        const get_click_handler = (index: number) => {
          const target = params.targets_order[index]
          if (target === 'WEB') return params.on_chatbots_click
          if (target === 'API') return params.on_api_calls_click
          if (target === 'CLI') return params.on_cli_calls_click
        }

        const handle_shortcut = (index: number) => {
          event.preventDefault()
          pressed_keys_ref.current.forEach((code) => {
            window.dispatchEvent(new KeyboardEvent('keyup', { code }))
          })
          pressed_keys_ref.current.clear()
          get_click_handler(index)?.()
        }

        if (event.code === 'Digit1' || event.code === 'Numpad1') {
          handle_shortcut(0)
        } else if (event.code === 'Digit2' || event.code === 'Numpad2') {
          handle_shortcut(1)
        } else if (event.code === 'Digit3' || event.code === 'Numpad3') {
          handle_shortcut(2)
        }
      }
    }

    window.addEventListener('keydown', handle_key_down)

    return () => window.removeEventListener('keydown', handle_key_down)
  }, [
    params.is_active,
    params.targets_order,
    params.on_chatbots_click,
    params.on_api_calls_click,
    params.on_cli_calls_click
  ])

  const clear_keys = () => {
    pressed_keys_ref.current.forEach((code) => {
      window.dispatchEvent(new KeyboardEvent('keyup', { code }))
    })
    pressed_keys_ref.current.clear()
  }

  return { is_alt_pressed, clear_keys }
}
