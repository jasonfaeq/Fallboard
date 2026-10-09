import { definePiece } from '../../engine/score'

// Own explicit-pitch transcription of Mutopia-2011/09/12-5's public-domain score.
// Each row is one bar: held bass, held inner note, then the three arpeggio pitches.
const harmony = [
  ['C4', 'E4', 'G4', 'C5', 'E5'], // 1
  ['C4', 'D4', 'A4', 'D5', 'F5'],
  ['B3', 'D4', 'G4', 'D5', 'F5'],
  ['C4', 'E4', 'G4', 'C5', 'E5'],
  ['C4', 'E4', 'A4', 'E5', 'A5'],
  ['C4', 'D4', 'F#4', 'A4', 'D5'],
  ['B3', 'D4', 'G4', 'D5', 'G5'],
  ['B3', 'C4', 'E4', 'G4', 'C5'],
  ['A3', 'C4', 'E4', 'G4', 'C5'],
  ['D3', 'A3', 'D4', 'F#4', 'C5'], // 10
  ['G3', 'B3', 'D4', 'G4', 'B4'],
  ['G3', 'Bb3', 'E4', 'G4', 'C#5'],
  ['F3', 'A3', 'D4', 'A4', 'D5'],
  ['F3', 'Ab3', 'D4', 'F4', 'B4'],
  ['E3', 'G3', 'C4', 'G4', 'C5'],
  ['E3', 'F3', 'A3', 'C4', 'F4'],
  ['D3', 'F3', 'A3', 'C4', 'F4'],
  ['G2', 'D3', 'G3', 'B3', 'F4'],
  ['C3', 'E3', 'G3', 'C4', 'E4'],
  ['C3', 'G3', 'Bb3', 'C4', 'E4'], // 20
  ['F2', 'F3', 'A3', 'C4', 'E4'],
  ['F#2', 'C3', 'A3', 'C4', 'Eb4'],
  ['Ab2', 'F3', 'B3', 'C4', 'D4'],
  ['G2', 'F3', 'G3', 'B3', 'D4'],
  ['G2', 'E3', 'G3', 'C4', 'E4'],
  ['G2', 'D3', 'G3', 'C4', 'F4'],
  ['G2', 'D3', 'G3', 'B3', 'F4'],
  ['G2', 'Eb3', 'A3', 'C4', 'F#4'],
  ['G2', 'E3', 'G3', 'C4', 'G4'],
  ['G2', 'D3', 'G3', 'C4', 'F4'], // 30
  ['G2', 'D3', 'G3', 'B3', 'F4'],
  ['C2', 'C3', 'G3', 'Bb3', 'E4'],
]
const arpeggio = (pitches: string[]) => 'r:8 ' + [...pitches, ...pitches].map((p) => `${p}:16`).join(' ')
const right = harmony.map(([, , ...pitches]) => [arpeggio(pitches), arpeggio(pitches)].join(' '))
right.push(
  'r:8 F3:16 A3:16 C4:16 F4:16 C4:16 A3:16 C4:16 A3:16 F3:16 A3:16 F3:16 D3:16 F3:16 D3:16',
  'r:8 G4:16 B4:16 D5:16 F5:16 D5:16 B4:16 D5:16 B4:16 G4:16 B4:16 D4:16 F4:16 E4:16 D4:16',
  '[E4,G4,C5]:1',
)
const inner = harmony.map(([, p]) => `r:16 ${p}:8.~ ${p}:4 r:16 ${p}:8.~ ${p}:4`)
inner.push('r:16 C3:8.~ C3:4~ C3:2', 'r:16 B2:8.~ B2:4~ B2:2', 'C3:1')
const bass = harmony.map(([p]) => `${p}:2 ${p}:2`)
bass.push('C2:1', 'C2:1', 'C2:1')

export default definePiece({
  id: 'bach-bwv846', title: 'Prelude No. 1 in C major · BWV 846', composer: 'Johann Sebastian Bach',
  source: 'The Well-Tempered Clavier, Book I (1722). Own transcription from Mutopia-2011/09/12-5, maintained by Tobias Erbsland; original edition unknown. https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=5',
  licence: 'public-domain composition and public-domain typesetting; own transcription',
  verified: false, tempo: 60, key: 'C', time: [4, 4],
  right: right.join(' | '), left: [inner.join(' | '), bass.join(' | ')],
  sections: [
    { name: 'Opening · bars 1–4', bars: [1, 4] },
    { name: 'First journey · bars 5–8', bars: [5, 8] },
    { name: 'Changing harmony · bars 9–12', bars: [9, 12] },
    { name: 'Descending bass · bars 13–16', bars: [13, 16] },
    { name: 'Return towards C · bars 17–20', bars: [17, 20] },
    { name: 'Tension · bars 21–24', bars: [21, 24] },
    { name: 'G pedal · bars 25–28', bars: [25, 28] },
    { name: 'Final approach · bars 29–32', bars: [29, 32] },
    { name: 'Closing · bars 33–35', bars: [33, 35] },
  ],
  practice: [
    'Listen to the opening at 50% speed and hear the same eight-note pattern twice in each bar.',
    'Practise the right-hand three-note shape evenly, without accenting every thumb return.',
    'Hold the left-hand bass for two beats, then add the inner note one sixteenth later and keep it held.',
    'Loop a four-bar section slowly. Keep the harmony changes smooth before increasing speed.',
    'Learn bars 33–35 separately: the right-hand pattern changes and the final chord closes the piece.',
  ],
  notes: 'All 35 bars, without the later Schwencke insertion. Independent left-hand voices retain their held lengths. Bar 33 stays on the treble staff here. Steady practice playback; the final arpeggio and fermata are shown as a simultaneous chord of written length, without expressive pedal or dynamics.',
})
