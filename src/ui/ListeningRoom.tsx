import { useEffect, useRef } from 'react'
import type { ScoreEntry } from '../reader/library'
import { LISTENING_GAPS } from '../reader/prefs'
import Icon from './Icons'
import ScoreCover from './ScoreCover'
import { clock } from './Scrubber'

interface Props {
  name: string; scores: ScoreEntry[]; index: number; time: number; duration: number; speed: number
  ready: boolean; waiting: boolean; remaining: number; held: boolean; playing: boolean; countIn: boolean; complete: boolean
  gap: number; error: string
  onGap: (gap: number) => void; onToggle: () => void; onNow: () => void; onMove: (direction: number) => void
  onSeek: (time: number) => void; onClose: () => void; onEnd: () => void; onScores: () => void; onReplay: () => void; onRecaps: () => void
}

/** A quiet, full-stage setlist presentation. The same Player still supplies every note. */
export default function ListeningRoom(props: Props) {
  const { name, scores, index, ready, waiting, held, playing, complete } = props
  const back = useRef<HTMLButtonElement>(null)
  useEffect(() => { back.current?.focus() }, [])
  const current = scores[index], next = scores[index + 1]
  if (!current) return null
  const status = complete ? 'Setlist finished' : !ready ? 'Opening the piece…' : waiting
    ? held ? 'A moment, held for you' : `Beginning in ${Math.ceil(props.remaining)} ${Math.ceil(props.remaining) === 1 ? 'second' : 'seconds'}`
    : props.countIn ? 'Counting in' : playing ? 'Now on the piano' : 'Ready when you are'
  const toggleLabel = waiting ? held ? 'Resume countdown' : 'Hold countdown' : playing ? 'Pause listening' : 'Play listening'
  return <section className={`listening-room${waiting ? ' between-pieces' : ''}${complete ? ' listening-complete' : ''}`} aria-label="Listening room">
    <header className="listening-header"><div className="listening-brand">fallboard<span>THE LISTENING ROOM</span></div>
      <div className="listening-header-actions"><button onClick={props.onScores}><Icon name="scores" size={15} />Scores</button>
        <button ref={back} onClick={props.onClose}><Icon name="sheet" size={15} />Back to score</button>
        <button className="icon-button" aria-label="End setlist" onClick={props.onEnd}><Icon name="close" size={18} /></button></div>
    </header>
    <div className="listening-layout">
      <aside className="listening-sleeve" aria-label="Current piece artwork" key={current.id}>
        <div className="listening-sleeve-label">A LITTLE TIME FOR MUSIC</div><ScoreCover entry={current} />
        <div className="listening-sleeve-caption"><span>{name}</span><small>{complete ? 'Until the next listen.' : `Piece ${index + 1} of ${scores.length}`}</small></div>
      </aside>
      <div className="listening-main">
        <div className="listening-setlist-heading"><span>{name}</span><span>{index + 1} / {scores.length}</span></div>
        <div className="listening-title-card" key={current.id}>
          <p className="listening-status" role="status" aria-live="polite">{status}</p>
          <h1>{complete ? 'An evening, well spent.' : current.title}</h1>
          <p className="listening-composer">{complete ? name : current.composer || 'From your collection'}</p>
          <p className="listening-tempo">{!complete && ready ? `${Math.round(props.speed * 100)}% tempo · ${clock(props.duration)} at this speed` : complete ? 'A little more music in your day.' : 'Preparing the score and piano'}</p>
        </div>
        {!complete && <>
          <div className="listening-position"><span>{waiting ? '0:00' : clock(props.time / props.speed)}</span>
            <input type="range" aria-label="Listening position" min={0} max={Math.max(0, props.duration * props.speed)} step={.1} value={props.time}
              disabled={!ready || waiting} style={{ '--fill': `${props.duration ? props.time / (props.duration * props.speed) * 100 : 0}%` } as React.CSSProperties}
              onChange={(e) => props.onSeek(Number(e.target.value))} /><span>{clock(props.duration)}</span></div>
          <div className="listening-transport">
            <button className="icon-button" aria-label="Previous setlist piece" disabled={index === 0} onClick={() => props.onMove(-1)}><Icon name="previous" size={21} /></button>
            <button className="listening-play" aria-label={toggleLabel} disabled={!ready} onClick={props.onToggle}><Icon name={playing || (waiting && !held) ? 'pause' : 'play'} size={18} />{waiting ? held ? 'Resume' : 'Hold' : playing ? 'Pause' : 'Play'}</button>
            <button className="icon-button" aria-label="Next setlist piece" disabled={!next} onClick={() => props.onMove(1)}><Icon name="next" size={21} /></button>
            {waiting && <button className="listening-now" disabled={!ready} onClick={props.onNow}>Start now<Icon name="next" size={14} /></button>}
          </div>
          <div className="listening-next"><span>UP NEXT</span><div><strong>{next?.title ?? 'The end of this setlist'}</strong><span>{next?.composer || (next ? 'From your collection' : 'A quiet moment to finish.')}</span></div></div>
        </>}
        {complete && <div className="listening-finish-actions"><button className="primary-button" onClick={props.onReplay}><Icon name="restart" size={16} />Replay setlist</button><button onClick={props.onRecaps}>View sessions</button></div>}
        {props.error && <p className="listening-error" role="alert">{props.error}</p>}
      </div>
    </div>
    <footer className="listening-footer"><label>Breathing space<select aria-label="Breathing space" value={props.gap} onChange={(e) => props.onGap(Number(e.target.value))}>
      {LISTENING_GAPS.map((seconds) => <option key={seconds} value={seconds}>{seconds ? `${seconds} seconds` : 'No pause'}</option>)}</select></label>
      <span>{!complete && <>Space to {waiting ? held ? 'resume' : 'hold' : playing ? 'pause' : 'play'} <span>·</span> </>}Escape to return to the score</span>
    </footer>
  </section>
}
