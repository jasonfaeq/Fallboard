# Vision

_Written 2026-10-04 from Jason's brief; his answers added 2026-10-09 (see the bottom, and
D-13 to D-15). Change it only with a new entry in DECISIONS.md._

## In one line

**A Guitar Hero–style career that takes a complete beginner to playing real pieces from sheet
music in front of an audience — and then gets out of the way.**

## Who it's for (now)

One player: **Jason**. A returning beginner: reads sheet music a little, learned a few
pieces earlier in 2026 (Chopin's Prelude in E minor, Carly Comando's "Everyday") and has not
played for three months. Plays a Donner DEP-20 (88 keys, sustain pedal) on Windows. Learns
best by doing, not by reading theory first.

**What he wants first (D-13):** a **piece player**. He hands over sheet music, it becomes a
piece in the game with a practice plan, and he plays it — reading the staff, with falling
notes and lit keys as an optional view, in one of four modes: Listen, Wait, Play in time
(the game is silent for his part), Play with guide (the game plays the piece too). The
career below is built around that player, after it.

If the game makes Jason good, fast, it gets sold (Steam + paid web version). So: build it for
Jason, but never in a way that makes the commercial version hard (see "Later" below).

**Success for the "just Jason" phase:** he can play a three-piece recital (about five
minutes) from sheet music, hands together, at tempo, without stopping — with the game
closed — and can learn a new beginner piece from its sheet music alone.

## Pillars

1. **Real skills on a real keyboard.** Every mission is played on the MIDI keyboard. Skills
   must transfer to an acoustic piano and to paper sheet music. The screen shows a real grand
   staff and a real keyboard with a game layer on top — not an abstract rhythm game.
2. **Guitar Hero structure.** A career through venues (Living Room → Family Party → School
   Recital → Café → Wedding → Piano Bar → Theatre → Concert Hall). Each venue: short lessons
   and drills, a few pieces to learn, then a **Recital** — the venue's pieces played in one
   take in front of a crowd, with a crowd meter, streaks, stars and an encore.
3. **Assist → reduced assist → the page.** Every piece is learned with full visual help
   (falling notes, lit keys, note names), then from the staff with a moving cursor, then from
   the still page like real sheet music. Falling notes are training wheels: the game's job is
   to make itself unnecessary. Less assist = more XP.
4. **Judge what the audience hears.** Scoring is based on the audible result: the right notes,
   how many milliseconds off the beat, hands together, steady tempo, loud and soft, and
   whether you kept going after a mistake — not on which finger or which screen prompt.
5. **Every level is music.** Count-in → play → ending → results. Nothing cuts off mid-bar.
   Drills are short musical phrases, not beeps; pieces end on their last bar and ring out.
6. **Content as data.** A full career needs hundreds of missions and dozens of pieces.
   Pieces are score files; missions are data built from reusable templates; each has an
   automated "bot" that plays it, so any agent can prove it works.
7. **Learn the whole instrument.** By the end the player has used both hands, both clefs, the
   full keyboard, scales, chords, the sustain pedal, dynamics and articulation, key and time
   signatures — and can learn a piece without the game.

## Music

- **Missions and recitals use built-in pieces**: public-domain compositions (classical and
  traditional tunes) in our own arrangements, plus original practice phrases. A mission is
  authored around known bars, so each piece has hand-checked notes, hands and sections.
- **The game makes the sound** from note data, so there are no recordings to license.
- **Imported pieces** (MusicXML / MIDI files the player brings) come later, for Free Play and
  "learn this piece" with the same practice ladder.
- While it's just Jason, pieces he personally wants may sit in a git-ignored folder as local
  placeholders. Nothing copyrighted is committed or shipped. Details in MUSIC.md.

## Scope now

- Input: **a MIDI keyboard only** — note on/off, velocity, sustain pedal. Any class-compliant
  USB MIDI keyboard should work without a per-model mapping.
- Platform: Windows, Chrome/Edge, `npm run dev` via `start.bat`.
- Repertoire: beginner classical and traditional tunes first.

## Non-goals (for now)

- Acoustic pianos / microphone pitch detection.
- Judging fingering, posture or hand shape. MIDI can't see them; the game only *suggests*
  finger numbers.
- A notation editor or a DAW: no composing, recording or multi-track.
- Free-tempo performance where the game follows the player's rubato. Performances use a
  steady pulse first.
- Licensed pop, film or game music.
- Other instruments, macOS/Linux, mobile, multiplayer, online accounts, cloud saves.
- Visual polish before the mission system works (polish comes right after — see ROADMAP).

## Later (only if it works for Jason)

- Desktop build for Steam with **Tauri**, with native low-latency audio for keyboards that
  have no sound of their own. Steamworks for achievements/cloud.
- Paid web version (same codebase).
- Import MusicXML / MIDI and learn any piece with the same ladder.
- A sampled grand piano instead of the synthesised voice.
- Lead sheets, chords by symbol, playing by ear, improvisation; genre tours (classical, pop,
  jazz, film).
- Free-tempo performance (score following).

## Jason's answers (2026-10-09)

1. **Keyboard**: Donner DEP-20, 88 keys, on/off sustain pedal. Details in KEYBOARD.md.
2. **Level**: returning beginner, reads a little (see "Who it's for").
3. **First pieces**, in this order — the first two he already knew, the third is to relearn:
   Chopin, Prelude in E minor (Op. 28 No. 4) · Bach, Prelude in C minor (**which one is still
   open** — BWV 999 or BWV 847) · Beethoven, "Moonlight" Sonata, 1st movement. All three are
   public-domain compositions, so our own transcriptions can be committed.

Sheet music format: Jason left it to the agent. Preferred order — MusicXML, then MIDI (both
give exact notes), then PDF or a photo (read by eye, so proof-listen carefully).
