# Keyboard (MIDI input)

How the game hears the player. **Status (2026-10-09): built** — `src/engine/input.ts` and the
MIDI monitor (`src/ui/MidiMonitor.tsx`), tested with the computer keyboard and with raw MIDI
bytes. Jason confirmed MIDI-to-PC sound works and free-play delay feels acceptable on
2026-10-09; full range, velocity limits, pedal and hot-plug are still unchecked. The audio monitor has an own-sound checkbox
(session-only, defaults on); the key-range setup and persistent setup are still not built.
The MIDI facts below are from the MIDI standard; what Jason's keyboard actually
sends is unknown until he runs the MIDI monitor.

## Jason's keyboard

| | |
|---|---|
| Model | Donner DEP-20 digital piano (Jason, 2026-10-09) |
| Keys / range | 88 keys — expect 21–108; confirm in the MIDI monitor |
| Own sound (speakers or headphone out) | Yes, it is a digital piano with its own voices. So the game does not sound Jason's notes by default. _Confirm with Jason: he hears it without the PC._ |
| Sustain pedal | Yes, on/off (no half-pedalling). Polarity unknown — monitor |
| Connection | MIDI input and PC playback confirmed by Jason, 2026-10-09; hot-plug still needs hardware test |

## What the game reads

All MIDI numbers live in `src/engine/input.ts`. The rest of the code sees `NoteEvent`s.

| Message | Bytes | Meaning for the game |
|---|---|---|
| Note On | `9n note velocity` | a key went down; velocity 1–127 = how hard |
| Note Off | `8n note velocity` | a key came up |
| Note On with velocity 0 | `9n note 00` | **also a key up** — many keyboards send this instead of Note Off |
| Sustain pedal | `Bn 40 value` (CC 64) | ≥ 64 = down. Some pedals send the full 0–127 range (half-pedalling) |
| Active Sensing, Clock | `FE`, `F8` | sent constantly by many keyboards — ignore, and keep them out of the monitor log |

- `n` is the MIDI channel. Accept every channel.
- Notes are numbers: **middle C = 60 (C4)**; one semitone per number.
- Soft pedal (CC 67) and sostenuto (CC 66) exist; ignore them until a mission needs them.

**Common key ranges** (lowest–highest note number):

| Keys | Range | Notes |
|---|---|---|
| 88 | 21–108 | A0–C8, a full piano |
| 76 | 28–103 | E1–G7 |
| 61 | 36–96 | C2–C7 |
| 49 | 36–84 | C2–C6 |
| 25 | 48–72 | C3–C5 — too small for two hands |

Keyboards with an octave-shift button move these ranges, so never assume one from the model.
A setup step asks the player to press their lowest and highest key and stores the range;
missions and pieces that don't fit are shown as "needs more keys".

## Does the keyboard make its own sound?

A setting, asked once at setup:

As built before setup exists: enable sound in the audio monitor, then use its
"My MIDI keyboard makes its own sound" checkbox. It defaults on for the DEP-20. Computer
keys and bot demos always use the game's sampled voice. Enabling own sound silences any
MIDI voices already playing. The setting is not yet saved between page loads.

The audio monitor explicitly shows whether MIDI notes are muted. **Play MIDI through
computer** enables sound and unchecks own-sound in one click; use this when you want the
game to sound your playing through the PC. Receiving MIDI/velocity alone does not enable
browser audio.

- **Yes (digital piano, or a keyboard with speakers):** the player hears their own notes from
  the keyboard with no delay. The game does **not** sound the player's notes (they would be
  doubled, slightly late). It still plays the metronome, the accompaniment and bot demos.
- **No (a plain MIDI controller):** the game sounds the player's notes through the piano
  voice. They arrive late by the browser's output latency — see ARCHITECTURE.md › Timing.

## Timing

A MIDI event carries a timestamp on the `performance.now()` clock. The input layer passes it
on unchanged; the game converts it to the audio clock and judges the note against the beat
the player was hearing (ARCHITECTURE.md › Timing model). Never judge a note at the time the
code happened to handle it.

## Computer-keyboard fallback

For testing without a MIDI keyboard. Same `NoteEvent`s, fixed velocity.

| Keys | Notes |
|---|---|
| `A S D F G H J K` | C4 D4 E4 F4 G4 A4 B4 C5 |
| `W E T Y U` | C♯4 D♯4 F♯4 G♯4 A♯4 |
| `Z` / `X` | octave down / up |
| `Space` | sustain pedal |

## MIDI monitor

An in-game screen that lists incoming messages (raw bytes, note name, velocity, timestamp)
and shows which keys and pedal are down. It is how Jason verifies anything an agent can't.
As built it is under **Sound setup and MIDI monitor** below the opening piece player. It
also sums up what it has seen: lowest and highest
key, softest and hardest velocity, how "key up" is sent, and whether the pedal is on/off or
continuous — the answers to the list below.

## Needs hardware test (Jason)

- The keyboard appears, and plugging it in while the game runs is picked up.
- Lowest and highest key numbers; whether Note Off or Note On-velocity-0 is sent.
- Velocity range when playing very softly and very hard (some keyboards never reach 127).
- Sustain pedal: on/off or continuous, and whether it is inverted (some pedals are).
- With own sound off: free-play delay confirmed acceptable by Jason, 2026-10-09. Still check
  the timing/feel while playing the actual piece.
