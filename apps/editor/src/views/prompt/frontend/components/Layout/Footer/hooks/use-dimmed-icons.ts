import { useEffect, useRef, useState } from 'react'

const DIMMED_ICONS_TIMEOUT = 1000

export const use_dimmed_icons = () => {
  const [is_alt, set_is_alt] = useState(true)
  const leave_timeout_ref = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clear_leave_timeout = () => {
    if (leave_timeout_ref.current) {
      clearTimeout(leave_timeout_ref.current)
      leave_timeout_ref.current = null
    }
  }

  const handle_left_mouse_enter = () => {
    clear_leave_timeout()
    set_is_alt(false)
  }

  const handle_footer_mouse_leave = () => {
    leave_timeout_ref.current = setTimeout(() => {
      set_is_alt(true)
    }, DIMMED_ICONS_TIMEOUT)
  }

  useEffect(() => {
    return () => {
      clear_leave_timeout()
    }
  }, [])

  return {
    is_alt,
    clear_leave_timeout,
    handle_left_mouse_enter,
    handle_footer_mouse_leave
  }
}
