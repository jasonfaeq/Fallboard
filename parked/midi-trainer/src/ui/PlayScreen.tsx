import { useEffect, useReducer, useState } from 'react'
import { noteName, type Input } from '../engine/input'
import type { PiecePlayer } from '../game/player'
import Staff, { type Assist } from './Staff'
import Highway from './Highway'
import Keyboard from './Keyboard'

const MODE_LABEL = { listen: 'Listening', play: 'Playing along', wait: 'Practising' } as const

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
      <button onClick={() => void player.start('listen')}>Listen</button>
      <button onClick={() => void player.start('play')} title="The line keeps moving; you play">Play along</button>
      <button onClick={() => void player.start('wait')} title="The line stops at each note until you play it">Practise · waits for you</button>
      <button disabled={player.engine.status === 'loading'} onClick={() => {
        player.engine.keyboardOwnSound = false
        void player.engine.start()
      }}>Play MIDI through computer</button>
      <button disabled={player.state === 'idle' || player.state === 'done'} onClick={() => player.state === 'paused' ? player.resume() : player.pause()}>{(player.state === 'paused' ? 'Resume' : 'Pause') + (player.mode === 'listen' ? ' listening' : '')}</button>
      <button disabled={player.state === 'idle'} onClick={() => player.stop()}>Stop</button>
      <label>Section <select aria-label="Section" value={section} onChange={(e) => {
        const value = e.target.value
        setSection(value)
        player.setRange(value === 'all' ? [1, score.bars.at(-1)!.number] : score.sections[Number(value)].bars)
      }}><option value="all">Whole piece</option>{score.sections.map((s, i) => <option key={s.name} value={i}>{s.name}</option>)}</select></label>
      <label>Hands <select aria-label="Hands" value={player.hands} onChange={(e) => {
        player.stop()
        player.hands = e.target.value as typeof player.hands
      }}><option value="both">Both</option><option value="R">Right only</option><option value="L">Left only</option></select></label>
      <label>Speed <select aria-label="Playback speed" value={player.engine.transport.rate} onChange={(e) => player.setRate(Number(e.target.value))}>
        <option value="0.5">50%</option><option value="0.75">75%</option><option value="1">100%</option></select></label>
      <label>View <select aria-label="View" value={assist} onChange={(e) => setAssist(e.target.value as Assist)}>
        <option value="full">Full · staff + falling notes</option><option value="staff">Staff · moving cursor</option><option value="page">Page · still score</option></select></label>
      <label><input type="checkbox" checked={player.loop} onChange={(e) => { player.loop = e.target.checked; redraw() }} /> Loop section</label>
      <label title="Off: you hear only your own notes"><input type="checkbox" checked={player.guide} onChange={(e) => { player.guide = e.target.checked; redraw() }} /> Hear the piece while I play</label>
      <label><input type="checkbox" checked={player.metronome} onChange={(e) => { player.setMetronome(e.target.checked); redraw() }} /> Metronome</label>
    </div>
    <div className="play-status" role="status" data-testid="player-status">
      {player.error || (player.state === 'idle' ? 'Listen to the piece, play along, or practise with the line waiting for you. You can also play freely.' :
        player.state === 'countIn' ? `Count-in · ${Math.max(1, Math.min(4, Math.ceil(player.bounds.start - player.beat)))}` :
        player.state === 'paused' ? (player.mode === 'listen' ? 'Listening paused' : 'Paused') : player.state === 'ending' ? 'Let the last bar ring…' :
        player.state === 'done' ? (player.mode === 'listen' ? 'Finished listening' : 'Section finished') :
        player.waiting ? `Your turn · play ${player.due.map(noteName).join(' · ')}` :
        `${MODE_LABEL[player.mode]} · ${bar === 0 ? 'pickup' : `bar ${bar} / ${score.bars.at(-1)!.number}`}`)}
      <span data-testid="player-beat" className="sr-only">{player.beat.toFixed(3)}</span>
    </div>
    <p className="sound-route">{player.engine.keyboardOwnSound ? 'Your MIDI keyboard supplies its own sound. Choose Play MIDI through computer to use the PC.' :
      player.engine.status === 'ready' ? 'MIDI notes play through the computer.' : 'Computer piano sound is loading or needs enabling; see sound setup below.'}</p>
    <Staff score={score} beat={player.beat} assist={assist} />
    {assist === 'full' && <div className="full-assist"><Highway score={score} beat={player.beat} start={player.bounds.start} end={player.bounds.end} /><Keyboard held={input.held} sounding={sounding} />
      <p className="hand-legend"><span>● Right hand</span><span>● Left hand</span></p></div>}
    {assist === 'full' && <p className="note-names">{player.sounding.length ? 'Now: ' + [...new Set(player.sounding.map((n) => n.pitch.name))].join(' · ') :
      next ? 'Next: ' + next.pitches.map((p) => p.name).join(' · ') : 'End of section'}</p>}
    <p className="piece-note">Listen: the game plays. Play along: the line keeps moving and you play. Practise: the line stops at each
      note until you play it; pick a section and tick Loop section to repeat a few bars. Playing is not scored yet.</p>
    <details><summary>Practice plan and source</summary><ol>{score.practice.map((p) => <li key={p}>{p}</li>)}</ol>
      <p>{score.notes}</p><p>{score.source}</p><p>{score.licence}. Notes stay unverified until you confirm them.</p></details>
  </section>
}
