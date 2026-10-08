// The Listen piece player, plus the sound/input diagnostic panel.
import { useEffect, useReducer, useRef } from 'react'
import { Input, type NoteEvent } from './engine/input'
import MidiMonitor from './ui/MidiMonitor'
import { Engine } from './engine/audio'
import AudioMonitor from './ui/AudioMonitor'
import { PiecePlayer } from './game/player'
import chopin from './content/pieces/chopin-op28-4'
import PlayScreen from './ui/PlayScreen'

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
    window.__piano = { input, engine, player, send: (e) => input.send(e) }
    const unlisten = input.on((e) => engine.onEvent(e))
    void input.initMidi()
    const detach = input.attachKeyboard(window)
    const silence = () => { player.pause(); engine.panic() }
    window.addEventListener('blur', silence)
    return () => {
      detach()
      unlisten()
      window.removeEventListener('blur', silence)
      player.stop()
      engine.dispose()
    }
  }, [input, engine, player])

  return (
    <main className="shell">
      <h1>Piano Trainer</h1>
      <PlayScreen player={player} input={input} />
      <details className="diagnostics"><summary>Sound setup and MIDI monitor</summary>
        <AudioMonitor engine={engine} />
        <MidiMonitor input={input} />
      </details>
    </main>
  )
}
