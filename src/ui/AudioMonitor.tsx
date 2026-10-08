import { useEffect, useReducer, useState } from 'react'
import type { Engine } from '../engine/audio'

export default function AudioMonitor({ engine }: { engine: Engine }) {
  const [, redraw] = useReducer((n: number) => n + 1, 0)
  const [ownSound, setOwnSound] = useState(engine.keyboardOwnSound)
  useEffect(() => {
    engine.onChange = redraw
    let frame = 0
    const update = () => { redraw(); frame = requestAnimationFrame(update) }
    frame = requestAnimationFrame(update)
    return () => { cancelAnimationFrame(frame); engine.onChange = () => {} }
  }, [engine])
  const ready = engine.status === 'ready' && engine.context?.state === 'running'
  return <section className="audio-monitor" aria-label="Audio monitor">
    <h2>Piano sound</h2>
    <p data-testid="audio-status" role="status">
      {engine.status === 'off' ? 'Enable sound to try the piano and metronome.' :
        engine.status === 'loading' ? 'Loading piano…' :
        engine.status === 'error' ? `Could not load piano: ${engine.error}` :
        ready ? 'Piano ready' : 'Sound suspended — enable sound to resume.'}
    </p>
    <div className="audio-controls">
      <button disabled={engine.status === 'loading'} onClick={() => void engine.start()}>Enable sound</button>
      <button disabled={!ready} onClick={() => engine.demo()}>Play piano chord</button>
      <button disabled={!ready} onClick={() => {
        if (engine.metronomeOn) { engine.setMetronome(false); engine.transport.pause() }
        else { engine.transport.resume(); engine.setMetronome(true) }
      }}>{engine.metronomeOn ? 'Stop metronome' : 'Start metronome'}</button>
      <button disabled={!ready || !engine.metronomeOn} onClick={() => {
        if (engine.transport.paused) engine.transport.resume()
        else engine.transport.pause()
        engine.tick()
      }}>{engine.transport.paused ? 'Resume' : 'Pause'}</button>
      <button disabled={!ready} onClick={() => engine.panic()}>Stop all sound</button>
      <label>Tempo <input aria-label="Tempo" type="number" min="30" max="240" value={engine.transport.tempo}
        onChange={(e) => {
          const value = Number(e.target.value)
          if (value >= 30 && value <= 240) { engine.transport.setTempo(value); engine.tick(); redraw() }
        }} /> BPM</label>
      <label>Speed <select aria-label="Speed" value={engine.transport.rate} onChange={(e) => {
        engine.transport.setRate(Number(e.target.value)); engine.tick(); redraw()
      }}>
        <option value="0.5">50%</option><option value="0.75">75%</option><option value="1">100%</option>
      </select></label>
    </div>
    <label className="own-sound"><input type="checkbox" checked={ownSound} onChange={(e) => {
      engine.keyboardOwnSound = e.target.checked; setOwnSound(e.target.checked)
    }} /> My MIDI keyboard makes its own sound (mute its notes in the game)</label>
    <p className="hint">Computer keys always use the game's piano. A–K plays C4–C5; Space holds sustain.
      If your keyboard is silent, uncheck the box above.</p>
    <p className="audio-facts">Beat <output data-testid="audio-beat">{engine.transport.beatAt().toFixed(2)}</output>
      {' · '}Reported output delay: {Math.round(engine.latency * 1000)} ms (needs hardware test)</p>
    <small>Salamander Grand Piano V3 by Alexander Holm · <a href="https://creativecommons.org/licenses/by/3.0/">CC BY 3.0</a>
      {' · '}<a href="audio/salamander/NOTICE.txt">Sample credits and source</a></small>
  </section>
}
