# Music — pieces, scores, sound, licensing

**Status (2026-10-09): score format, Chopin/Bach transcriptions and sampled piano built (D-17–19).** Unlike DJ Trainer
there is no song analysis: a piece is note data, played through the piano's bundled samples.

## The Score model (D-08)

Our own `Score` type (`src/engine/score.ts`) is the only thing the game, the matcher, the
bots and the renderers read. As built:

- **Sound notes**: spelled pitch and MIDI number, start/length in beats, hand (`L`/`R`) and
  links to engraving events. Suggested fingering and authored dynamics remain later work.
- **Bars**: time signature, key signature, tempo (BPM).
- **Sections**: named bar ranges of 2–8 bars (the units a piece is practised in).
- Ties retain separate engraved events but combine into one audible note; grace notes and
  eighth-note triplets are represented. Later: pedal marks, slurs, articulation, repeats.

`definePiece` validates each hand/voice/bar, pitch range, complete ties/triplets and section bounds.
`Score.events` contains spelled chords/rests for engraving; `Score.soundNotes` flattens pitches,
merges ties and realises ornaments for playback. Bars have quarter-note start/length and a
number; pickup is bar 0 at negative beats. `sectionBounds` includes the pickup with bar 1.
Metadata, sections and a short practice plan live in each typed piece file. No importer yet.

A piece file (`src/content/pieces/<id>.ts`) adds metadata:

```ts
export default definePiece({
  id: 'ode-to-joy', title: 'Ode to Joy', composer: 'Ludwig van Beethoven',
  source: 'Symphony No. 9, 4th movement theme (1824); our arrangement',
  licence: 'public-domain composition, own arrangement',
  verified: false,            // true once Jason has heard and confirmed the notes
  tempo: 80, key: 'C', time: [4, 4],
  sections: [{ name: 'A', bars: [1, 2] }],
  right: 'E4:4 E4:4 F4:4 G4:4 | G4:4 F4:4 E4:4 D4:4',
  left: 'r:1 | r:1',
  practice: ['Listen, then play the right hand slowly.'],
})
```

## Text notation

A tiny notation of our own, typed by hand and reviewed in a diff (D-18/19). Each hand is a
string with bars separated by `|`, or an array of strings for simultaneous voices. Each
voice fills every bar independently; ties remain within that voice. Every pitch has an
explicit octave/accidental and every token an explicit duration denominator; the key
signature changes engraving, not parsing.

```
C4:2 [E4,G4]:4 F#4:4~ | F#4:2. r:4
```

`:4` = quarter, `:8.` = dotted eighth, `:8t` = eighth-note triplet (three together), `r:2`
= half rest, `~` ties the whole chord to the next identical chord, `^B4` is a grace note
attached to the following token. Double sharps/flats are supported. Grace playback borrows
1/8 quarter beat from its principal note. Quarter beats are the clock even in 2/2.

The built Chopin file has a one-beat pickup, bars 1–24 of four quarter beats and a three-beat
final bar; `verified: false` awaits Jason's Listen confirmation. Pitches/durations were read
from Mutopia's public-domain engraved parts. Bar 16's turn uses its explicit MIDI note
realisation. The MIDI's rubato, elongated fermatas and pedal/dynamic performance are not
copied; playback is steady practice tempo. Closing RH chords stay on the treble staff.
Source ZIP SHA-256: `1f35c19d3bfdfeeac0a9c1a283aeb3a3cc8f98acb3f49593c4b25fcf6b161497`.

`bach-bwv846.ts` contains Bach's complete Prelude No. 1 in C major, BWV 846: 35 bars,
4/4, 60 BPM practice tempo, nine sections. Two independent left-hand voices preserve the
half-note bass and the inner note entering one sixteenth later, held through the half-bar.
Bars 33–34 hold both bass voices to the bar ending. Bar 33's right hand stays on the treble
staff instead of changing clef. The closing arpeggio/fermata is played as a simultaneous
chord for its written four beats; expressive pedal, dynamics and fermata extension remain
later work. There is no later Schwencke insertion. `verified: false` awaits Jason's Listen
confirmation. Source: Mutopia-2011/09/12-5, maintained by Tobias Erbsland; original edition
unknown, explicitly declared public domain by its typesetter:
https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=5.
Source LilyPond data SHA-256: `afa237b10637ca7839b4c9e98b64ba89c781e2cfc1b980679b2632a31951aacd`.

## Staff rendering (D-16: VexFlow)

The staff is a drawing layer fed from the Score. **Built: `src/ui/Staff.tsx` with VexFlow 5.**
It draws spelled chords/rests, accidentals, beams, dots, ties and triplets on a grand staff,
plus grace-note groups. Full/Staff scroll beneath a fixed playhead; Page lays out the whole
piece in still systems. Simultaneous voices on one staff have separate stem directions.
`StaffSpike.tsx` is retained as an unused spike. Cross-staff closing
RH notes are shown together in the treble staff for now. The candidates below are kept for
the record. What the game needs from it:

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
  dependency was added; playback uses Web Audio directly. Jason confirmed MIDI sound and
  acceptable free-play delay on 2026-10-09. Piece listening/confirmation is still pending.
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

Jason additionally requested Bach's Prelude No. 1 in C major, BWV 846 on 2026-10-09.
It is built and selectable alongside Chopin in the Listen player. The C minor choice below
remains pending; this addition does not remove it.

Transcribed by hand from sheet music Jason provides or from a public-domain edition, in this
order: Chopin, Prelude in E minor Op. 28 No. 4 · Bach, Prelude in C minor (BWV 999 or 847 —
ask) · Beethoven, Sonata Op. 27 No. 2 "Moonlight", 1st movement. These are the original
notes, not arrangements; name the edition used in `source`.

Source for the Chopin (checked directly 2026-10-09): Mutopia Project piece 921, "Prelude:
Op. 28, No. 4 (from Peters source)", listed as public domain, with MIDI and LilyPond files —
https://www.ibiblio.org/mutopia/cgibin/piece-info.cgi?id=921. The page and
score both declare public domain; the complete piece is now `content/pieces/chopin-op28-4.ts`.
(Its LilyPond file is a public-domain score, i.e.
data; that is not the same as copying LilyPond's GPL program code.)

## Starter repertoire

Venue 1–2 candidates, all traditional or long out of copyright (still do the per-piece check):
Hot Cross Buns · Mary Had a Little Lamb · Ode to Joy (Beethoven) · Au Clair de la Lune ·
Frère Jacques · When the Saints Go Marching In. Later venues: CURRICULUM.md.
