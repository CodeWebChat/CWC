import { createContext } from 'react'

type LayoutContextType = {
  can_undo: boolean
  on_apply_click: () => void
  on_undo_click: () => void
}

export const LayoutContext = createContext<LayoutContextType>({
  can_undo: false,
  on_apply_click: () => {},
  on_undo_click: () => {}
})
