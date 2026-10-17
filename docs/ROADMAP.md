# Roadmap

Pick the next unchecked item in the lowest open phase. Items marked 🔀 can run in parallel
with others in the same phase (different files). Tick the box and add the date when done;
note anything that needs Jason or a hardware test.

The MIDI trainer's phases (piece player modes, mission engine, venues, recitals) are parked
with its code: `parked/midi-trainer/docs/ROADMAP.md` (D-20).

## Phase 0 — Scaffold (done 2026-10-09)

- [x] Direction + docs, Jason's answers, play-screen mockup, git repo, project setup copied
      from DJ Trainer (details in the parked roadmap) — 2026-10-04 to 2026-10-09.

## Phase R — The sheet music reader (D-20)

- [x] **MIDI trainer parked** in `parked/midi-trainer/`: code, tests, docs and the
      uncommitted Play along / Practise modes, with a restore guide — 2026-10-14.
- [x] **Import**: MusicXML and `.mxl` from the file picker or dropped on the window; a
      library in the browser (IndexedDB) with delete; clear messages for `.mscz`, MIDI and
      PDF files — 2026-10-14 (D-21).
- [x] **Sheet view** (OpenSheetMusicDisplay): 1–4 rows fitted to the panel, paper or night
      colours, a gliding playhead, sounding notes lit in hand colours, click a note to jump,
      Shift+click to loop bars, the current line kept on top while playing — 2026-10-14 (D-22).
- [x] **Keys view**: falling notes onto a keyboard sized to the piece, bar lines, note names,
      click a key to hear it — 2026-10-14.
- [x] **Playback**: repeats and voltas, tempo changes, speed 25–200 %, count-in, metronome,
      loop, mute a hand, transpose ±12, volume, a scrubber, keyboard shortcuts, settings
      remembered per score — 2026-10-14.
- [x] **Built-in pieces** converted to MusicXML (Chopin, Bach), same notes as before —
      2026-10-14 (D-23). *Needs Jason: the transcriptions are still unconfirmed by ear.*
- [ ] **Jason tries real MuseScore downloads**: import a few scores and report anything drawn
      or played wrong. *Needs Jason.*
- [x] **Dynamics in playback**: p/f marks, sf/fp, hairpins and accents set each note's
      loudness; without marks it plays as before — 2026-10-17 (D-28). *Needs Jason: is the
      range from pp to ff right on the sampled piano?*
- [x] **Pedal marks** in playback (sustain): lines, Ped./✱ signs and changes hold notes until
      the pedal lifts — 2026-10-17 (D-27). *Needs Jason: does the pedalling sound natural?*
- [ ] 🔀 **Ornaments and timing marks**: trills, turns, fermatas, ritardando. Grace notes are
      played quickly on the beat.
- [ ] **Big scores**: measure render time on a long score; render incrementally if slow.
- [x] **`.mscz` import** (MuseScore's own format, versions 2–4), converted to MusicXML in the
      browser by our own reader — 2026-10-16 (D-25). *Needs Jason: try a few real musescore.com
      downloads, especially MuseScore 3 files (none were on hand to test).*
- [ ] MIDI-file import for the Keys view (a MIDI file has no sheet music).
- [x] **Look and layout**: a top bar and a player dock, a settings popover, shaded keys and
      glowing notes, a Scores drawer with search; resizable sheet/keys split, full screen,
      previous/next bar buttons, Speed up loops — 2026-10-17 (D-26). *Needs Jason: does the
      new layout feel right at the piano, and is 5 % per repeat a good step?*

## Later

- [ ] Bring back the MIDI trainer on top of the reader (parked roadmap, Phase 1 onwards).
- [ ] Commercial: content audit, Tauri desktop build, paid web version.
