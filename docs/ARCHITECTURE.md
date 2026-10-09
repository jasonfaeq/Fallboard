# Architecture

**Status (2026-10-09): mostly planned.** Built so far: `engine/input.ts` (every input goes
through `Input.send`; `window.__piano = { input, engine, player, send }`), `ui/Keyboard.tsx`,
`ui/MidiMonitor.tsx`, the VexFlow staff spike `ui/StaffSpike.tsx` (D-16), and the audio
engine/monitor (D-17), score model/piece (D-18), and the Listen play screen described below.
The rest is the
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

Event order for every input: `Input.send` → App's listener → engine (sound the note) →
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
| `engine/audio.ts` | built: `Engine` (AudioContext with `latencyHint: 'interactive'`, limiter, metronome) and `Transport` (tempo, rate, `beatAt`, `timeAtBeat`, pause/resume) |
| `engine/piano.ts` | built: sampled Salamander voice, velocity gain, per-source sustain and note release (D-17) |
| `engine/score.ts` | built: typed piece/text notation, spelled events for engraving, tied/ornament sound notes, bars and sections (D-18) |
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
| `ui/Staff.tsx` | built: Score → VexFlow grand staff, rhythm/accidentals/ties/ornaments, note positions, scrolling or still page; hit/miss feedback still planned |
| `ui/Highway.tsx` | built: SVG falling notes aligned with the 88-key keyboard |
| `ui/Keyboard.tsx` | on-screen keyboard: held keys, target keys at Full assist |
| `ui/Results.tsx`, `ui/CareerScreen.tsx` | results tally, career map (patterns from DJ Trainer) |
| `App.tsx` | screens, game loop (`requestAnimationFrame`) |

`src/engine/` knows nothing about React or missions; `src/game/` nothing about the DOM.

## Audio engine (as built, 2026-10-09)

`engine/audio.ts` owns a gesture-started `AudioContext`, with `latencyHint: 'interactive'`,
master gain and a dynamics compressor configured as a limiter. `Transport` reads only its
audio-clock callback: tempo/rate changes re-anchor without jumping; `seek` accepts negative
count-in beats; `pause(beat)` pins an exact wait beat. `timeAtBeat` returns null while paused.
Tempo must be positive and practice rate is 0.5–1. `resume(at)` can anchor a future start
on the audio clock so the first count-in click can be scheduled ahead.

The 4/4 metronome schedules clicks 100 ms ahead, waking every 25 ms. A transport revision
cancels queued clicks and computes the next integer beat again; late wake-ups skip old
beats. Neither the timer nor the UI's animation frame is a musical clock.

`Engine.audioTime(t)` pairs the current performance and audio clocks to preserve the input
timestamp. `heardBeat(t)` subtracts the browser's reported base + output latency as above.
This is a browser estimate; calibration and real DEP-20 latency still need a hardware test.

`engine/piano.ts` fetches/decode-loads 30 local MP3s as one atomic bank; a failed load is
reported and can be retried. Nearest-sample playback covers A0–C8, with velocity gain and a
350 ms release. Key, MIDI and bot sources have separate held-note/pedal state; repeated
attacks and released tails are tracked separately. Maximum polyphony is 96. The single
sample layer has no velocity timbre changes, pedal noises or string resonance (MUSIC.md).

App dispatches all input to the engine before any future runner. MIDI player notes default
to muted for the DEP-20's own speakers; the computer keyboard and bot always sound.
`ui/AudioMonitor.tsx` offers enable/retry, a C-major test chord, metronome, tempo/rate,
pause/resume, stop-all and own-sound controls alongside the existing monitor/staff spike.
It explicitly reports MIDI muting; **Play MIDI through computer** starts audio and unmutes
MIDI together, so the sound setup is a single action.
Own-sound is session-only for now. Window blur, a suspended context and teardown silence
voices and stop the transport/metronome. Jason confirmed MIDI sound and acceptable free-play
delay on 2026-10-09; the real piece and pedal still need his check.

## Score and play screen (as built, 2026-10-09)

`engine/score.ts` reads the explicit text notation in MUSIC.md. Each hand/voice/bar is validated;
engraving events retain spelling, dots, tuplets, rests and ties. `soundNotes` merges tied
segments into a single attack and realises grace/turn notes. `content/pieces/chopin-op28-4.ts`
has the complete 25-bar piece plus pickup, source/licence, sections and practice plan;
`verified` is false. `content/pieces/bach-bwv846.ts` adds the complete 35-bar C-major prelude,
with two simultaneous left-hand voices (D-19); each voice has its own ties and stem direction.
`npm run validate` transpiles these data modules with the already
installed TypeScript into an OS temporary directory and imports them for structural checks.
Mission validation is still planned.

`game/player.ts` is the Listen player, not the mission runner. A 25 ms wake-up schedules
notes 100 ms ahead using `Transport.timeAtBeat` and the sampled voice. Flow is a four-quarter
count-in → selected bars → 500 ms ring-out → finished, or another count-in when looping.
Pause silences demo voices; resume/rate changes cancel queued voices, re-anchor and restore
notes still in progress (with a fresh sampled attack). Timing comes only from the audio
clock. The UI derives its cursor from that clock minus reported output latency. Listen
uses accompaniment scheduling directly; the future bot still must use the input path.

App's Piece selector switches between Chopin and Bach. It stops the old Listen player and
creates the selected player on the existing engine, resets section/view controls and updates
the debug handle. Stop also cancels a Listen request waiting for sample loading, preventing
an old piece from starting after switching. Input/audio lifetime is independent of selection.

`ui/PlayScreen.tsx` is the opening screen: one control strip, grand staff above falling notes
and 88 keys. Full shows hand colours, falling notes, sounding/held keys and note names;
Staff shows only the moving staff; Page is a still complete score without a cursor or hand
colours. VexFlow is redrawn only for score/page layout changes; animation moves its SVG.
Sections (including the pickup with section 1), loop, 50/75/100% speed, metronome and the
one-click MIDI sound button work. The sound/MIDI monitor remains in a collapsible diagnostic
panel. Wait, timed/guide modes, matcher, bots, scoring/results and career remain later items.

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

Audio tests exercise Transport with a deterministic clock, the real input path in Edge,
offline rendering of the bundled samples (audibility, velocity, sustain/release, range and
transposition), metronome audio scheduling, timestamp conversion and failed-load retry.

## Known risks

- **Output latency** for keyboards without their own sound (see Timing model).
- **Staff rendering** is the largest unknown piece of UI work (D-08 spike).
- **Velocity curves differ per keyboard**, so loud/soft must be judged as contrast, not as
  absolute numbers.
- **Repeated notes and fast passages** stress the matcher's windows; test them early.
