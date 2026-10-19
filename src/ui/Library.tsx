import { useRef, useState } from 'react'
import type { ScoreEntry } from '../reader/library'
import Icon from './Icons'
import { useDialog } from './useDialog'
import type { Collection, Setlist } from '../reader/collection'
import ScoreCover from './ScoreCover'

interface Props {
  current: string
  builtIn: ScoreEntry[]
  imported: ScoreEntry[]
  onOpen: (entry: ScoreEntry) => void
  onImport: (files: FileList) => void
  onDelete: (entry: ScoreEntry) => void
  onClose: () => void
  collection: Collection
  onCollection: (collection: Collection) => void
  onPlaySetlist: (setlist: Setlist, listening?: boolean) => void
  preview: { id: string; loading: boolean; error: string; start: (entry: ScoreEntry) => Promise<void>; stop: () => void }
}

const added = (when: number) => when ? new Date(when).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : ''

/** The score shelf: import a MusicXML or MuseScore file, open or delete what was imported, or a built-in piece. */
export default function Library({ current, builtIn, imported, onOpen, onImport, onDelete, onClose, collection, onCollection, onPlaySetlist, preview }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const panel = useRef<HTMLElement>(null)
  useDialog(panel)
  const [confirm, setConfirm] = useState('')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'imported' | 'built-in' | 'favourites'>('all')
  const [sort, setSort] = useState('recent')
  const [setlistId, setSetlistId] = useState('')
  const [setlistMessage, setSetlistMessage] = useState('')
  const all = [...builtIn, ...imported]
  const selected = collection.setlists.find((list) => list.id === setlistId)
  const updateSetlist = (patch: Partial<Setlist>) => {
    if (selected) onCollection({ ...collection, setlists: collection.setlists.map((s) => s.id === selected.id ? { ...s, ...patch } : s) })
  }
  const move = (index: number, direction: number) => {
    if (!selected) return
    const scores = [...selected.scores], target = index + direction
    if (target < 0 || target >= scores.length) return
    ;[scores[index], scores[target]] = [scores[target], scores[index]]
    updateSetlist({ scores })
  }
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  const matches = (e: ScoreEntry) => words.every((w) => `${e.title} ${e.composer} ${e.file}`.toLowerCase().includes(w))
  const compare = (a: ScoreEntry, b: ScoreEntry) => sort === 'composer'
    ? a.composer.localeCompare(b.composer) || a.title.localeCompare(b.title)
    : sort === 'title' ? a.title.localeCompare(b.title) : b.added - a.added || a.title.localeCompare(b.title)
  const mine = imported.filter(matches).sort(compare)
  const shipped = builtIn.filter(matches).sort(compare)
  const favourites = all.filter((entry) => collection.favourites.includes(entry.id) && matches(entry)).sort(compare)

  const item = (entry: ScoreEntry, index?: number) => <li key={entry.id} className={`score-card${entry.id === current ? ' current' : ''}`} role="group" aria-label={entry.title}>
    <button className="score-item" onClick={() => onOpen(entry)} title={entry.builtIn ? undefined : `Imported ${added(entry.added)}`}>
      <ScoreCover entry={entry} />
      <span className="score-text">
        <strong>{entry.title}</strong>
        <span>{[entry.composer, entry.builtIn ? 'Built-in' : entry.file].filter(Boolean).join(' · ')}</span>
      </span>
      {entry.id === current && <span className="badge">Open</span>}
    </button>
    <div className="score-actions">
      <button className={`icon-button favourite${collection.favourites.includes(entry.id) ? ' on' : ''}`} aria-label={collection.favourites.includes(entry.id) ? 'Unfavourite score' : 'Favourite score'}
        aria-pressed={collection.favourites.includes(entry.id)} title="Favourite" onClick={() => onCollection({ ...collection, favourites: collection.favourites.includes(entry.id) ? collection.favourites.filter((id) => id !== entry.id) : [...collection.favourites, entry.id] })}><Icon name="star" size={16} /></button>
      <button className={`preview-button${preview.id === entry.id ? ' on' : ''}`} aria-label={preview.id === entry.id ? 'Stop preview' : 'Preview score'}
        title="Up to 8 seconds, at original tempo" onClick={() => void preview.start(entry)}><Icon name={preview.id === entry.id ? 'pause' : 'play'} size={12} />{preview.id === entry.id ? preview.loading ? 'Opening…' : 'Stop' : 'Preview'}</button>
      {selected && <button className="icon-button" aria-label="Add score to setlist" title={`Add to ${selected.name}`} disabled={selected.scores.includes(entry.id)}
        onClick={() => updateSetlist({ scores: [...selected.scores, entry.id] })}><Icon name="plus" size={16} /></button>}
      {index !== undefined && selected && <>
        <button className="icon-button" aria-label="Move score up" disabled={index === 0} onClick={() => move(index, -1)}><Icon name="up" size={15} /></button>
        <button className="icon-button" aria-label="Move score down" disabled={index === selected.scores.length - 1} onClick={() => move(index, 1)}><Icon name="down" size={15} /></button>
        <button className="icon-button" aria-label="Remove score from setlist" onClick={() => updateSetlist({ scores: selected.scores.filter((id) => id !== entry.id) })}><Icon name="close" size={14} /></button>
      </>}
    {!entry.builtIn && (confirm === entry.id
      ? <button className="danger" onClick={() => { setConfirm(''); onDelete(entry) }} onBlur={() => setConfirm('')} autoFocus>Delete for good</button>
      : <button className="icon-button delete" aria-label={`Delete ${entry.title}`} title="Delete" onClick={() => setConfirm(entry.id)}><Icon name="trash" size={16} /></button>)}
    </div>
  </li>

  return <div className="backdrop" onClick={onClose}>
    <aside className="drawer collection-drawer" ref={panel} role="dialog" aria-modal="true" aria-label="Scores" onClick={(e) => e.stopPropagation()}>
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
      <details className="setlist-tools" open={!!selected}><summary><Icon name="setlist" size={16} />Setlists <span>{collection.setlists.length}</span></summary>
        <form className="setlist-create" onSubmit={(e) => {
          e.preventDefault(); const form = e.currentTarget, name = String(new FormData(form).get('setlist-name') ?? '').trim()
          if (!name) return
          const list = { id: crypto.randomUUID(), name: name.slice(0, 80), scores: [] }
          onCollection({ ...collection, setlists: [...collection.setlists, list] }); setSetlistId(list.id); setSetlistMessage('Choose scores below and use + to add them.'); form.reset()
        }}><input name="setlist-name" aria-label="New setlist name" placeholder="An evening at the piano…" maxLength={80} /><button type="submit">Create setlist</button></form>
        <div className="setlist-picker"><select aria-label="Selected setlist" value={setlistId} onChange={(e) => { setSetlistId(e.target.value); setSetlistMessage('') }}>
          <option value="">Choose a setlist</option>{collection.setlists.map((list) => <option key={list.id} value={list.id}>{list.name} ({list.scores.length})</option>)}</select>
          {selected && <><button className="primary-button" disabled={!selected.scores.length} onClick={() => onPlaySetlist(selected)}><Icon name="play" size={13} />Play setlist</button>
            <button className="listening-launch" disabled={!selected.scores.length} onClick={() => onPlaySetlist(selected, true)}><Icon name="volume" size={14} />Listening room</button>
            <button className="icon-button" aria-label="Delete setlist" onClick={() => { onCollection({ ...collection, setlists: collection.setlists.filter((s) => s.id !== selected.id) }); setSetlistId('') }}><Icon name="trash" size={15} /></button></>}
        </div>
        {selected && <form className="setlist-rename" key={selected.id} onSubmit={(e) => { e.preventDefault(); const name = String(new FormData(e.currentTarget).get('rename') ?? '').trim(); if (name) updateSetlist({ name: name.slice(0, 80) }) }}>
          <input name="rename" aria-label="Rename setlist" defaultValue={selected.name} maxLength={80} /><button type="submit">Rename</button></form>}
        {setlistMessage && <p className="hint" role="status">{setlistMessage}</p>}
        {selected && <><h3>{selected.name} <span>{selected.scores.length}</span></h3><ol className="score-list setlist-scores">{selected.scores.map((id, index) => { const entry = all.find((score) => score.id === id); return entry ? item(entry, index) : null })}</ol>
          {!selected.scores.length && <p className="hint empty">Add a few scores from the collection below.</p>}</>}
      </details>
      <label className="search">
        <Icon name="search" size={16} />
        <input type="search" placeholder="Search titles and composers" value={query} aria-label="Search scores" onChange={(e) => setQuery(e.target.value)} />
      </label>
      <div className="library-tools">
        <div className="segmented small" role="group" aria-label="Score source">
          {([['all', 'All scores'], ['imported', 'Imported'], ['built-in', 'Collection'], ['favourites', 'Favourites']] as const).map(([value, label]) =>
            <button key={value} aria-pressed={filter === value} className={filter === value ? 'on' : ''} onClick={() => setFilter(value)}>{label}</button>)}
        </div>
        <select aria-label="Sort scores" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="recent">Recently added</option><option value="title">Title A–Z</option><option value="composer">Composer A–Z</option>
        </select>
      </div>
      {preview.id && <p className="preview-status" role="status"><Icon name="volume" size={14} />{preview.loading ? 'Opening preview…' : 'Previewing'} {all.find((s) => s.id === preview.id)?.title} · original tempo · up to 8 seconds</p>}
      {preview.error && <p className="hint error" role="alert">{preview.error}</p>}
      {filter === 'favourites' ? <><h3>Favourites <span>{favourites.length}</span></h3>{favourites.length ? <ul className="score-list">{favourites.map((entry) => item(entry))}</ul> : <p className="hint empty">Star a score to keep it close.</p>}</> : <>
      {filter !== 'built-in' && <><h3>Imported <span>{imported.length || ''}</span></h3>
      {mine.length ? <ul className="score-list">{mine.map((entry) => item(entry))}</ul>
        : <p className="hint empty">{imported.length ? 'No imported score matches.' : 'A new piece starts here. Import your first score above.'}</p>}</>}
      {filter !== 'imported' && <><h3>The Fallboard collection <span>{builtIn.length}</span></h3>
      {shipped.length ? <ul className="score-list">{shipped.map((entry) => item(entry))}</ul> : <p className="hint empty">No built-in piece matches.</p>}</>}
      </>}
    </aside>
  </div>
}
