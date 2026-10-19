import { useMemo, useRef, useState } from 'react'
import type { ScoreAnnotation } from '../reader/prefs'
import type { Timeline } from '../reader/timeline'
import Icon from './Icons'
import { useDialog } from './useDialog'

interface Props {
  timeline: Timeline; annotations: ScoreAnnotation[]; initialMeasure: number
  onSave: (annotation: ScoreAnnotation) => void; onGo: (measure: number) => void; onClose: () => void
}
export default function ScoreNotes({ timeline, annotations, initialMeasure, onSave, onGo, onClose }: Props) {
  const panel = useRef<HTMLDivElement>(null)
  useDialog(panel)
  const bars = useMemo(() => [...new Map(timeline.passes.map((p) => [p.measure, p.number])).entries()], [timeline])
  const [measure, setMeasure] = useState(initialMeasure)
  const [revision, setRevision] = useState(0)
  const [message, setMessage] = useState('')
  const saved = annotations.find((a) => a.measure === measure)
  const label = (m: number) => { const number = bars.find(([index]) => index === m)?.[1]; return number === 0 ? 'Pickup' : `Bar ${number ?? '—'}` }
  return <div className="backdrop center" onClick={onClose}>
    <div className="notes-dialog help" ref={panel} role="dialog" aria-modal="true" aria-label="Notes and bookmarks" onClick={(e) => e.stopPropagation()}>
      <header><div><span className="library-eyebrow">MAKE THE SCORE YOURS</span><h2>Notes & bookmarks</h2></div><button className="icon-button" aria-label="Close notes" onClick={onClose}><Icon name="close" /></button></header>
      <div className="notes-bar"><label>Printed bar<select aria-label="Annotation bar" value={measure} onChange={(e) => { setMeasure(Number(e.target.value)); setMessage('') }}>
        {bars.map(([m]) => <option key={m} value={m}>{label(m)}</option>)}</select></label><button onClick={() => onGo(measure)}>Go to this bar</button></div>
      <form key={`${measure}:${revision}`} onSubmit={(e) => {
        e.preventDefault(); const data = new FormData(e.currentTarget)
        onSave({ measure, text: String(data.get('text') ?? '').trim(), bookmarked: data.has('bookmark') }); setMessage(`Saved for ${label(measure).toLowerCase()}.`)
      }}>
        <label className="note-text-label">Your note<textarea name="text" aria-label="Score note" defaultValue={saved?.text ?? ''} maxLength={1000} rows={4} placeholder="A fingering, a reminder, a tricky transition…" /></label>
        <label className="bookmark-check"><input name="bookmark" type="checkbox" defaultChecked={saved?.bookmarked ?? false} />Bookmark this bar</label>
        <div className="notes-actions"><button type="submit" className="primary-button">Save note</button><button type="button" disabled={!saved} onClick={() => { onSave({ measure, text: '', bookmarked: false }); setRevision((n) => n + 1); setMessage('Note and bookmark removed.') }}>Remove note</button><span role="status">{message}</span></div>
      </form>
      <h3 className="panel-label">In this score</h3>
      {annotations.length ? <ul className="annotation-list">{annotations.filter((a) => bars.some(([m]) => m === a.measure)).map((annotation) => <li key={annotation.measure}>
        <button onClick={() => { setMeasure(annotation.measure); setMessage('') }}><Icon name={annotation.bookmarked ? 'sections' : 'notes'} size={16} /><strong>{label(annotation.measure)}</strong><span>{annotation.text || 'Bookmark'}</span></button>
      </li>)}</ul> : <p className="hint">Keep reminders beside the music. A note on a printed bar appears on each repeat.</p>}
    </div>
  </div>
}
