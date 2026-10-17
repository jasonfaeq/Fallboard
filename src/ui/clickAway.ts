import { useEffect, type RefObject } from 'react'

/** Close a popover on a press anywhere else; the button marked with `toggle` opens and closes it itself. */
export function useClickAway(panel: RefObject<HTMLElement>, toggle: string, onClose: () => void) {
  useEffect(() => {
    const away = (e: PointerEvent) => {
      const target = e.target as Element
      if (!panel.current?.contains(target) && !target.closest(`[${toggle}]`)) onClose()
    }
    window.addEventListener('pointerdown', away)
    return () => window.removeEventListener('pointerdown', away)
  }, [panel, toggle, onClose])
}
