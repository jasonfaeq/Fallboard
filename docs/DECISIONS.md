# Decisions

Dated log of settled choices. Newest at the bottom. To change one, add a new entry that
supersedes it — don't edit history.

Format: **D-nn · date · title** — decision. *Why.* (Supersedes/consequences if any.)

D-01 to D-12 were written with the first docs, before any code, from Jason's brief and from
what DJ Trainer already settled. Jason can overrule any of them with a new entry.

---

**D-01 · 2026-10-04 · A separate repo, copied from DJ Trainer** — Piano Trainer is its own
project. Code comes across by copying and adapting (PORTING.md); there is no shared library
and DJ Trainer is never edited from here. *DJ Trainer's mission engine is written against two
decks, a crossfader and phrases, so the design transfers but the code does not; a shared
framework would slow both games down.*

**D-02 · 2026-10-04 · Browser stack** — Vite + React + TypeScript, Web Audio, Web MIDI; no
Tauri/Rust yet. *Same as DJ Trainer (its D-01): fastest iteration, and the project setup can
be copied.*

**D-03 · 2026-10-04 · MIDI keyboards only** — input is MIDI note on/off, velocity and sustain
pedal. No microphone, no acoustic pianos. *MIDI is exact and identical on every keyboard, so
there is no per-model mapping; polyphonic pitch detection from a microphone is a research
project of its own.*

**D-04 · 2026-10-04 · Assist ladder: Full → Staff → Page** — Full shows falling notes, lit
keys and note names next to the staff (XP ×1); Staff shows only the staff with a moving
cursor (×1.5); Page shows the still staff like paper (×2). The staff is visible at every
level. *Falling notes alone teach the game, not the piano; the staff must always be in view
so reading is learned from the first mission.*

**D-05 · 2026-10-04 · Score what the audience hears** — right notes, timing in ms against
the beat the player was hearing, later steadiness, hands together, dynamics, note length and
pedal. Never fingering or posture. *MIDI can't see hands; scoring only what is audible keeps
the score honest.*

**D-06 · 2026-10-04 · One clock: a Transport on the audio clock** — the piece's position in
beats is computed from `AudioContext.currentTime`. Practice (wait) mode pauses the transport
until the right notes are down; tempo mode runs it at 50–100 % speed; performance never
waits. *One timing model for every mode; same rule as DJ Trainer's audio-clock timing.*

**D-07 · 2026-10-04 · Missions and pieces are data, each with a bot** — TypeScript data
modules built from step templates. A piece's default bot simply plays its score through the
normal input path; tests and the in-game Watch mode use it. *Same as DJ Trainer's D-11.*

**D-08 · 2026-10-04 · Our own Score model is the source of truth** — game logic, matching
and bots read our `Score` type only. Drills are written in a small text notation; a MusicXML
importer comes later. The staff renderer is a drawing layer fed from the Score. **Which
renderer is still open**: Phase 1 runs a short spike (candidates: VexFlow — MIT;
OpenSheetMusicDisplay — BSD-3; abcjs — MIT; or our own drawing for beginner scores) and
records the result as a new decision after asking Jason. *Keeps the game independent of any
file format or library; engraving is the one place a dependency probably earns its keep.*

**D-09 · 2026-10-04 · Synthesised piano first** — the first piano voice is built from Web
Audio oscillators and envelopes, in our own code. A sampled grand piano comes with the
look-and-feel phase, after a licence check. *No assets and no licensing in the first slice
(like DJ Trainer's procedural tracks, its D-03).*

**D-10 · 2026-10-04 · Licences** — dependencies: MIT/BSD/ISC/Apache-2.0/zlib only; no
GPL/AGPL/LGPL code. Shipped pieces: public-domain compositions in our own arrangements, or
original. Nothing copyrighted is committed. *Same as DJ Trainer's D-13; keeps the paid
version possible.*

**D-11 · 2026-10-04 · Desktop build = Tauri, later** — when the time comes, with native
low-latency audio. *Jason knows Tauri (DJ Trainer's D-14); browser output latency is the main
technical risk for keyboards without their own sound.*

**D-12 · 2026-10-04 · Shared agent instructions** — `AGENTS.md` is the single source of truth
for Claude, Codex and Antigravity; `CLAUDE.md` imports it. Design docs live in `docs/`.

**D-13 · 2026-10-09 · The piece player comes first, the career second** — the first thing
built is a player for one real piece: the staff always on screen, falling notes and lit keys
as an optional view, tempo 50–100 %, section loop, and four modes — Listen (the game plays),
Wait (the piece waits for the right notes), Play in time (a cursor moves, the game is silent
for the player's part), Play with guide (the game plays the piece too). Venues, XP and
recitals wrap around it afterwards. *Jason is a returning beginner who wants to play pieces
he knows now; the player is also the core every mission needs.* (Reorders ROADMAP phases 1–2;
the view toggle is the same ladder as D-04, which still sets the XP.)

**D-14 · 2026-10-09 · Sampled grand piano from the first slice** — the game's piano voice is
a sampled grand from Phase 1, not a synthesised one. Candidate: Salamander Grand Piano;
**verify its licence allows bundling in a paid app before using it**, and fall back to the
synthesised voice if it does not. *Listen and guide modes are how Jason learns what a piece
should sound like, and how he proof-reads a transcription; a thin synth undermines both.*
(Supersedes D-09.)

**D-15 · 2026-10-09 · Pieces are transcribed by hand, from Phase 1** — Jason hands over sheet
music and an agent writes the piece file (notes, hands, sections, suggested fingering,
practice plan). `verified` stays false until Jason has heard it in Listen mode and confirmed
the notes. Public-domain compositions are committed; anything else goes in the git-ignored
personal folder. The automatic MusicXML/MIDI importer stays a later phase. *No importer is
needed to add a few pieces, and it is the thing Jason asked for first.* (Moves part of
ROADMAP Phase 6 forward; the first pieces need more of the text notation than Venue 1 would
have — chords, ties, triplets, accidentals, two hands.)
