# Parked: the MIDI trainer (D-20, 2026-10-14)

Jason put the MIDI work on hold and asked for a sheet music reader first. This folder is a
complete snapshot of the app as it was on 2026-10-14, just before the switch. It includes the
**Play along** and **Practise (waits for you)** modes, which were uncommitted work at that
point. Nothing here is compiled, bundled or tested: `tsconfig.json` only includes `src/`, and
Playwright only runs `tests/e2e/`.

## What is here

| Path | What it was |
|---|---|
| `src/engine/input.ts` | Web MIDI input (note on/off, velocity, sustain pedal), computer-keyboard fallback, monitor stats |
| `src/engine/audio.ts` | the engine with MIDI routing (`onEvent`, own-sound muting, `heardBeat`) and its own metronome scheduler |
| `src/engine/score.ts` | the text-notation Score model (D-18/19) |
| `src/content/pieces/` | Chopin and Bach in that notation (now `src/content/scores/*.musicxml`) |
| `src/game/player.ts` | the piece player: Listen, Play along, Practise (wait mode), guide sound, sections, hands |
| `src/ui/` | `PlayScreen`, VexFlow `Staff` and `StaffSpike`, `Highway`, `Keyboard`, `MidiMonitor`, `AudioMonitor` |
| `src/App.tsx`, `src/styles.css` | the trainer's screen |
| `tests/` | its Playwright tests (input, audio, score, staff, player) |
| `tools/validate.mjs` | the text-notation piece validator |
| `docs/` | VISION, ROADMAP, ARCHITECTURE, MUSIC as they were, and KEYBOARD, MISSIONS, CURRICULUM, PORTING |
| `AGENTS.md`, `package.json` | the instructions and dependencies of that version |

## Bringing it back

The best path is to rebuild the trainer **on top of the reader** rather than restoring the
old screen. The reader already has what the trainer was missing: real scores from MuseScore,
a timeline with repeats, and a sheet that maps every note to the screen.

1. Write a new decision entry (it supersedes D-20) and update VISION/ROADMAP.
2. Bring back `src/engine/input.ts`. Its pitch helpers now live in `src/engine/notes.ts`;
   import them from there instead of keeping two copies. Add the MIDI routing from the parked
   `audio.ts` (`onEvent`, `keyboardOwnSound`, `audioTime`, `heardBeat`) to the current
   `Engine`, which keeps the Transport, piano and `click()`.
3. Port the modes in `src/game/player.ts` to read a reader `Timeline` instead of a `Score`.
   Groups of notes become sounds that share a start time. The wait mode's pause-at-group
   logic carries over.
4. Bring back the MIDI monitor (`MidiMonitor.tsx`), the tests in `tests/e2e/input.spec.ts`
   and `player.spec.ts`, adapted to the reader screen. Then the mission docs: KEYBOARD,
   MISSIONS, CURRICULUM, PORTING.
5. Re-add `vexflow@^5` only if the old `Staff.tsx` is wanted; the reader draws with OSMD.

To see the old app exactly as it was, check out the commit that added this folder, copy
`parked/midi-trainer/src`, `tests` and `tools/validate.mjs` over the live ones, restore
`package.json` from here, and run `npm install`.

## Still open from that work

- The DEP-20 hardware checks (KEYBOARD.md › Needs hardware test), Practise and Play along on
  the real keyboard, and the latency check.
- Jason's listening confirmation of the Chopin and Bach transcriptions. That still applies:
  they are the reader's built-in pieces.
