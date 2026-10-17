# AGENTS.md — Fallboard

Instructions for every AI coding agent working in this repo (Claude, Codex, Antigravity, …).
This file is the single source of truth; `CLAUDE.md` just points here.

## What this is

**Fallboard (formerly Piano Trainer) is, for now, a piano sheet music reader** (D-20): import a score downloaded
from MuseScore (MusicXML or `.mscz`), see it as sheet music, as falling keys onto a keyboard, or both,
with 1–4 rows of music on screen, and hear it played on a sampled grand piano. It is built
for one player, Jason, with the intent to sell it (Steam + paid web version) if it clearly
works. Build for Jason now; don't block the path to selling later.

**The MIDI trainer is parked (2026-10-14, D-20).** The Guitar Hero–style game (MIDI keyboard
input, Play along / Practise modes, missions, career, recitals) is in `parked/midi-trainer/`
with its code, tests and docs, plus a README on bringing it back. Don't build trainer
features unless Jason asks; don't edit the parked folder except to keep it restorable.

**State (2026-10-16):** the reader is built: MusicXML/`.mxl` and MuseScore `.mscz` import
(D-25) with a browser library,
Sheet/Keys/Both views, rows fitted to the panel, playback with playhead, lit notes, repeats,
speed, loops, count-in, metronome, muting a hand, transposition, shortcuts and remembered
settings. Open items are in `docs/ROADMAP.md` Phase R. When you build something, change its
doc from "planned" to "as built" so the docs stay true.

The sibling project **DJ Trainer** (`C:\Users\Jason\Main Folders\Projects\DJ Trainer`) is a
read-only reference; it matters again only when the trainer comes back. Never edit it.

Start every task like this (keeps context small — every chat starts from zero):

