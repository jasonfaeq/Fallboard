# Roadmap

Pick the next unchecked item in the lowest open phase. Items marked 🔀 can run in parallel
with others in the same phase (different files). Tick the box and add the date when done;
note anything that needs a hardware test.

## Phase 0 — Scaffold (done 2026-10-09)

- [x] Direction + docs (`AGENTS.md`, `docs/`) — 2026-10-04
- [x] **Jason answers the open questions** in VISION.md (keyboard, level, goal pieces) —
      2026-10-09. Still open: which Bach C minor prelude.
- [x] **Play-screen mockup** agreed with Jason before any UI code (D-13) — 2026-10-09,
      "fine for now": https://claude.ai/artifact/2iqCk2CmCB383DTbK965LB (staff on top under a
      fixed playhead, falling notes onto 88 keys below, one control strip; gold = right hand,
      blue = left, red = miss).
- [x] **Git repo** initialised; `.gitignore` covers `node_modules`, `dist`, `test-results`
      and the personal scores folder — 2026-10-09 (branch `main`, scaffold `0266f2c`,
      input/staff `7a37be8`).
- [x] **Project setup copied from DJ Trainer** (PORTING.md › Copy): `package.json`, Vite and
      TypeScript config, `index.html`, `start.bat`, Playwright config on Edge, `tools/brief.mjs`,
      the `.claude` hooks. An empty app that builds, and one passing test that opens it —
      2026-10-09. Tests run on port 4183. `tools/validate.mjs` is a placeholder until
      `game/validate.ts` exists.

## Phase 1 — The piece player (D-13)

One real piece, both hands, from keyboard to results: Chopin's Prelude in E minor.

- [x] 🔀 **Input**: Web MIDI note on/off, velocity and sustain pedal as `NoteEvent`s;
      computer-keyboard fallback; MIDI monitor screen (KEYBOARD.md) — 2026-10-09.
      *Needs hardware test: the DEP-20 in the monitor (KEYBOARD.md › Needs hardware test).*
- [x] 🔀 **Engine**: `Transport` on the audio clock (tempo, `beatAt`, rate, pause/resume),
      metronome clicks, the sampled piano voice after its licence check (D-14/D-17) —
      2026-10-09. Audio monitor controls and local samples; no new dependency.
      MIDI sound and acceptable free-play delay confirmed by Jason, 2026-10-09.
      *Needs hardware test: sustain and timing/feel while playing the real piece.*
- [x] 🔀 **Score model** + the text notation (two hands, chords, ties, accidentals), and the
      complete Chopin transcription — 2026-10-09 (D-15/18). Includes pickup, triplets,
      grace notes and final chords; piece validator built. *Needs Jason: listen and confirm
      the notes; `verified` remains false.*
- [x] **Staff rendering spike** → VexFlow (D-16) — 2026-10-09. Drawn: grand staff, per-note
      colours, note x positions. Not yet: the playhead, scrolling, drawing from the Score.
- [x] **Play screen**, built to the recorded mockup layout: staff, optional falling notes and
      88-key keyboard, Full/Staff/Page toggle, 50/75/100% speed and section loop — 2026-10-09.
      Listen with count-in/pause/resume and bar ending is playable. *Needs Jason's visual
      and listening check; source mockup URL was inaccessible during implementation.*
- [ ] **Modes**: Listen, Wait, Play in time, Play with guide — as the templates `listen`,
      `playWait`, `playInTime` (guide is a setting on the last two). All four are built in
      `game/player.ts` and playable (2026-10-09), unscored; turning them into reusable
      templates waits for the mission engine. *Needs hardware test: Practise and Play along
      on the DEP-20.*
- [ ] **Mission engine**: snapshot, matcher, steps, scoring, runner, level flow (count-in →
      steps → ending → results), bot runner, validator (MISSIONS.md); results screen.
- [ ] **Test harness**: the bot plays the piece through the input path and gets ≥ ★★.
- [ ] **Latency check with Jason**: play the piece on the DEP-20; decide whether a
      calibration setting is needed. *Needs hardware test.*

## Phase 2 — More pieces, then Venue 1

- [x] Bach, Prelude No. 1 in C major, BWV 846 — requested and built 2026-10-09 (D-19).
      All 35 bars, independent held bass voices, nine sections and a Piece selector.
      *Needs Jason: Listen confirmation; `verified` remains false. Needs hardware test:
      playing these sustained voices on the DEP-20.*
- [ ] 🔀 Bach, Prelude in C minor (once Jason says which one).
- [ ] 🔀 Beethoven, "Moonlight" Sonata, 1st movement (triplets, pedal marks).
- [ ] The piece ladder: sections, hands separate, wait → slow → at tempo (`definePiece`);
      progress (XP, stars), with the view setting the XP multiplier (D-04).
- [ ] Trouble-spot practice: loop the bars with the most misses.
- [ ] Career map (venues, unlocks, stars per venue) — rules copied from DJ Trainer.
- [ ] 🔀 Templates `pressKeys`, `tapRhythm`, `readNote`.
- [ ] 🔀 Venue 1 missions (CURRICULUM.md), each with a bot.
- [ ] **Recital mode**: programme of pieces, one take each, crowd meter, streak, encore,
      per-piece results; `perform` template. Recital 1.12 "For the Family".

## Phase 3 — Both hands: venues 2–3

- [ ] Left hand and bass clef on the staff, the falling notes and the keyboard.
- [ ] Hands-together matching (which hand was late; chord spread).
- [ ] The game plays the other hand as accompaniment while one hand practises.
- [ ] 🔀 Venue 2 missions + Recital "Family Party"
- [ ] 🔀 Venue 3 missions + Recital "School Recital"
- [ ] `sightRead` challenge template (unseen bars, one take).

## Phase 4 — Look & feel

- [ ] Play-screen polish: staff engraving quality, falling-notes look, crowd visual.
- [ ] SFX: applause, hit/miss feedback that never covers the playing.
- [ ] Results animation and level-up moment (pattern from DJ Trainer).

## Phase 5 — Musicality + venues 4–5

- [ ] Scoring for dynamics, note length (legato/staccato), sustain pedal, tempo steadiness.
- [ ] Key signatures, scales, chords and accompaniment patterns in the Score model and staff.
- [ ] Venue 4 and 5 missions + recitals.

## Phase 6 — Your music

- [ ] MusicXML (and MIDI) import → Score; mark hands and sections in an editor screen.
- [ ] Free Play with a post-play report; "learn this piece" ladder for imported pieces.

## Phase 7 — Advanced

- [ ] Lead sheets and chord symbols; playing by ear (`echo` template); Venue 6.
- [ ] Technique venue (scales, arpeggios, speed) and the Concert Hall; performing from memory.
- [ ] Free-tempo performance (the game follows the player).

## Phase 8 — Commercial (only if it works for Jason)

- [ ] Content audit: every shipped piece and sound has a licence that allows a paid app.
- [ ] Platform layer → Tauri desktop build with native low-latency audio, Steamworks.
- [ ] Paid web version + licensing/payments.
