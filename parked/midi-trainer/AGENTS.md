# AGENTS.md — Piano Trainer

Instructions for every AI coding agent working in this repo (Claude, Codex, Antigravity, …).
This file is the single source of truth; `CLAUDE.md` just points here.

## What this is

**Piano Trainer** is a Guitar Hero–style game that teaches piano from zero on a real MIDI
keyboard. You learn pieces through levels, learn to read sheet music (falling notes are the
training wheels), then perform the pieces in front of a crowd while the game judges what the
audience hears. Right now it is built for one player — Jason — with the intent to sell it
(Steam + paid web version) if it clearly works. Build for Jason now; don't block the path to
selling later.

It is the sibling of **DJ Trainer** (`C:\Users\Jason\Main Folders\Projects\DJ Trainer`), the
same idea for DJing. That repo is the **read-only reference** for how things are built
(mission engine, bots, level flow, tests) — see `docs/PORTING.md`. Never edit it from here.

**State (2026-10-09): Phase 1 started.** Built: MIDI input, the MIDI monitor screen and a
staff-rendering spike (VexFlow, D-16), audio-clock Transport, metronome and sampled piano
(D-17), the score/text notation and complete unverified Chopin/Bach BWV 846 transcriptions
(D-18/19), a Piece selector with independent held bass voices for Bach, and
the play screen with Listen, section looping and Full/Staff/Page views. Play along and
Practise (wait) modes exist with an optional guide sound, unscored. MIDI sound and
free-play delay feel acceptable to Jason (2026-10-09); piece/score confirmation is pending.
Matching, scoring, mission flow and results are still planned. The job is
ROADMAP Phase 1, the piece player (D-13). When you build something, change its doc from "planned" to
"as built" so the docs stay true.

Start every task like this (keeps context small — every chat starts from zero):

