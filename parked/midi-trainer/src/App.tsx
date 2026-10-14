// The Listen piece player, plus the sound/input diagnostic panel.
import { useEffect, useReducer, useRef } from 'react'
import { Input, type NoteEvent } from './engine/input'
import MidiMonitor from './ui/MidiMonitor'
import { Engine } from './engine/audio'
import AudioMonitor from './ui/AudioMonitor'
import { PiecePlayer } from './game/player'
import chopin from './content/pieces/chopin-op28-4'
import bach from './content/pieces/bach-bwv846'
import PlayScreen from './ui/PlayScreen'

const pieces = [chopin, bach]

declare global {
  interface Window {
    /** debug handle; bots and tests send through the same path as the keyboard */
    __piano: { input: Input; engine: Engine; player: PiecePlayer; send: (e: NoteEvent) => void }
  }
}

export default function App() {
  const [, redraw] = useReducer((n: number) => n + 1, 0)
  const inputRef = useRef<Input>()
  if (!inputRef.current) inputRef.current = new Input()
  const input = inputRef.current
  const engineRef = useRef<Engine>()
  if (!engineRef.current) engineRef.current = new Engine()
  const engine = engineRef.current
  const playerRef = useRef<PiecePlayer>()
  if (!playerRef.current) playerRef.current = new PiecePlayer(engine, chopin)
  const player = playerRef.current

  useEffect(() => {
    input.onChange = redraw
    const unlisten = input.on((e) => { engine.onEvent(e); playerRef.current!.onEvent(e) })
    void input.initMidi()
    const detach = input.attachKeyboard(window)
    const silence = () => { playerRef.current!.pause(); engine.panic() }
    window.addEventListener('blur', silence)
    return () => {
      detach()
      unlisten()
      window.removeEventListener('blur', silence)
      playerRef.current!.stop()
      engine.dispose()
    }
  }, [input, engine])

  useEffect(() => {
    window.__piano = { input, engine, player, send: (e) => input.send(e) }
  }, [input, engine, player])

  return (
    <main className="shell">
      <h1>Piano Trainer</h1>
      <label className="piece-picker">Piece <select aria-label="Piece" value={player.score.id} onChange={(e) => {
        const score = pieces.find((p) => p.id === e.target.value)!
        player.stop()
        playerRef.current = new PiecePlayer(engine, score)
        redraw()
      }}>{pieces.map((p) => <option key={p.id} value={p.id}>{p.composer} · {p.title}</option>)}</select></label>
      <PlayScreen key={player.score.id} player={player} input={input} />
      <details className="diagnostics"><summary>Sound setup and MIDI monitor</summary>
        <AudioMonitor engine={engine} />
        <MidiMonitor input={input} />
      </details>
    </main>
  )
}
