import { useEffect, useReducer, useState } from 'react'
import type { Input } from '../engine/input'
import type { PiecePlayer } from '../game/player'
import Staff, { type Assist } from './Staff'
import Highway from './Highway'
import Keyboard from './Keyboard'

export default function PlayScreen({ player, input }: { player: PiecePlayer; input: Input }) {
  const [, redraw] = useReducer((n: number) => n + 1, 0)
  const [assist, setAssist] = useState<Assist>('full')
  const [section, setSection] = useState('all')
  useEffect(() => {
    let frame = 0
    const update = () => { redraw(); frame = requestAnimationFrame(update) }
    frame = requestAnimationFrame(update)
    return () => cancelAnimationFrame(frame)
  }, [])
  const { score } = player
  const bar = score.bars.find((b) => player.beat >= b.start && player.beat < b.start + b.beats)?.number ?? score.bars.at(-1)!.number
  const sounding = new Map(player.sounding.map((n) => [n.pitch.midi, n.hand]))
  const next = score.events.find((e) => e.start >= player.beat && e.start < player.bounds.end && e.pitches.length)
  return <section className="piece-player" aria-label="Piece player">
    <div className="piece-heading"><div><h2>{score.title}</h2><p>{score.composer} · {score.tempo} BPM</p></div>
      <span className="unverified">{score.verified ? 'Notes confirmed' : 'Transcription awaiting your listening check'}</span></div>
    <div className="play-controls">
      <button onClick={() => void player.listen()}>Listen</button>
      <button disabled={player.engine.status === 'loading'} onClick={() => {
        player.engine.keyboardOwnSound = false
        void player.engine.start()
      }}>Play MIDI through computer</button>
      <button disabled={player.state === 'idle' || player.state === 'done'} onClick={() => player.state === 'paused' ? player.resume() : player.pause()}>{player.state === 'paused' ? 'Resume listening' : 'Pause listening'}</button>
      <button disabled={player.state === 'idle'} onClick={() => player.stop()}>Stop</button>
      <label>Section <select aria-label="Section" value={section} onChange={(e) => {
        const value = e.target.value
        setSection(value)
        player.setRange(value === 'all' ? [1, score.bars.at(-1)!.number] : score.sections[Number(value)].bars)
      }}><option value="all">Whole piece</option>{score.sections.map((s, i) => <option key={s.name} value={i}>{s.name}</option>)}</select></label>
      <label>Speed <select aria-label="Playback speed" value={player.engine.transport.rate} onChange={(e) => player.setRate(Number(e.target.value))}>
        <option value="0.5">50%</option><option value="0.75">75%</option><option value="1">100%</option></select></label>
      <label>View <select aria-label="View" value={assist} onChange={(e) => setAssist(e.target.value as Assist)}>
        <option value="full">Full · staff + falling notes</option><option value="staff">Staff · moving cursor</option><option value="page">Page · still score</option></select></label>
      <label><input type="checkbox" checked={player.loop} onChange={(e) => { player.loop = e.target.checked; redraw() }} /> Loop section</label>
      <label><input type="checkbox" checked={player.metronome} onChange={(e) => { player.setMetronome(e.target.checked); redraw() }} /> Metronome</label>
    </div>
    <div className="play-status" role="status" data-testid="player-status">
      {player.error || (player.state === 'idle' ? 'Press Listen to hear the piece. You can also play freely on your keyboard.' :
        player.state === 'countIn' ? `Count-in · ${Math.max(1, Math.min(4, Math.ceil(player.bounds.start - player.beat)))}` :
        player.state === 'paused' ? 'Listening paused' : player.state === 'ending' ? 'Let the last bar ring…' :
        player.state === 'done' ? 'Finished listening' : `Listening · ${bar === 0 ? 'pickup' : `bar ${bar} / ${score.bars.at(-1)!.number}`}`)}
      <span data-testid="player-beat" className="sr-only">{player.beat.toFixed(3)}</span>
    </div>
    <p className="sound-route">{player.engine.keyboardOwnSound ? 'Your MIDI keyboard supplies its own sound. Choose Play MIDI through computer to use the PC.' :
      player.engine.status === 'ready' ? 'MIDI notes play through the computer.' : 'Computer piano sound is loading or needs enabling; see sound setup below.'}</p>
    <Staff score={score} beat={player.beat} assist={assist} />
    {assist === 'full' && <div className="full-assist"><Highway score={score} beat={player.beat} start={player.bounds.start} end={player.bounds.end} /><Keyboard held={input.held} sounding={sounding} />
      <p className="hand-legend"><span>● Right hand</span><span>● Left hand</span></p></div>}
    {assist === 'full' && <p className="note-names">{player.sounding.length ? 'Now: ' + [...new Set(player.sounding.map((n) => n.pitch.name))].join(' · ') :
      next ? 'Next: ' + next.pitches.map((p) => p.name).join(' · ') : 'End of section'}</p>}
    <p className="piece-note">Listen at a steady practice tempo. Playing is not scored yet.</p>
    <details><summary>Practice plan and source</summary><ol>{score.practice.map((p) => <li key={p}>{p}</li>)}</ol>
      <p>{score.notes}</p><p>{score.source}</p><p>{score.licence}. Notes stay unverified until you confirm them.</p></details>
  </section>
}
