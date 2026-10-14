import { definePiece } from '../../engine/score'

// Hand-transcribed from the public-domain engraved parts, not the source's rubato MIDI.
// German h = B natural, b = B flat. Explicit octaves/accidentals retain the source spelling.
const eighths = (pitches: string, count: number) => Array(count).fill(`[${pitches}]:8`).join(' ')
const chords = (...groups: [string, number][]) => groups.map(([p, n]) => eighths(p, n)).join(' ')

export default definePiece({
  id: 'chopin-op28-4', title: 'Prelude in E minor · Op. 28 No. 4', composer: 'Frédéric Chopin',
  source: 'Mutopia 921 / Peters, Herrmann Scholtz, 1900b; Roland Goretzki, 2007. https://www.ibiblio.org/mutopia/cgibin/piece-info.cgi?id=921',
  licence: 'public-domain composition and public-domain typesetting; own transcription',
  verified: false, tempo: 48, key: 'Em', time: [2, 2], pickup: 1, finalBeats: 3,
  notes: 'Quarter-note practice clock, steady tempo. Bar 16 turn expanded from the source MIDI ornament; grace notes steal 1/8 beat. Fermatas, rubato, slurs and editorial pedal/dynamic shaping are not performed yet. Closing right-hand chords stay in the treble staff rather than crossing staves.',
  sections: [
    { name: 'Opening · 1–4', bars: [1, 4] }, { name: 'Descending harmony · 5–8', bars: [5, 8] },
    { name: 'First phrase ending · 9–12', bars: [9, 12] }, { name: 'Return and turn · 13–16', bars: [13, 16] },
    { name: 'Climax · 17–20', bars: [17, 20] }, { name: 'Quiet ending · 21–25', bars: [21, 25] },
  ],
  practice: ['Listen to each section and follow both staves.', 'Practise each hand separately, then together at 50%.', 'Keep the repeated left-hand chords quiet beneath the melody.'],
  right: [
    'B3:8. B4:16', // pickup
    'B4:2. C5:4', 'B4:2. C5:4', 'B4:2. C5:4', 'B4:2. Bb4:4',
    'A4:2. B4:4', 'A4:2. B4:4', 'A4:2. B4:8. A4:16', 'A4:2. G#4:4~',
    'G#4:4 A4:8 B4:8 D5:8 C5:8 E4:8 A4:8', 'F#4:2. A4:4', 'F#4:2. ^B4 A4:4',
    'G4:8 F#4:8 C4:8 B3:8 D#4:8 F#4:8 D5:8t C5:8t B4:8t',
    'B4:2. C5:4', 'B4:2. C5:4', 'B4:2. C5:4',
    'B4:8. A#4:16 A#4:8. B4:64 A#4:64 G##4:64 A#4:64 G5:4 F#5:8. E5:16',
    'E5:8 D#5:8 C6:8 D#5:8 D#5:8 E5:8 G5:8 B4:8',
    'D5:8 C5:8 E5:8t E4:8t A4:8t F#4:4. A4:8', 'F#4:2. ^B4 A4:4',
    'F#4:2.~ F#4:8. E4:16', 'E4:2. F#4:4', 'E4:2. F#4:4', 'E4:2 r:2',
    '[E3,F#3,B3,E4]:2 [D#3,F#3,B3,D#4]:2', '[E3,G3,B3,E4]:2.',
  ].join(' | '),
  left: [
    'r:4',
    chords(['G3,B3,E4', 8]),
    chords(['F#3,A3,E4', 4], ['F#3,A3,Eb4', 4]),
    chords(['F3,A3,Eb4', 4], ['F3,A3,D4', 2], ['F3,G#3,D4', 2]),
    chords(['E3,G#3,D4', 4], ['E3,G3,D4', 2], ['E3,G3,C#4', 2]),
    chords(['E3,G3,C4', 4], ['E3,F#3,C4', 4]),
    chords(['E3,F#3,C4', 4], ['D#3,F#3,C4', 4]), chords(['D3,F#3,C4', 8]),
    chords(['D3,F3,C4', 4], ['D3,F3,B3', 4]),
    chords(['C3,E3,B3', 2], ['C3,E3,A3', 6]),
    chords(['B2,E3,A3', 2], ['B2,D#3,A3', 2], ['C3,E3,A3', 4]),
    chords(['B2,D#3,A3', 4], ['C3,E3,A3', 4]), '[B2,D#3,A3]:4 r:4 r:2',
    chords(['G3,B3,E4', 8]), chords(['F#3,A3,E4', 4], ['F3,A3,Eb4', 4]),
    chords(['F3,Ab3,Eb4', 2], ['F3,Ab3,D4', 2], ['E3,G#3,D4', 4]),
    chords(['E3,G3,D4', 2], ['E3,G3,C#4', 2], ['C#3,E3,A#3', 2], ['C3,E3,A3', 2]),
    chords(['B1,B2', 1], ['A3,C4,F#4,A4', 3], ['G3,B3,D#4,F#4', 1], ['G3,B3,E4', 3]),
    `${chords(['A3,C4,E4', 2])} A2:8 ${chords(['E3,F#3,C4', 1], ['B2,E3,B3', 2], ['C3,E3,A3', 2])}`,
    chords(['B2,E3,B3', 4], ['C3,E3,A3', 4]),
    chords(['B2,E3,B3', 4], ['B2,D#3,B3', 2], ['B2,D#3,A3', 2]),
    chords(['C3,G3', 4], ['C3,Bb3', 2], ['C3,E3,A3', 2]),
    chords(['B2,E3,A3', 2], ['B2,E3,G#3', 2], ['B2,E3,G3', 4]),
    '[Bb2,C3,G3]:2 r:2', '[B1,B2]:2 [B1,F#2,B2]:2', '[E1,E2]:2.',
  ].join(' | '),
})
