# Architecture

**Status (2026-10-14): the sheet music reader, as built (D-20–23).** The MIDI trainer's
architecture (input, mission runner, matcher, bots) is parked in
`parked/midi-trainer/docs/ARCHITECTURE.md`. Keep this file true: when you build or change a
part, describe how it actually works.

## Overview

```
 .mxl / .musicxml ──▶ library.ts (IndexedDB, checks the file type)
 .mscz / .mscx ──▶ mscz.ts ──▲ (converted to MusicXML text on import, D-25)
                          │ text or Blob
                          ▼
 ui/SheetView.tsx ── OpenSheetMusicDisplay: load → parsed MusicSheet → render (SVG)
        │ onLoaded(osmd)                                  ▲ playhead, lit notes, loops
        ▼                                                 │
 reader/timeline.ts: MusicSheet ──▶ Timeline { sounds, marks, passes, steps, clicks }
        │                                   │
        ▼                                   ▼
 reader/player.ts ──▶ engine/audio.ts      ui/KeysView.tsx (canvas falling notes + Keyboard)
   schedules notes and clicks              App.tsx: top bar, dock, settings, library, shortcuts;
   on the Transport (audio clock)          one requestAnimationFrame redraw while playing
```

Layers: `engine/` (sound, clock, note numbers) knows nothing of React or scores. `reader/`
(timeline, player, library, prefs, mscz) has no DOM, apart from IndexedDB/localStorage in
their own modules and the XML parser (`DOMParser`) in `mscz.ts`. `ui/` draws and forwards clicks.

## Screen layout (`App.tsx`, D-26)

- **Top bar**: the Scores drawer, the title and composer, View (Sheet · Keys · Both), Rows
  (1–4), full screen (F) and the shortcuts list.
- **Stage**: the sheet on a card, then the keys. In Both, the line between them drags to
  resize the keys (20–75 % of the stage, double-click resets to 42 %, remembered as
  `split`). Messages float over the stage; the count-in shows a large number.
- **Dock**: the scrubber, then the position and the hands (left), the transport —
  start, previous bar, play, next bar, loop with a repeat count (centre) — and speed,
  metronome, count-in and Settings (right).
- **Settings** (`ui/Settings.tsx`, a popover over the dock): speed presets, Speed up loops,
  transpose, note names, paper or night sheet, volume, and each hand's volume.
