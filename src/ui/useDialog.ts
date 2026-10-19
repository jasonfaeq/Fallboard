import { useEffect, type RefObject } from 'react'

/** Keep modal keyboard focus inside, and return to the control that opened it. */
export function useDialog(panel: RefObject<HTMLElement>, open = true) {
  useEffect(() => {
    if (!open || !panel.current) return
    const dialog = panel.current
    const previous = document.activeElement as HTMLElement | null
    const backdrop = dialog.closest('.backdrop')
    const siblings = [...(backdrop?.parentElement?.children ?? [])]
      .filter((e): e is HTMLElement => e instanceof HTMLElement && e !== backdrop)
      .map((e) => ({ element: e, inert: e.inert }))
    siblings.forEach(({ element }) => { element.inert = true })
    const controls = () => [...dialog.querySelectorAll<HTMLElement>('button, input, select, a[href], [tabindex="0"]')]
      .filter((e) => !e.hasAttribute('disabled') && e.offsetParent !== null)
    const initial = dialog.querySelector<HTMLElement>('input[type="search"]') ?? controls()[0] ?? dialog
    initial.focus()
    const trap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const items = controls(), first = items[0], last = items.at(-1)
      if (!first) { e.preventDefault(); return }
      if (e.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        e.preventDefault(); last?.focus()
      } else if (!e.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
        e.preventDefault(); first.focus()
      }
    }
    dialog.addEventListener('keydown', trap)
    return () => {
      dialog.removeEventListener('keydown', trap)
      siblings.forEach(({ element, inert }) => { element.inert = inert })
      if (previous?.isConnected) previous.focus()
    }
  }, [panel, open])
}
