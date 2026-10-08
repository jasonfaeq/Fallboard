// Screen flow and game loop live here (ARCHITECTURE.md). So far: the MIDI monitor.
import { useEffect, useReducer, useRef } from 'react'
import { Input, type NoteEvent } from './engine/input'
import MidiMonitor from './ui/MidiMonitor'
import StaffSpike from './ui/StaffSpike'
import { Engine } from './engine/audio'
import AudioMonitor from './ui/AudioMonitor'

declare global {
  interface Window {
    /** debug handle; bots and tests send through the same path as the keyboard */
    __piano: { input: Input; engine: Engine; send: (e: NoteEvent) => void }
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

  useEffect(() => {
    input.onChange = redraw
    window.__piano = { input, engine, send: (e) => input.send(e) }
    const unlisten = input.on((e) => engine.onEvent(e))
    void input.initMidi()
    const detach = input.attachKeyboard(window)
    const silence = () => engine.panic()
    window.addEventListener('blur', silence)
    return () => {
      detach()
      unlisten()
      window.removeEventListener('blur', silence)
      engine.dispose()
    }
  }, [input, engine])

  return (
    <main className="shell">
      <h1>Piano Trainer</h1>
      <StaffSpike />
      <AudioMonitor engine={engine} />
      <MidiMonitor input={input} />
    </main>
  )
}