- **Hands (D-30)**: each staff has a volume 0–100 % (`Player.volumes`; 0 = muted), sent to
  the piano as `noteOn(…, level)`, which scales the note's gain. The hand chips in the dock
  mute and unmute (back to the hand's last volume) and show a volume below 100 %; the sliders
  are in Settings. Muting or unmuting while playing re-cues at once; a new level applies from
  the next note.
- **Speed up loops**: the player calls `onLoop(repeats)` each time a loop comes round; with
  the setting on, the app adds 5 % to the speed until 100 % (it never slows a faster speed).
- Icons are our own line drawings in `ui/Icons.tsx`; colours and controls are CSS variables
  and classes in `styles.css`.

## Timing (D-06)

- **Clock:** `AudioContext.currentTime`. The `Transport` (`engine/audio.ts`) computes the
  position from an anchor; tempo or rate changes re-anchor without a jump.
- **Score seconds:** the timeline gives every event a time in seconds at 100 % speed, with
  the score's tempo changes already applied. The player runs the Transport at tempo 60, so
  one transport beat is one score second, and speed is the Transport's rate (0.25–2).
- **Scheduling:** `Player.update()` runs every 20 ms but only wakes the scheduler. Notes and
  clicks due within the next 120 ms are scheduled at their exact audio-clock time. A note's
  note-off is sent for its `release` (the pedal), cut at the loop end. On a seek,
  a speed change or muting/unmuting a hand, sounding notes stop and the cursor is pointed at the new
  position; notes that should still sound there start again.
- **What you see:** `Player.time` is the transport position minus the browser's reported
  output latency, so the playhead matches what is heard. `performance.now()` and animation
  frames are used only for drawing.
- **Loops** jump back when the transport passes the loop end. The jump is checked every
  20 ms, so the first note after the loop point can be up to ~20 ms late.

## Timeline (`reader/timeline.ts`)

Built from OSMD's parsed `MusicSheet`, not from the drawing. `MusicPartManager.getIterator()`
walks every cursor stop in playing order, through repeats and 1st/2nd endings. Everything is
first placed by its **played position** (whole notes from the start in playing order, so a
repeated bar adds its length again); then a `Clock` turns positions into score seconds,
piecewise linear between breakpoints, with each step's tempo holding until the next. Notes,
steps, passes, clicks and pedal marks all go through the same clock, so the playhead, sheet,
keys and scrubber follow fermatas and ritardandos too. The clock's rate at a position is
`240 / bpm ÷ tempo factor × fermata stretch`:

- **rit./accel. (D-29):** words in OSMD's `TempoExpressions` (and unrecognised staff words)
  matching rit., rall., allarg., calando… or accel., string… start a linear change of the
  tempo factor to ×0.7 (or ×1.3) by the next tempo mark; "a tempo", "tempo I", a new metronome
  tempo or a jump back for a repeat set it to 1. Without one it runs to the end. The clock
  steps through each change in 1/64ths of a whole note.
- **Fermatas (D-29):** a fermata (`ArticulationEnum.fermata`/`invertedfermata`, on a note or
  rest) stretches the part of its note after the last step before the note ends: that part
  lasts twice as long, at most 1.5 score seconds longer. Notes sounding across it last longer.

For each stop:

- **Pass:** a new measure, or a jump back into the same one, starts a new `Pass` (measure
  index, printed number, time, end, tempo, counted beats). A repeated bar has one pass per
  playing.
- **Step:** the cursor position (`at`, a Fraction of whole notes as printed) at a time. The
  sheet maps steps to x positions.
- **Sounds:** one per note head, with ties merged into one sound; pitch =
  `note.Pitch.getHalfTone()` + 12 + transposition. OSMD rewrites `note.halfTone` while a
  transposed sheet is drawn, so the written `Pitch` is used. Grace notes play 70 ms each on
  the beat, delaying their main note. **Ornaments (D-29)** (`OrnamentContainer`, on a chord's
  top note) become several sounds: a trill alternates with the note above, ~0.09 s each,
  ending on the main note; a turn plays above–main–below–main (inverted: below first) at the
  start, a delayed turn at the end; a mordent main–below–main, an inverted mordent
  main–above–main. Neighbours follow the key signature (`KeyInstruction`) or the ornament's
  own accidental. The printed note stays one mark. Rests, cue notes and pitches outside A0–C8 are skipped.
  Loudness comes from the dynamics (below).
- **Dynamics (D-28):** `InstantaneousDynamic` marks (ppp–fff as velocities 32–118, mf = 78),
  sudden accents (sf, sfz, fz, rf… ×1.2–1.4 for the notes at the mark; fp/sfp: forte, then p)
  and hairpins (`StartingContinuousDynamic`, ended at OSMD's `EndMultiExpression`) are read
  per pass from `StaffLinkedExpressions`. A mark sets every staff of its instrument unless that
  staff has its own mark at the same moment. A hairpin moves linearly from its start to the
  mark that follows it within a bar of its end (if that goes the right way), otherwise one
  step (14) by its end. Accent ×1.2 and marcato ×1.3 on top. Staves below the first play at
  64/78 of the level, so a score without marks sounds as before (78 and 64).
- **Marks:** every printed note (tie continuations included), with its time span, so the
  sheet can light it.
- **Pedal (D-27):** OSMD puts sustain-pedal marks on its `MultiExpression`s
  (`PedalStart`, `PedalEnd`; a "change" has both). They are read per pass from
  `StaffLinkedExpressions` into `pedals` (down/up spans in score seconds); a pedal still down
  at the end lifts there. The pedal belongs to the instrument, so a mark on either staff holds
  every staff. Each sound gets a `release`: if its key comes up while the pedal is down
  (strictly after the pedal went down), the damper falls when the pedal lifts, or earlier if
  the same key is struck again. `end` stays the written length (keys and lit notes use it).
- **Clicks:** the counted beat of each pass: the denominator's note, or dotted quarters in
  6/8, 9/8 and 12/8. Accents fall on downbeats. A pickup bar counts back from its bar line.
- **Staves:** named "Right hand" and "Left hand" for a two-staff instrument, otherwise by
  instrument name.

## Sheet view (`ui/SheetView.tsx`)

- One OSMD instance with `pageFormat: 'Endless'` and the compact drawing rules. Titles and
  credits are not drawn (the app header shows them); part names are drawn only for
  multi-instrument scores. Colours come from `EngravingRules` (paper or night).
- **Rows (D-22):** render, measure the span of the first N systems, set
  `zoom = panel height / (N × pitch)`, and render again. Up to four passes, until within
  1.5 %; zoom is limited to 0.35–2.4. Rows = 1 uses `renderSingleHorizontalStaffline`. A
  `ResizeObserver` on the sheet's frame (not the scrolling viewport, whose size changes when a
  scrollbar appears) re-fits after the panel size changes (200 ms debounce); the viewport keeps
  a stable scrollbar gutter. Watching the viewport made some panel sizes re-fit forever, which
  showed as the music shaking while paused. The sheet is not rendered while hidden (Keys view).
- Compact mode sets no top margin, and OSMD measures text a little short, so a tempo mark above
  the first line was clipped by the SVG edge. `PageTopMarginNarrow` = 2 units leaves room.
- **Layout map** (after each render): rows (staff top and bottom in px), an x anchor for each
  timeline step via `GraphicSheet.calculateXPositionFromTimestamp`, measure boxes, and the
  SVG group of each mark (`findGraphicalStaffEntryFromMeasureList` →
  `findGraphicalNoteFromNote` → `getSVGGElement`).
- **Every frame:** the playhead glides between step anchors (to the bar line before a new
  line or a repeat). Sounding notes get `lit-0/1/2` classes; the CSS colours win over the
  SVG's fill attributes. While playing, the current row is scrolled to the top (smooth), or
  in 1-row mode the line scrolls so the playhead sits 30 % from the left.
- **Clicks:** `GetNearestStaffEntry` → measure + timestamp → the step of that pass nearest to
  the current time (repeats) → `onPick`. Shift+click stretches a loop from the last picked
  bar; loop bars get an overlay box.

## Keys view (`ui/KeysView.tsx`, `ui/Keyboard.tsx`)

The keyboard covers the piece's range rounded out to whole C–B octaves, at least three
octaves (`keyRange`). Falling notes are drawn on a canvas (3.2 score seconds visible): darker
lanes over the black keys, bar lines with numbers, octave lines at each C, notes in staff
colours with a sheen (sounding notes glow), muted staves as outlines, note names when
enabled. The keys are shaded with SVG gradients under a felt strip; lit keys glow. The SVG keyboard lights the keys the score is sounding;
keys held with the mouse sound on the `'touch'` piano channel. `data-lit` on the view lists
the lit notes (used by tests).

## Audio (`engine/audio.ts`, `engine/piano.ts`)

`Engine` owns the gesture-started `AudioContext` (`latencyHint: 'interactive'`), master
volume, a limiter, the piano and `click(time, accent)`. The piano (D-17) loads 30 local
Salamander MP3s, plays the nearest sample transposed at most two semitones, with velocity
gain, a 350 ms release and at most 96 voices. Channels `'score'` and `'touch'` hold notes
separately. The page pauses playback when it is hidden.

## Persistence

- `reader/library.ts`: IndexedDB `piano-trainer-library`, stores `meta` (title, composer,
  file name, date) and `data` (the file's bytes; for a MuseScore file, the MusicXML it was
  converted to). If storage fails, the score still opens but is not kept.
- `reader/prefs.ts`: localStorage `piano-trainer:prefs` (view, rows, theme, note names,
  metronome, count-in, volume, Speed up loops, keys split, last score) and `piano-trainer:score:<id>` (speed,
  transposition, each staff's volume as `volumes`; an older `muted` list is read as volume 0).
  Every access is wrapped in try/catch.

## Build & run

- `npm run dev` for playing; `npm run build` → a single-file `dist/index.html` (about 1.8 MB
  including OSMD; the piano samples load from `audio/`).
- Jason starts it with `start.bat`.

## Testing

Playwright on Edge (`channel: 'msedge'`; the bundled Chromium is not installed on Jason's
PC). `npm test` type-checks the tests, builds, serves the preview on port 4183 and runs one
worker. `window.__piano = { engine, player, timeline, osmd }` exposes state for assertions.
Fixtures: `tests/fixtures/ode-repeat.musicxml` (and the same as `.mxl`): four bars with a
repeat and 1st/2nd endings, so passes are 1 2 3 1 2 4. `ode-repeat.mscz` and
`chopin-op28-4.mscz` are the same Ode and the built-in Chopin saved by MuseScore Studio 4
(thumbnails removed); they must give the same timelines as the MusicXML.

Covered: the built-in timelines (note counts and lengths), import and library persistence,
MuseScore-file conversion,
refusal messages, playback with lit notes and keys, count-in, repeats, click-to-seek,
Shift+click and L loops wrapping, transposition, muting, views, rows fitting (2/3/4 visible
lines, decreasing zoom; 1 row scrolls), clicking keys, remembered settings, and the
Transport with a fake clock.

Not covered: how real MuseScore downloads look and sound, and how the audio feels. Those
need Jason.

## Known risks

- **OSMD rendering of unusual scores** (cross-staff beams, many voices, percussion). Report
  them; check OSMD's issue tracker before working around one.
- **Render time** for long scores, since fitting the rows can render up to five times.
- **OSMD internals**: the timeline and layout map use OSMD's public classes (iterator,
  graphical sheet). An OSMD upgrade must re-run the tests.
