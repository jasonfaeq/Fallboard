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
- [x] **Ornaments and timing marks**: fermatas hold, rit./rall./accel. change the tempo
      gradually until "a tempo", trills, turns and mordents play their notes; grace notes are
      still played quickly on the beat — 2026-10-17 (D-29). *Needs Jason: how long fermatas
      hold, how much rit. slows, and the ornament speed.*
- [ ] **Big scores**: measure render time on a long score; render incrementally if slow.
- [x] **`.mscz` import** (MuseScore's own format, versions 2–4), converted to MusicXML in the
      browser by our own reader — 2026-10-16 (D-25). *Needs Jason: try a few real musescore.com
      downloads, especially MuseScore 3 files (none were on hand to test).*
- [ ] MIDI-file import for the Keys view (a MIDI file has no sheet music).
- [x] **Volume per hand**: 0–100 % per staff in Settings, the hand chips still mute,
      remembered per score (old muted settings carried over) — 2026-10-17 (D-30).
- [x] **Room setting**: Off, Room, Hall or Large hall, a generated echo, remembered —
      2026-10-17 (D-31). *Needs Jason: are the amounts right, and should it default to on?*
- [x] **Look and layout**: a top bar and a player dock, a settings popover, shaded keys and
      glowing notes, a Scores drawer with search; resizable sheet/keys split, full screen,
      previous/next bar buttons, Speed up loops — 2026-10-17 (D-26). *Needs Jason: does the
      new layout feel right at the piano, and is 5 % per repeat a good step?*
- [x] **Saved sections per score**: save the loop under a name, pick a section to loop it
      and jump to its start, rename, delete, `[` `]` for the previous/next one, remembered per
      score — 2026-10-17 (D-32).
- [x] **Remember position and loop**: reopening a score or reloading the app comes back to
      the same place and loop; transposing keeps the loop — 2026-10-17.
- [x] **Speed-up loop settings**: step 2/5/10 %, a start speed for each new loop, a target up
      to 200 %; the default is still +5 % up to 100 % — 2026-10-17 (D-33).
- [x] **Count-in options**: 1–4 bars or 1–8 beats, and Count in each loop — 2026-10-17 (D-34).
- [x] **Go to bar**: G (or click the bar number in the dock), type a printed bar number; with
      repeats it goes to the first time the bar is played — 2026-10-17 (D-35).
- [x] **Metronome upgrades**: Accent the first beat (on by default, as before) and Metronome
      only (Shift+M) to play along with the playhead and lit notes but no piano — 2026-10-17
      (D-36). Subdivisions and other click sounds are not built. *Needs Jason: is the
      accent loud enough against the piano, and do the new controls feel right at the piano?*

- [x] **Music desk upgrade**: warm desk/sidebar layout, separate transport and practice
      rows, direct import, focus mode (Z), quick night sheet, library source filters and
      sorting, modal keyboard focus, keyboard seeking and split resizing — 2026-10-19
      (D-38). *Needs Jason: judge the new workspace at the piano and confirm playback by ear.*

- [x] **Performance and passages**: physical key faces, lips, bevels, wood rail and key
      travel; performance view (P) with responsive lighting and controls that fade during
      playback; Lighting setting and reduced motion; passage map (V), repeated-bar
      navigation, draggable/keyboard loop handles and saved names — 2026-10-19 (D-39).
      *Needs Jason: judge the stage at the piano, lighting comfort and sound by ear.*

## Later

- [ ] Bring back the MIDI trainer on top of the reader (parked roadmap, Phase 1 onwards).
- [ ] Commercial: content audit, Tauri desktop build, paid web version.
