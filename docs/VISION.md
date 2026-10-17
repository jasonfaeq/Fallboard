# Vision

_Rewritten 2026-10-14 for D-20: Jason put the MIDI trainer on hold and asked for a sheet
music reader first. The trainer's vision is kept in `parked/midi-trainer/docs/VISION.md`.
Change this file only with a new entry in DECISIONS.md._

## In one line

**A piano sheet music reader: open a score from MuseScore, read it as sheet music, as falling
keys, or both, and hear it played.**

## Who it's for (now)

One player: **Jason**, a returning beginner. He reads sheet music a little and learned a few
pieces earlier in 2026 (Chopin's Prelude in E minor, Carly Comando's "Everyday"). He plays a
Donner DEP-20 and gets his sheet music from musescore.com. He learns best by doing.

If it works well for him it may be sold (Steam + paid web version). Build it for Jason, but
never in a way that makes a commercial version hard.

## What it does

- **Import** MusicXML (`.mxl` or `.musicxml`) or MuseScore files (`.mscz`), which is what
  musescore.com's Download gives (D-25). Imported scores stay in the browser for next time.
- **Three views**: Sheet (the real score), Keys (notes falling onto a piano keyboard), or Both.
- **Rows**: 1 (one line that scrolls sideways), 2, 3 or 4 lines of music on screen at once.
  While playing, the current line stays at the top (D-22).
- **Playback** on a sampled grand piano: a playhead, notes that light up in their hand's
  colour, repeats followed, speed 25–200 %, count-in, metronome, loops (optionally speeding
  up each time round, D-26), one hand muted,
  transposition, volume.

## Pillars

1. **The real score.** What MuseScore exported is what is drawn: no simplified notation.
2. **Sheet and keys agree.** One timeline drives both, in the same colours (gold right hand,
   blue left hand).
3. **Practice tools before decoration.** Slow it down, loop a few bars, hear one hand, click
   a note to jump there.
4. **Local.** Scores and settings stay on the computer; nothing is uploaded.

## Non-goals (for now)

- MIDI keyboard input, judging the player, missions, career, recitals: parked (D-20).
- Editing notes (MuseScore does that), reading PDFs or photos.
- Audio recordings; instrument sounds other than the piano.

## Music

Built-in pieces are public-domain compositions in our own transcriptions (D-23). Imported
scores are the user's own files and live only in their browser. Nothing copyrighted is
committed (MUSIC.md).

## Later

- Bring the MIDI trainer back on top of the reader (play along, wait mode, scoring):
  `parked/midi-trainer/README.md`.
- Dynamics and pedalling in playback; MIDI-file import.
- Desktop build with Tauri; a paid web version.