1. Run `npm run brief`: git state, open roadmap items, a one-line index of all decisions.
2. Read `docs/VISION.md` — direction, pillars, non-goals. **Always** (it's short).
3. Read only the doc for your area, and only the sections your task touches:
   - missions / scoring / level flow / recitals → `docs/MISSIONS.md` and `docs/CURRICULUM.md`
   - MIDI keyboard / input → `docs/KEYBOARD.md`
   - pieces / score format / piano sound / licensing → `docs/MUSIC.md`
   - code structure / engine / timing / testing → `docs/ARCHITECTURE.md`
   - bringing code over from DJ Trainer → `docs/PORTING.md`
4. `docs/ROADMAP.md` and `docs/DECISIONS.md`: open the full file only when your task ticks a
   roadmap item, adds a decision, or touches a decision in the brief's index. Decisions are
   settled — don't relitigate them silently; if you think one is wrong, say so and propose a
   new entry.

## Stack & commands

- Vite 5 + React 18 + TypeScript (strict). Web Audio API for sound, Web MIDI API for the
  keyboard. No backend, no server state. Same stack as DJ Trainer.
- Target runtime today: Chrome / Edge on Windows, served from localhost.

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # tsc --noEmit + vite build
npx tsc --noEmit     # type-check only
npm run validate     # check all mission and piece files (placeholder until Phase 1)
npm run check        # tsc + validate, compact output — use this while iterating
npm run brief        # orientation summary (see above)
npm test -- --reporter=line --grep "<mission>"   # run only the tests you touched
```

Jason launches the game with `start.bat` (installs deps, runs `npm run dev -- --open`).

## Rules

**Scope**
- Build the **smallest working vertical slice**. Do not generalise, future-proof or add
  abstractions the docs don't ask for. A mission that works beats a framework that might.
- One task = one focused change. Don't reformat or refactor files outside your task.
- Other agents may work in this repo too. Keep changes small and self-contained.
- Do not build a shared "trainer framework" for both games. Copy from DJ Trainer and adapt
  (D-01).

**Architecture**
- `src/engine/` knows nothing about React or missions. `src/game/` (missions, matching,
  scoring, progress) knows nothing about the DOM. `src/ui/` renders state and forwards input.
- **Musical timing comes from the audio clock only**: `Transport.beatAt()`,
  `AudioContext.currentTime`. Never use `setTimeout`, `Date.now()` or frame counts to decide
  whether a note was on the beat. `performance.now()` is fine for UI animation and for input
  timestamps.
- Score **what the audience hears** (which notes sounded, and when), not what the screen
  showed. The game cannot see hands: never claim to judge fingering or posture.
- **The staff is the goal; falling notes are an assist.** The staff is on screen at every
  assist level. Anything that shows notes must work at Full, Staff and Page (MISSIONS.md).
- All MIDI numbers live in `src/engine/input.ts`. Never hardcode MIDI bytes elsewhere.
- Missions and pieces are **data files** built from templates (MISSIONS.md), each with a bot.
  New templates are engine work.
- Every level ends musically: count-in → play → ending → results. Never stop mid-bar.

**Token & time budget**
- Prefer `npm run check` and targeted `npm test -- --grep …` while iterating; run the full
  `npm test` and `npm run build` once, at the end.
- Never start `npm run dev`, `npm run preview` or `start.bat` — they never exit. Playwright
  starts its own server.
- Never read: `package-lock.json`, `dist/`, `node_modules/`, `test-results/`. In DJ Trainer
  also never read `DJ-Trainer.html`, audio files, `.venv-analysis/`, `.analysis-temp/`; grep
  instead of reading its `src/App.tsx`.
- Don't spawn sub-agents for normal tasks; each one re-reads all context.
- Reviews read the diff (`git diff main...HEAD`), not the whole repo.

**Dependencies & licences**
- Only permissive licences: MIT, BSD, ISC, Apache-2.0, zlib. **No GPL/AGPL/LGPL code** — that
  rules out copying from MuseScore, PianoBooster, LilyPond or Verovio.
- Ask Jason before adding any dependency; prefer a few lines of our own code. The one
  approved so far is VexFlow, the staff renderer (D-16).

**Music**
- Shipped pieces are **public-domain compositions in our own arrangements**, or original.
  Never commit someone else's arrangement, a downloaded MIDI/MusicXML file of a copyrighted
  song, or a sample library without a licence that allows bundling in a paid app. See MUSIC.md.

**Hardware**
- Agents can't touch the keyboard. Anything that depends on real hardware behaviour (velocity
  range, pedal polarity, latency, how it feels to play) must be listed as
  **"needs hardware test"** in your summary so Jason can verify it with the in-game MIDI monitor.

## Definition of done

- `npx tsc --noEmit` and `npm run build` pass.
- The feature was exercised: in the browser, or headlessly (ARCHITECTURE.md › Testing).
  New missions must be completable end-to-end by an automated run (their bot).
- Docs updated where relevant: tick items in `docs/ROADMAP.md`, update mission status in
  `docs/CURRICULUM.md`, add an entry to `docs/DECISIONS.md` for any real choice you made,
  and turn "planned" into "as built" in the doc you implemented.
- Your summary says what changed, how you tested it, and what needs a hardware test.

## Code map (planned — details in ARCHITECTURE.md)

```
src/engine/audio.ts     Engine: AudioContext, Transport (tempo, beatAt, wait/pause), limiter, metronome
src/engine/piano.ts     the piano voice: sounds the player's, the bot's and the accompaniment's notes
src/engine/score.ts     Score model (notes, bars, hands, sections) + the small text notation
src/engine/input.ts     Web MIDI + computer-keyboard fallback, note/pedal events, MIDI monitor
src/game/core.ts        shared mission types (Hud, Run, Assist), gradeMs
src/game/snapshot.ts    read-only per-frame state for steps, templates and bots
src/game/matcher.ts     lines up played notes with the score → hits, misses, extras, timing
src/game/…              step, scoring, mission (runner), level (flow), bot, validate, recital
src/game/progress.ts    XP, stars, levels (localStorage)   ← copied from DJ Trainer
src/game/career.ts      venue/mission unlock rules          ← copied from DJ Trainer
src/content/templates/  step templates (listen, playWait, playInTime, perform, …)
src/content/pieces/     one file per piece: score, sections, source, licence
src/content/venues/     one file per mission (registered automatically)
src/ui/*.tsx            Staff, falling notes, on-screen keyboard, HUD, results, career map
src/App.tsx             screen flow, game loop (rAF)
```

Computer-keyboard fallback (for testing without a MIDI keyboard): `A S D F G H J K` = the
white keys C4–C5 · `W E T Y U` = the black keys between them · `Z` / `X` octave down / up ·
`Space` sustain pedal. Debug handle in the console: `window.__piano = { engine, send, runBot, level }`.
