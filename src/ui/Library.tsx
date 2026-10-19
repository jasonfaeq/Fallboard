import { useRef, useState } from 'react'
import type { ScoreEntry } from '../reader/library'
import Icon from './Icons'
import { useDialog } from './useDialog'

interface Props {
  current: string
  builtIn: ScoreEntry[]
  imported: ScoreEntry[]
  onOpen: (entry: ScoreEntry) => void
  onImport: (files: FileList) => void
  onDelete: (entry: ScoreEntry) => void
  onClose: () => void
}

/** a steady colour per score, so a title is easy to spot again */
function hue(text: string) {
  let h = 0
  for (const c of text) h = (h * 31 + c.charCodeAt(0)) % 360
  return h
}
/** the composer's initials (first and last name), else the title's */
function initials(entry: ScoreEntry) {
  const words = (entry.composer || entry.title).replace(/[^\p{L}\p{N} ]/gu, '').split(/\s+/).filter(Boolean)
  return words.length ? (words[0][0] + (words.length > 1 ? words[words.length - 1][0] : '')).toUpperCase() : '♪'
}
const added = (when: number) => when ? new Date(when).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : ''

/** The score shelf: import a MusicXML or MuseScore file, open or delete what was imported, or a built-in piece. */
export default function Library({ current, builtIn, imported, onOpen, onImport, onDelete, onClose }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const panel = useRef<HTMLElement>(null)
  useDialog(panel)
  const [confirm, setConfirm] = useState('')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'imported' | 'built-in'>('all')
  const [sort, setSort] = useState('recent')
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  const matches = (e: ScoreEntry) => words.every((w) => `${e.title} ${e.composer} ${e.file}`.toLowerCase().includes(w))
  const compare = (a: ScoreEntry, b: ScoreEntry) => sort === 'composer'
    ? a.composer.localeCompare(b.composer) || a.title.localeCompare(b.title)
    : sort === 'title' ? a.title.localeCompare(b.title) : b.added - a.added || a.title.localeCompare(b.title)
  const mine = imported.filter(matches).sort(compare)
  const shipped = builtIn.filter(matches).sort(compare)

  const item = (entry: ScoreEntry) => <li key={entry.id} className={entry.id === current ? 'current' : ''}>
    <button className="score-item" onClick={() => onOpen(entry)} title={entry.builtIn ? undefined : `Imported ${added(entry.added)}`}>
      <span className="cover" style={{ '--hue': hue(entry.title) } as React.CSSProperties} aria-hidden="true">{initials(entry)}</span>
      <span className="score-text">
        <strong>{entry.title}</strong>
        <span>{[entry.composer, entry.builtIn ? 'Built-in' : entry.file].filter(Boolean).join(' · ')}</span>
      </span>
      {entry.id === current && <span className="badge">Open</span>}
    </button>
    {!entry.builtIn && (confirm === entry.id
      ? <button className="danger" onClick={() => { setConfirm(''); onDelete(entry) }} onBlur={() => setConfirm('')} autoFocus>Delete for good</button>
      : <button className="icon-button delete" aria-label={`Delete ${entry.title}`} title="Delete" onClick={() => setConfirm(entry.id)}><Icon name="trash" size={16} /></button>)}
  </li>

  return <div className="backdrop" onClick={onClose}>
    <aside className="drawer" ref={panel} role="dialog" aria-modal="true" aria-label="Scores" onClick={(e) => e.stopPropagation()}>
      <header><div><span className="library-eyebrow">A LITTLE MUSIC, EVERY DAY</span><h2>Your score library</h2></div><button className="icon-button" aria-label="Close scores" onClick={onClose}><Icon name="close" /></button></header>
      <button className="import-zone" onClick={() => input.current!.click()}>
        <Icon name="upload" size={26} />
        <strong>Bring your next piece</strong>
        <span>MusicXML (.mxl, .musicxml) or MuseScore (.mscz). You can also drop a file anywhere on the window.</span>
      </button>
      <input ref={input} type="file" hidden data-testid="import-input"
        accept=".mxl,.musicxml,.xml,.mscz,.mscx,.mid,.midi,.pdf"
        onChange={(e) => { if (e.target.files?.length) onImport(e.target.files); e.target.value = '' }} />
      <p className="hint">From <b>musescore.com</b>: open a score, choose <b>Download</b>, then <b>MusicXML</b> or <b>MuseScore</b>.
        Imported scores stay in this browser.</p>
      <label className="search">
        <Icon name="search" size={16} />
        <input type="search" placeholder="Search titles and composers" value={query} aria-label="Search scores" onChange={(e) => setQuery(e.target.value)} />
      </label>
      <div className="library-tools">
        <div className="segmented small" role="group" aria-label="Score source">
          {([['all', 'All scores'], ['imported', 'Imported'], ['built-in', 'Collection']] as const).map(([value, label]) =>
            <button key={value} aria-pressed={filter === value} className={filter === value ? 'on' : ''} onClick={() => setFilter(value)}>{label}</button>)}
        </div>
        <select aria-label="Sort scores" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="recent">Recently added</option><option value="title">Title A–Z</option><option value="composer">Composer A–Z</option>
        </select>
      </div>
      {filter !== 'built-in' && <><h3>Imported <span>{imported.length || ''}</span></h3>
      {mine.length ? <ul className="score-list">{mine.map(item)}</ul>
        : <p className="hint empty">{imported.length ? 'No imported score matches.' : 'A new piece starts here. Import your first score above.'}</p>}</>}
      {filter !== 'imported' && <><h3>The Fallboard collection <span>{builtIn.length}</span></h3>
      {shipped.length ? <ul className="score-list">{shipped.map(item)}</ul> : <p className="hint empty">No built-in piece matches.</p>}</>}
    </aside>
  </div>
}
