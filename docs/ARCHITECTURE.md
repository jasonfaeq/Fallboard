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
  transpose, note names, paper or night sheet, volume.
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
  clicks due within the next 120 ms are scheduled at their exact audio-clock time. On a seek,
  a speed change or a mute, sounding notes stop and the cursor is pointed at the new
  position; notes that should still sound there start again.
- **What you see:** `Player.time` is the transport position minus the browser's reported
  output latency, so the playhead matches what is heard. `performance.now()` and animation
  frames are used only for drawing.
- **Loops** jump back when the transport passes the loop end. The jump is checked every
  20 ms, so the first note after the loop point can be up to ~20 ms late.

## Timeline (`reader/timeline.ts`)

Built from OSMD's parsed `MusicSheet`, not from the drawing. `MusicPartManager.getIterator()`
walks every cursor stop in playing order, through repeats and 1st/2nd endings. For each stop:

- **Pass:** a new measure, or a jump back into the same one, starts a new `Pass` (measure
  index, printed number, time, end, tempo, counted beats). A repeated bar has one pass per
  playing.
- **Step:** the cursor position (`at`, a Fraction of whole notes as printed) at a time. The
  sheet maps steps to x positions.
- **Sounds:** one per note head, with ties merged into one sound; pitch =
  `note.Pitch.getHalfTone()` + 12 + transposition. OSMD rewrites `note.halfTone` while a
  transposed sheet is drawn, so the written `Pitch` is used. Grace notes play 70 ms each on
  the beat, delaying their main note. Rests, cue notes and pitches outside A0–C8 are skipped.
  Loudness is fixed: 78 for the first staff and 64 for the others. Dynamics are not read yet.
- **Marks:** every printed note (tie continuations included), with its time span, so the
  sheet can light it.
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
  transposition, muted staves). Every access is wrapped in try/catch.

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
