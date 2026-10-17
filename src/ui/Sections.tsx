import { useEffect, useRef, useState } from 'react'
import type { Section } from '../reader/prefs'
import Icon from './Icons'

interface Props {
  sections: Section[]
  /** the bars each section covers, e.g. "Bars 12–16" */
  label: (section: Section) => string
  /** the loop that can be saved, with its default name; null without a loop */
  loop: { name: string; first: number; last: number } | null
  /** the section the loop is now, or -1 */
  active: number
  onSave: (name: string) => void
  onPick: (index: number) => void
  onRename: (index: number, name: string) => void
  onDelete: (index: number) => void
  onClose: () => void
}

/** The score's saved loops: save the current loop under a name, pick one to loop it, rename or delete. */
export default function Sections({ sections, label, loop, active, onSave, onPick, onRename, onDelete, onClose }: Props) {
  const panel = useRef<HTMLDivElement>(null)
  const [editing, setEditing] = useState(-1)
  useEffect(() => {
    const away = (e: PointerEvent) => {
      const target = e.target as Element
      if (!panel.current?.contains(target) && !target.closest('[data-sections-toggle]')) onClose()
    }
    window.addEventListener('pointerdown', away)
    return () => window.removeEventListener('pointerdown', away)
  }, [onClose])

  const finish = (index: number, name: string) => {
    if (name.trim()) onRename(index, name.trim())
    setEditing(-1)
  }
  return <div className="settings sections" ref={panel} role="dialog" aria-label="Sections">
    <h3>Sections</h3>
    {loop
      ? <form className="section-save" key={`${loop.first}-${loop.last}`} onSubmit={(e) => {
        e.preventDefault()
        const name = new FormData(e.currentTarget).get('name')?.toString().trim()
        onSave(name || loop.name)
      }}>
        <input name="name" defaultValue={loop.name} aria-label="Section name" autoComplete="off" onFocus={(e) => e.currentTarget.select()} />
        <button type="submit">Save loop</button>
      </form>
      : <p className="hint">Loop some bars (L, or click a bar and Shift+click another), then save them here.</p>}
    {sections.length > 0 && <ul className="section-list">
      {sections.map((s, i) => <li key={i} className={i === active ? 'on' : ''}>
        {editing === i
          ? <input defaultValue={s.name} aria-label="New name" autoFocus onFocus={(e) => e.currentTarget.select()}
            onBlur={(e) => finish(i, e.currentTarget.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') finish(i, e.currentTarget.value); if (e.key === 'Escape') { e.stopPropagation(); setEditing(-1) } }} />
          : <button className="section-name" onClick={() => onPick(i)} title="Loop this section and go to its start">
            <span>{s.name}</span><small>{label(s)}</small></button>}
        <button className="icon-button" aria-label={`Rename ${s.name}`} title="Rename" onClick={() => setEditing(i)}><Icon name="edit" size={16} /></button>
        <button className="icon-button" aria-label={`Delete ${s.name}`} title="Delete" onClick={() => onDelete(i)}><Icon name="trash" size={16} /></button>
      </li>)}
    </ul>}
    <p className="hint">[ and ] loop the previous or next section.</p>
  </div>
}
