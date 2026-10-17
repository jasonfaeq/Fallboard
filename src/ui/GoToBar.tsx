import { useRef, useState } from 'react'
import { useClickAway } from './clickAway'

interface Props {
  /** the printed bar numbers, lowest and highest */
  first: number
  last: number
  /** jump to a printed bar; false if the score has no such bar */
  onGo: (bar: number) => boolean
  onClose: () => void
}

/** A small box for typing a bar number. */
export default function GoToBar({ first, last, onGo, onClose }: Props) {
  const panel = useRef<HTMLFormElement>(null)
  const [problem, setProblem] = useState('')
  useClickAway(panel, 'data-go-to-toggle', onClose)
  return <form className="settings go-to" ref={panel} role="dialog" aria-label="Go to bar" noValidate onSubmit={(e) => {
    e.preventDefault()
    const text = new FormData(e.currentTarget).get('bar')?.toString().trim() ?? ''
    const bar = Number(text)
    if (text && Number.isInteger(bar) && onGo(bar)) onClose()
    else setProblem(`There is no bar ${text || 'without a number'}. Bars go from ${first} to ${last}.`)
  }}>
    <label>
      <span>Go to bar</span>
      <input name="bar" type="number" min={first} max={last} autoFocus aria-label="Bar number" autoComplete="off"
        onKeyDown={(e) => { if (e.key === 'Escape') onClose() }} onChange={() => setProblem('')} />
    </label>
    <button type="submit">Go</button>
    {problem && <p className="hint error" role="alert">{problem}</p>}
  </form>
}
