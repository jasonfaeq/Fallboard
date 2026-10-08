// Screen flow and game loop live here (ARCHITECTURE.md). So far: the MIDI monitor.
import { useEffect, useReducer, useRef } from 'react'
import { Input, type NoteEvent } from './engine/input'
import MidiMonitor from './ui/MidiMonitor'
import StaffSpike from './ui/StaffSpike'

declare global {
  interface Window {
    /** debug handle; bots and tests send through the same path as the keyboard */
    __piano: { input: Input; send: (e: NoteEvent) => void }
  }
}

export default function App() {
  const [, redraw] = useReducer((n: number) => n + 1, 0)
  const inputRef = useRef<Input>()
  if (!inputRef.current) inputRef.current = new Input()
  const input = inputRef.current

  useEffect(() => {
    input.onChange = redraw
    window.__piano = { input, send: (e) => input.send(e) }
    void input.initMidi()
    return input.attachKeyboard(window)
  }, [input])

  return (
    <main className="shell">
      <h1>Piano Trainer</h1>
      <StaffSpike />
      <MidiMonitor input={input} />
    </main>
  )
}
