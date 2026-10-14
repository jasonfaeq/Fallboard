import { type Input, noteName } from '../engine/input'
import Keyboard from './Keyboard'

const hex = (bytes: number[]) => bytes.map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ')
const range = (a: number | null, b: number | null, show: (n: number) => string) =>
  a === null || b === null ? 'nothing yet' : `${show(a)} to ${show(b)}`

const STATUS: Record<Input['midiStatus'], string> = {
  pending: 'Waiting for the browser to allow MIDI…',
  ready: 'MIDI is on.',
  denied: 'MIDI was blocked. Allow it for this page in the browser, then reload.',
  unsupported: 'This browser has no Web MIDI. Use Chrome or Edge.',
}

/** Shows exactly what the keyboard sends: how Jason checks what an agent can't (KEYBOARD.md). */
export default function MidiMonitor({ input }: { input: Input }) {
  const s = input.stats
  const pedal =
    s.pedalValues.length === 0 ? 'nothing yet'
    : s.pedalValues.length <= 2 ? `on/off (values ${s.pedalValues.join(', ')})`
    : `continuous (${s.pedalValues.length} different values)`
  return (
    <section className="monitor">
      <p className="status" data-testid="midi-status">
        {STATUS[input.midiStatus]}{' '}
        {input.midiStatus === 'ready' &&
          (input.devices.length ? `Connected: ${input.devices.join(', ')}.` : 'No keyboard found. Plug it in and switch it on.')}
      </p>

      <Keyboard held={input.held} />
      <p className={`pedal${input.pedalDown ? ' down' : ''}`} data-testid="pedal">
        Sustain pedal {input.pedalDown ? 'down' : 'up'}
      </p>

      <dl className="facts">
        <div><dt>Keys seen</dt><dd>{range(s.lowNote, s.highNote, (n) => `${noteName(n)} (${n})`)}</dd></div>
        <div><dt>Velocity seen</dt><dd>{range(s.minVelocity, s.maxVelocity, String)}</dd></div>
        <div><dt>Key up is sent as</dt><dd>{s.keyUp ?? 'nothing yet'}</dd></div>
        <div><dt>Pedal</dt><dd>{pedal}</dd></div>
      </dl>

      <div className="log-head">
        <h2>Messages</h2>
        <button type="button" onClick={() => input.clearMonitor()}>Clear</button>
      </div>
      {input.log.length === 0 ? (
        <p className="hint">
          Play your lowest key, your highest key, one very soft note, one very hard note, and press the pedal.
          Without a MIDI keyboard: A S D F G H J K play C4 to C5, W E T Y U the black keys, Z and X shift the
          octave, Space is the pedal.
        </p>
      ) : (
        <table className="log">
          <tbody>
            {input.log.map((e, i) => (
              <tr key={`${e.t}-${i}`}>
                <td className="bytes">{hex(e.bytes)}</td>
                <td>{e.label}</td>
                <td className="time">{(e.t / 1000).toFixed(3)} s</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
