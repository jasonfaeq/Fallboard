import { useRef, useState } from 'react'
import type { ScoreEntry } from '../reader/library'

interface Props {
  current: string
  builtIn: ScoreEntry[]
  imported: ScoreEntry[]
  onOpen: (entry: ScoreEntry) => void
  onImport: (files: FileList) => void
  onDelete: (entry: ScoreEntry) => void
  onClose: () => void
}

/** The score shelf: import a MusicXML or MuseScore file, open or delete what was imported, or a built-in piece. */
export default function Library({ current, builtIn, imported, onOpen, onImport, onDelete, onClose }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const [confirm, setConfirm] = useState('')
  const item = (entry: ScoreEntry) => <li key={entry.id} className={entry.id === current ? 'current' : ''}>
    <button className="score-item" onClick={() => onOpen(entry)}>
      <strong>{entry.title}</strong>
      <span>{[entry.composer, entry.file].filter(Boolean).join(' · ') || 'Built-in'}</span>
    </button>
    {!entry.builtIn && (confirm === entry.id
      ? <button className="danger" onClick={() => { setConfirm(''); onDelete(entry) }}>Delete for good</button>
      : <button className="quiet" aria-label={`Delete ${entry.title}`} onClick={() => setConfirm(entry.id)}>Delete</button>)}
  </li>
  return <div className="drawer-backdrop" onClick={onClose}>
    <aside className="drawer" role="dialog" aria-label="Scores" onClick={(e) => e.stopPropagation()}>
      <header><h2>Scores</h2><button className="quiet" aria-label="Close scores" onClick={onClose}>✕</button></header>
      <button className="primary wide" onClick={() => input.current!.click()}>Import a score…</button>
      <input ref={input} type="file" hidden data-testid="import-input"
        accept=".mxl,.musicxml,.xml,.mscz,.mscx,.mid,.midi,.pdf"
        onChange={(e) => { if (e.target.files?.length) onImport(e.target.files); e.target.value = '' }} />
      <p className="hint">Opens MusicXML (<b>.mxl</b>, <b>.musicxml</b>) and MuseScore files (<b>.mscz</b>).
        From <b>musescore.com</b>: open a score, choose <b>Download</b>, then <b>MusicXML</b> or <b>MuseScore</b>.
        You can also drop the file anywhere on this window. Imported scores stay in this browser.</p>
      <h3>Imported</h3>
      {imported.length ? <ul className="score-list">{imported.map(item)}</ul> : <p className="hint">Nothing imported yet.</p>}
      <h3>Built-in</h3>
      <ul className="score-list">{builtIn.map(item)}</ul>
    </aside>
  </div>
}
