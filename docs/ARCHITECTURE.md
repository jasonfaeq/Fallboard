# Architecture

**Status (2026-10-09): mostly planned.** Built so far: `engine/input.ts` (every input goes
through `Input.send`; `window.__piano = { input, send }`), `ui/Keyboard.tsx`,
`ui/MidiMonitor.tsx`, and the VexFlow staff spike `ui/StaffSpike.tsx` (D-16). The rest is the
target shape, taken from DJ Trainer's proven structure and adapted to notes. Keep this file true: when you build a part,
describe how it actually works and drop the word "planned".

## Overview

```
 MIDI keyboard ──MIDI──▶ Input (input.ts) ◀── computer-keyboard fallback
                            │ NoteEvent { on | off | pedal, note, velocity, t }
                            ▼
 Score (score.ts) ──▶ Engine (audio.ts): Transport + metronome + limiter
   pieces, phrases        │  Piano voice (piano.ts): player's notes, bot, accompaniment
                          │  beatAt(), heardBeat()
                          ▼
               Mission Run  ◀── the same NoteEvents
                 game/ runner + src/content mission files (one file per mission)
                 snapshot → matcher → steps → scoring;  level flow;  bot
                          │
                          ▼
               React UI (App.tsx, ui/*) — Staff, falling notes, on-screen keyboard, HUD
```

Event order for every input: `Input.emit` → App `dispatch(ev)` → engine (sound the note) →
`run.onEvent(ev)` (the mission judges it). Bots send through the same `dispatch` (exposed as
`window.__piano.send`).

Each frame the runner builds one read-only `Snapshot` (MISSIONS.md), feeds new note events to
the matcher, updates the active step, then the bot. The level flow is a small state machine
around the steps: `countIn` → `steps` → `ending` → `done`.

## Timing model (the important part)

- **Clock:** `AudioContext.currentTime`. All musical decisions use it.
- **Transport:** the position in the piece, in beats, is computed, not counted: a beat
  anchor + an audio-clock anchor + the current speed. Every speed change, pause or resume
  re-anchors first, so `beatAt(t)` stays exact. Count-in beats are negative; bar 1 beat 1 is
  beat 0.
- **Wait mode** pauses the transport on a group's beat and resumes when the right keys are
  down. **Tempo mode** runs it at `rate` × the piece's tempo. **Performance** never pauses.
- **Scheduling:** the metronome, the accompaniment and bot notes are scheduled a short way
  ahead on the audio clock. A timer may wake the scheduler; only the audio clock decides when
  a sound happens.
- **Input time:** a MIDI event's timestamp is on the `performance.now()` clock. Convert it to
  the audio clock with the measured offset between the two clocks, not with "now".
- **Heard beat:** the player plays along with what they *hear*, which is the audio clock minus
  the output latency. So a note is judged at `beatAt(inputTime − latency)`. Latency =
  `baseLatency + outputLatency` of the AudioContext (DJ Trainer's `engine/audio.ts` does this).
- **Latency is the main technical risk.** If the keyboard has no sound of its own, the player
  hears their own notes late by the output latency. A digital piano with its own sound avoids
  this (the game then doesn't sound the player's notes — KEYBOARD.md). Phase 1 measures it
  with Jason and decides whether a calibration setting is needed.

## Modules (planned)

| File | Responsibility |
|---|---|
| `engine/audio.ts` | `Engine` (AudioContext with `latencyHint: 'interactive'`, limiter, metronome) and `Transport` (tempo, rate, `beatAt`, `timeAtBeat`, pause/resume) |
| `engine/piano.ts` | the piano voice: note on/off with velocity and sustain; first synthesised (D-09) |
| `engine/score.ts` | `Score` (notes with pitch, start, length, hand, finger; bars, time and key signature, tempo, sections) and the small text notation |
| `engine/input.ts` | Web MIDI (hot-plug), `NoteEvent`s, sustain pedal, key-range setup, MIDI monitor log, computer-keyboard fallback. All MIDI numbers live here |
| `game/core.ts` | shared types: `Hud`, `Run`, `Assist`, `gradeMs` |
| `game/snapshot.ts` | the read-only state snapshot and its builder |
| `game/matcher.ts` | played notes ↔ score notes: hits, misses, extras, timing per note and per hand |
| `game/step.ts` | step lifecycle, `sequence`, `parallel` |
| `game/scoring.ts` | grades, weighted mission score |
| `game/mission.ts` | `MissionSpec`, `defineMission`, the runner (`startMission` → `Run`), results |
| `game/level.ts` | level flow state machine: count-in, ending, time-out/quit |
| `game/bot.ts` | bot format, `playScore()`, the bot runner |
| `game/recital.ts` | recitals: programme, crowd meter, streak, encore |
| `game/validate.ts` | mission and piece checks for `npm run validate` |
| `game/progress.ts`, `game/career.ts` | XP/stars/levels and unlock rules (copied from DJ Trainer) |
| `content/templates/*.ts` | step templates |
| `content/pieces/*.ts` | one piece per file |
| `content/venues/*/*.ts` | one mission per file; `content/index.ts` registers them all (glob) |
| `ui/Staff.tsx` | the grand staff: notes, cursor, hit/miss colours (renderer: D-08, open) |
| `ui/Highway.tsx` | falling notes (canvas), aligned with the on-screen keyboard |
| `ui/Keyboard.tsx` | on-screen keyboard: held keys, target keys at Full assist |
| `ui/Results.tsx`, `ui/CareerScreen.tsx` | results tally, career map (patterns from DJ Trainer) |
| `App.tsx` | screens, game loop (`requestAnimationFrame`) |

`src/engine/` knows nothing about React or missions; `src/game/` nothing about the DOM.

## Persistence (localStorage, per browser)

Planned keys: `pianotrainer.progress.v1` (XP, best scores) · `pianotrainer.settings.v1`
(own-sound, key range, volumes) · `pianotrainer.unlockAll.v1`. All access wrapped in
try/catch. Don't add `localStorage` or `navigator.requestMIDIAccess` calls outside the files
that own them (`progress.ts`, `input.ts`, a settings module), so a desktop build can swap them
later.

## Build & run (after Phase 0)

- `npm run dev` for playing; `npm run build` → `dist/`.
- Jason starts the game with `start.bat`.

## Testing (planned)

Playwright plays every mission with its **bot** through the real input path and asserts the
results screen shows at least two stars. No MIDI keyboard is needed. Music runs at its real
speed on the audio clock, so keep test pieces short.

- On Jason's PC the bundled Chromium is not installed: configure Playwright with
  `channel: 'msedge'`. Don't run `npx playwright install` without asking.
- `npm test` type-checks the tests, builds the app, starts Vite preview on its own port, runs
  one worker with no retries (audio timing must be consistent), and stops the server.
- `window.__piano.send(ev)` feeds the same path as the keyboard; `window.__piano.runBot()`
  plays the current mission's bot. Never set engine or mission state directly in a test.
- The matcher and scoring are pure functions of note lists: test them with synthetic input
  as well (late notes, wrong notes, repeated notes, chords), without a browser page.

Headless tests verify software behaviour. Velocity range, pedal polarity, latency and how a
mission feels under the fingers still **need hardware test**.

## Known risks

- **Output latency** for keyboards without their own sound (see Timing model).
- **Staff rendering** is the largest unknown piece of UI work (D-08 spike).
- **Velocity curves differ per keyboard**, so loud/soft must be judged as contrast, not as
  absolute numbers.
- **Repeated notes and fast passages** stress the matcher's windows; test them early.
