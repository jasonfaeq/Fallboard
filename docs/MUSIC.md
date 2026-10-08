# Music — pieces, scores, sound, licensing

**Status (2026-10-09): score/content planned; sampled piano built (D-17).** Unlike DJ Trainer
there is no song analysis: a piece is note data, played through the piano's bundled samples.

## The Score model (D-08)

Our own `Score` type (`src/engine/score.ts`) is the only thing the game, the matcher, the
bots and the renderers read. Planned content:

- **Notes**: pitch (MIDI number), start and length in beats, hand (`L`/`R`), optional
  suggested finger (1–5), optional dynamic.
- **Bars**: time signature, key signature, tempo (BPM).
- **Sections**: named bar ranges of 2–8 bars (the units a piece is practised in).
- **Later**: pedal marks, ties and slurs, articulation, chord symbols, repeats.

A piece file (`src/content/pieces/<id>.ts`) adds metadata:

```ts
export default definePiece({
  id: 'ode-to-joy', title: 'Ode to Joy', composer: 'Ludwig van Beethoven',
  source: 'Symphony No. 9, 4th movement theme (1824); our arrangement',
  licence: 'public-domain composition, own arrangement',
  verified: false,            // true once Jason has played it and the notes are right
  tempo: 80, key: 'C', time: '4/4',
  sections: [{ name: 'A', bars: [1, 4] }, { name: 'A2', bars: [5, 8] }],
  right: '…',                 // the text notation, one string per hand
  left: null,
})
```

## Text notation

A tiny notation of our own, so drills and beginner pieces can be typed by hand and reviewed
in a diff. **Designed in Phase 1**; keep it to what Venue 1–2 need (pitches, lengths, rests,
bar lines, chords) and extend it only when a mission needs more. Illustrative only:

```
E4 E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 | E4. D4/8 D4:h
```

Longer pieces are easier to engrave in a notation program and export as MusicXML; the
importer for that is ROADMAP Phase 6. Until then, pieces are typed.

## Staff rendering (D-16: VexFlow)

The staff is a drawing layer fed from the Score. **Chosen: VexFlow 5** — the spike is
`src/ui/StaffSpike.tsx` (hard-coded bars; the real `Staff.tsx` fed from the Score is still to
build). The candidates below are kept for the record. What the game needs from it:

- a grand staff (treble + bass), key and time signatures, beams, ties, rests, accidentals;
- the screen position of every note, for the cursor and for hit/miss colours;
- redrawing fast enough to scroll with the transport.

Candidates with permissive licences: **VexFlow** (MIT, a drawing library — we lay out bars
ourselves), **OpenSheetMusicDisplay** (BSD-3, renders MusicXML, has a cursor), **abcjs** (MIT,
renders ABC text), or our own drawing limited to beginner scores. **Not allowed:** Verovio
(LGPL), LilyPond and MuseScore code (GPL).

## Piano sound (D-14, supersedes D-09)

- **Built:** Salamander Grand Piano V3 by Alexander Holm (Yamaha C5), CC BY 3.0, bundled
  locally. Original Internet Archive metadata read directly on 2026-10-09:
  https://archive.org/metadata/SalamanderGrandPianoV3 — `licenseurl` and the description both
  link CC BY 3.0. The HTML archive page was inaccessible through the browsing tool; the
  archive's own metadata API supplied the original description and licence.
- The licence https://creativecommons.org/licenses/by/3.0/ allows commercial redistribution
  and adaptation with attribution, a licence link and no incompatible extra restrictions on
  the samples. The asset licence is separate from the permissive-code rule (D-10/D-17).
- `public/audio/salamander/` contains the 30 MP3 browser samples from Tonejs/audio, pinned
  to commit `efd8296360f9526e379bfbe5c1698ff54d6a1d34`, about 2 MB total. Copied unchanged;
  `README`, `NOTICE.txt` and `manifest.json` retain credit, conversion/subset information,
  source and SHA-256 hashes. The credit and licence/source links also appear in the UI.
  Source: https://github.com/Tonejs/audio/tree/efd8296360f9526e379bfbe5c1698ff54d6a1d34/salamander
- The voice transposes the nearest recording at most two semitones across A0–C8. It has
  one recorded layer, velocity-controlled loudness, sustain and note-off release, not the
  full 16-layer library's timbre changes, resonance or mechanical noise. No audio library
  dependency was added; playback uses Web Audio directly. Needs Jason's listening test.
- Jason's DEP-20 makes its own sound, so the game's piano is heard in Listen and guide modes
  and for the other hand — not for the notes he plays (KEYBOARD.md).
- The metronome and the accompaniment go through the same engine, on the audio clock.
  The metronome is built; score-driven accompaniment comes with the piece player.

## Licensing

A piece of music has two layers, and both must be clear:

1. **The composition.** We ship only public-domain compositions (composer dead long enough,
   or traditional) or our own originals. Terms differ by country — check each piece for the
   markets we would sell in, and note the check in the piece file's `source`.
2. **The arrangement or edition.** A modern simplified arrangement or engraving of a
   public-domain work is usually copyrighted. So **we write our own arrangements** from the
   original. Don't copy from a method book, a website's "easy version", or a downloaded
   MIDI/MusicXML file unless that exact file is public domain or CC0.

Rules:

- Nothing copyrighted is committed. Jason's personal pieces (pop, film, game music) go in a
  git-ignored folder, `public/scores/`, for local use only once import exists.
- Every piece file names its source and licence; the validator checks the fields are filled.
- Pop songs need a publisher licence. That is a Phase 8 business question, not a build task.

## Jason's first pieces (D-15)

Transcribed by hand from sheet music Jason provides or from a public-domain edition, in this
order: Chopin, Prelude in E minor Op. 28 No. 4 · Bach, Prelude in C minor (BWV 999 or 847 —
ask) · Beethoven, Sonata Op. 27 No. 2 "Moonlight", 1st movement. These are the original
notes, not arrangements; name the edition used in `source`.

Source found for the Chopin (web search, 2026-10-09): Mutopia Project piece 921, "Prelude:
Op. 28, No. 4 (from Peters source)", listed as public domain, with MIDI and LilyPond files —
https://www.ibiblio.org/mutopia/cgibin/piece-info.cgi?id=921. Open the page and confirm the
licence line before transcribing from it. (Its LilyPond file is a public-domain score, i.e.
data; that is not the same as copying LilyPond's GPL program code.)

## Starter repertoire

Venue 1–2 candidates, all traditional or long out of copyright (still do the per-piece check):
Hot Cross Buns · Mary Had a Little Lamb · Ode to Joy (Beethoven) · Au Clair de la Lune ·
Frère Jacques · When the Saints Go Marching In. Later venues: CURRICULUM.md.