1. Run `npm run brief`: git state, open roadmap items, a one-line index of all decisions.
2. Read `docs/VISION.md` — direction, pillars, non-goals. **Always** (it's short).
3. Read only the doc for your area, and only the sections your task touches:
   - code structure / timeline / playback / sheet layout / testing → `docs/ARCHITECTURE.md`
   - score files / importing / piano sound / licensing → `docs/MUSIC.md`
   - the parked trainer → `parked/midi-trainer/README.md` first
4. `docs/ROADMAP.md` and `docs/DECISIONS.md`: open the full file only when your task ticks a
   roadmap item, adds a decision, or touches a decision in the brief's index. Decisions are
   settled — don't relitigate them silently; if you think one is wrong, say so and propose a
   new entry.

## Stack & commands

- Vite 5 + React 18 + TypeScript (strict). Web Audio API for sound. OpenSheetMusicDisplay
  draws the music (D-21). No backend, no server state.
- Target runtime today: Chrome / Edge on Windows, served from localhost.

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # tsc --noEmit + vite build
npx tsc --noEmit     # type-check only
npm run validate     # check the built-in scores
npm run check        # tsc + validate, compact output — use this while iterating
npm run brief        # orientation summary (see above)
npm test -- --reporter=line --grep "<name>"   # run only the tests you touched
```

Jason launches the app with `start.bat` (installs deps, runs `npm run dev -- --open`).

## Rules

**Scope**
- Build the **smallest working vertical slice**. Do not generalise, future-proof or add
  abstractions the docs don't ask for.
- One task = one focused change. Don't reformat or refactor files outside your task.
- Other agents may work in this repo too. Keep changes small and self-contained.

**Architecture**
- `src/engine/` (audio, clock, note numbers) knows nothing about React or scores.
  `src/reader/` (timeline, player, library, prefs) knows nothing about the DOM, apart from
  storage in `library.ts` and `prefs.ts`. `src/ui/` renders state and forwards input.
- **Musical timing comes from the audio clock only**: the `Transport`,
  `AudioContext.currentTime`. Never use `setTimeout`, `Date.now()` or frame counts to decide
  when a note sounds. `performance.now()` and animation frames are for drawing only.
- The timeline is built from OSMD's parsed model, not from the drawing; the sheet maps it to
  positions after each render (ARCHITECTURE.md). Sheet and keys are always driven by the same
  `Timeline` and `Player.time`.
- All MIDI note-number helpers live in `src/engine/notes.ts`. Never hardcode note numbers or
  the OSMD half-tone offset elsewhere.
- Built-in scores are MusicXML files in `src/content/scores/`, listed in
  `src/reader/library.ts` (D-23).

**Token & time budget**
- Prefer `npm run check` and targeted `npm test -- --grep …` while iterating; run the full
  `npm test` and `npm run build` once, at the end.
- Never start `npm run dev`, `npm run preview` or `start.bat` — they never exit. Playwright
  starts its own server.
- Never read: `package-lock.json`, `dist/`, `node_modules/`, `test-results/`,
  `src/content/scores/*.musicxml` (large; grep them). In DJ Trainer also never read
  `DJ-Trainer.html`, audio files, `.venv-analysis/`, `.analysis-temp/`; grep instead of
  reading its `src/App.tsx`.
- Don't spawn sub-agents for normal tasks; each one re-reads all context.
- Reviews read the diff (`git diff main...HEAD`), not the whole repo.

**Dependencies & licences**
- Only permissive licences: MIT, BSD, ISC, Apache-2.0, zlib. **No GPL/AGPL/LGPL code** — that
  rules out copying from MuseScore, PianoBooster, LilyPond or Verovio.
- Ask Jason before adding any dependency; prefer a few lines of our own code. Approved:
  OpenSheetMusicDisplay, pinned to 2.1.3 (D-21). VexFlow 5 (D-16) was removed with the parked
  trainer.

**Music**
- Built-in pieces are **public-domain compositions in our own transcriptions**, or original.
  Never commit someone else's arrangement, a downloaded MusicXML/MIDI file of a copyrighted
  song, or a sample library without a licence that allows bundling in a paid app. Imported
  scores stay in the browser. See MUSIC.md.

**Listening and hardware**
- Agents can't hear the result. Anything that depends on listening or the room (how
  playback sounds, latency, whether a real MuseScore download looks right) must be listed as
  **"needs Jason"** in your summary.

## Definition of done

- `npx tsc --noEmit` and `npm run build` pass.
- The feature was exercised: in the browser, or headlessly with Playwright
  (ARCHITECTURE.md › Testing).
- Docs updated where relevant: tick items in `docs/ROADMAP.md`, add an entry to
  `docs/DECISIONS.md` for any real choice you made, and turn "planned" into "as built" in the
  doc you implemented.
- Your summary says what changed, how you tested it, and what needs Jason.

## Code map

```
src/engine/audio.ts      Engine: AudioContext, volume, limiter, room echo, click(); Transport (audio clock)
src/engine/piano.ts      the sampled Salamander piano (channels 'score' and 'touch')
src/engine/notes.ts      MIDI note numbers, names, piano range, OSMD half-tone conversion
src/reader/timeline.ts   OSMD MusicSheet → Timeline: sounds, marks, passes, steps, clicks, staves
src/reader/player.ts     plays a Timeline: play/pause/seek, speed, loop, count-in, metronome, hand volumes
src/reader/library.ts    built-in scores, imported files in IndexedDB, file-type checks
src/reader/mscz.ts       MuseScore .mscz/.mscx → MusicXML (our own reader; unzip, convert)
src/reader/prefs.ts      remembered settings (localStorage)
src/content/scores/      built-in MusicXML pieces
src/ui/SheetView.tsx     OSMD rendering, rows fit, playhead, lit notes, click-to-seek, loop boxes
src/ui/KeysView.tsx      falling notes (canvas) + Keyboard.tsx
src/ui/Library.tsx       the Scores drawer: import, open, delete
src/ui/Scrubber.tsx      position bar with bar ticks and the loop
src/ui/Settings.tsx      the settings popover: speed presets, speed up loops, transpose, display, volumes, room
src/ui/Icons.tsx         our own line icons
src/App.tsx              screen layout (top bar, stage, dock), shortcuts, drag-and-drop, rAF redraw
parked/midi-trainer/     the parked MIDI trainer (not compiled, not tested)
```

Shortcuts: Space play/pause · Home start · ← → bar · G go to bar · ↑ ↓ speed · L loop ·
[ ] previous/next section · M metronome · Shift+M metronome only · 1–4 rows · S/K/B view · N note names · F full screen · O scores · ? help. Debug handle in the console:
`window.__piano = { engine, player, timeline, osmd }`.
