import { useRef } from 'react'
import type { SessionRecap, SessionTracker } from '../reader/sessions'
import Icon from './Icons'
import { useDialog } from './useDialog'

export const listeningTime = (seconds: number) => seconds < 60 ? `${Math.round(seconds)} sec` : `${Math.floor(seconds / 60)} min ${Math.round(seconds % 60)} sec`
interface Props { history: SessionRecap[]; current: SessionTracker['current']; onFinish: () => void; onClose: () => void }
export default function Sessions({ history, current, onFinish, onClose }: Props) {
  const panel = useRef<HTMLDivElement>(null)
  useDialog(panel)
  return <div className="backdrop center" onClick={onClose}><div className="sessions-dialog help" ref={panel} role="dialog" aria-modal="true" aria-label="Session history" onClick={(e) => e.stopPropagation()}>
    <header><div><span className="library-eyebrow">A LITTLE MUSIC ADDS UP</span><h2>Your sessions</h2></div><button className="icon-button" aria-label="Close sessions" onClick={onClose}><Icon name="close" /></button></header>
    {current && <div className="current-session"><div><span className="panel-label">This session</span><strong>{current.title}</strong><span>{listeningTime(current.seconds)} of playback</span></div><button className="primary-button" disabled={current.seconds < .25} onClick={onFinish}>Finish session</button></div>}
    <p className="hint">Playback time, passages revisited and tempo settings. Count-ins and score previews are excluded. Saved in this browser.</p>
    <ol className="session-list">{history.map((session) => <li key={session.id} className={session.reason === 'completed' ? 'completed' : ''}>
      <div className="session-heading"><Icon name={session.reason === 'completed' ? 'check' : 'history'} size={18} /><div><h3>{session.title}</h3><p>{new Date(session.ended).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · {session.reason === 'completed' ? 'Finished listening' : 'Session saved'}</p></div><strong>{listeningTime(session.seconds)}</strong></div>
      <div className="session-tempo"><span>Tempo {Math.round(session.startSpeed * 100)}% → {Math.round(session.endSpeed * 100)}%</span><span>{session.changes} tempo {session.changes === 1 ? 'change' : 'changes'}</span><span>Range {Math.round(session.minSpeed * 100)}–{Math.round(session.maxSpeed * 100)}%</span></div>
      <div className="session-passages">{session.passages.map((passage) => <span key={passage.first}>{passage.label}<small>×{passage.visits}</small></span>)}</div>
    </li>)}</ol>
    {!history.length && <p className="hint empty">Your first saved session will appear here after you listen to a piece or choose Finish session.</p>}
  </div></div>
}
