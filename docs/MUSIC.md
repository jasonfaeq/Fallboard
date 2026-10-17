# Music — scores, sound, licensing

**Status (2026-10-16): scores are MusicXML (or MuseScore files converted to it), drawn by
OpenSheetMusicDisplay and played on the Salamander piano (D-17, D-21, D-23, D-25).** The trainer's text notation, VexFlow staff and
repertoire plan are parked in `parked/midi-trainer/docs/MUSIC.md`.

## Scores: MusicXML (D-21)

- Accepted: `.mxl` (compressed MusicXML, MuseScore's default export) and `.musicxml` /
  `.xml`. Text is read as UTF-8, or UTF-16 when the file starts with a byte-order mark;
  `.mxl` is passed to OSMD as a Blob, which unzips it.
- Accepted and converted: `.mscz`/`.mscx` (MuseScore's own format, from MuseScore 2, 3 or 4).
  `reader/mscz.ts` turns them into MusicXML on import; the library keeps the MusicXML (D-25).
  Dropped in the conversion: lyrics, chord symbols, layout. Transposing instruments are shown
  at concert pitch. A file it cannot read gets a message pointing to File → Export.
- Refused, with a message saying how to get MusicXML: MIDI (no notation in it) and PDF (a
  picture of the music).
- What plays: every pitched note in every part, ties merged, repeats and 1st/2nd endings
  followed, tempo marks applied (`<sound tempo>`), sustain pedal marks (lines, Ped./✱ signs
  and changes; D-27). Not yet performed: dynamics, fermatas, ritardando, trills and other
  ornaments (ROADMAP Phase R). Grace notes are played quickly on the beat.

### Getting a score from MuseScore

- **musescore.com**: open the score, choose **Download**, then **MusicXML** or **MuseScore**.
  Downloading may need a MuseScore account, and some scores need a paid subscription.
- **MuseScore Studio** (the free desktop app): import the `.mscz` directly, or use
  **File → Export →** MusicXML.
- Then click **Scores → Import a score…** in the reader, or drop the file on the window.

## Built-in pieces (D-23)

`src/content/scores/*.musicxml`, listed in `BUILT_IN` in `src/reader/library.ts`, and
checked by `npm run validate` (title, composer, a `<rights>` licence starting with
`public-domain` or `original`, at least one measure, listed in the library).

- Chopin, Prelude in E minor, Op. 28 No. 4: from Mutopia 921 (public-domain Peters source).
- Bach, Prelude in C major, BWV 846: from Mutopia-2011/09/12-5 (public domain).

Both are our own transcriptions (D-15/18/19), converted on 2026-10-14 from the parked text
notation. The source is named in each file's `<source>`. They are still unconfirmed by
Jason's ear. Edit them as MusicXML, for example in MuseScore Studio.

## Piano sound (D-14, D-17)

- Salamander Grand Piano V3 by Alexander Holm (Yamaha C5), CC BY 3.0, bundled locally in
  `public/audio/salamander/`: 30 MP3 samples from Tonejs/audio at commit
  `efd8296360f9526e379bfbe5c1698ff54d6a1d34`, about 2 MB. `README`, `NOTICE.txt` and
  `manifest.json` keep the credit, source and hashes. The keyboard-shortcuts dialog shows
  the credit and licence link.
- The licence (https://creativecommons.org/licenses/by/3.0/) allows commercial
  redistribution with attribution. It is an asset licence, separate from the
  permissive-code rule (D-10).
- One recorded layer: the nearest sample transposed at most two semitones, velocity-
  controlled loudness, note-off release. The score's pedal is played by sending each note's
  note-off when the pedal lifts (D-27). There are no timbre changes across velocity, no
  sympathetic resonance and no pedal noise.

## Licensing

A piece of music has two layers, and both must be clear before anything is **shipped**:

1. **The composition**: public domain (composer dead long enough, or traditional) or our own.
2. **The arrangement or edition**: modern arrangements and engravings are usually
   copyrighted, so built-in pieces are our own transcriptions from public-domain sources.

Rules:

- Nothing copyrighted is committed. Scores a user imports (for example from musescore.com)
  stay in that browser's IndexedDB and never touch the repo. Their use is between the user
  and the score's licence.
- Every built-in score names its source and licence; the validator checks them.
- Pop, film or game music as built-in content would need a publisher licence. That is a
  business question for the commercial phase.
