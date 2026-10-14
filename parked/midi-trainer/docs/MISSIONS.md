# Missions — design spec

How missions, levels, scoring and recitals work. **Status: planned (2026-10-04) — nothing is
built.** Numbers (windows, weights, crowd points) are starting values to tune with Jason on a
real keyboard. The pattern comes from DJ Trainer's mission engine (PORTING.md); when you
build a part, add an "As built" paragraph under it.

## Vocabulary

- **Mission** — one playable level: a Lesson 🎓, Drill 🔁, Piece 🎼, Challenge ⚡ or
  Recital 🎤 (see CURRICULUM.md).
- **Piece** — a score with a title and sections (MUSIC.md). A drill's short phrase is a score
  too, written inline.
- **Step** — one objective inside a mission ("play bars 1–4 with the right hand").
- **Template** — a reusable kind of step (`playWait`, `playInTime`, `readNote` …). Missions
  are built from templates; new templates are engine work, new missions are content work.
- **Group** — all score notes that start on the same beat (a single note, or a chord across
  both hands). The matcher and wait mode work group by group.
- **Bot** — a scripted solution that plays the mission through the same input path as a human.

## Play modes

As built (2026-10-09): the piece screen has Listen for a whole piece/section, with count-in,
pause, rate and looping. It uses `game/player.ts`; no reusable templates, matching or scoring
exist yet. Full/Staff/Page are implemented for this player.

As built (2026-10-09, later): the same player has two more buttons. **Play along** = the line
keeps moving after a count-in and the player plays. **Practise** = wait mode: no count-in; the
line runs at the chosen speed between groups and stops on each group until every note of it
has had a fresh key press (wrong keys do nothing; a group played just before the line arrives
does not stop it). Both are silent by default, so only the player's own notes are heard;
"Hear the piece while I play" makes the game sound the score too. Section, Loop section,
Hands and Speed apply to all three. Nothing is scored yet; the table below is still the plan
for scoring.

| Mode | Transport | Scores | Used for |
|---|---|---|---|
| **Wait** | stops at each group until the right keys are down | first-try accuracy, no timing | first contact with a passage |
| **Tempo** | runs at 50–100 % of the piece's tempo | notes + timing | practice, drills |
| **Performance** | runs at full tempo, never waits, no pause or retry | notes + timing + flow | recitals, challenges |

## Level flow

Every mission, without exception:

1. **Briefing** — what you'll learn, which hand(s), assist level.
2. **Count-in** — one or two bars of metronome clicks at the step's tempo, so the player can
   feel the beat. No count-in before a Wait step (nothing is timed).
3. **Steps** — objectives in order. The HUD shows the active step.
4. **Ending** — the last bar rings out to its full length; a drill that stops on an unfinished
   phrase gets a closing chord from the game. Nothing stops mid-bar.
5. **Results** — score tally, stars, grade, XP, one specific coach tip, Retry / Next / Watch.

Fail states: challenge time-out, recital crowd meter empty, or Quit. Failing still shows
results and a tip.

## Mission files

Missions are **TypeScript data modules** (typed, so `tsc` catches mistakes). One file per
mission; the file name is the id.

```
src/content/venues/v1-living-room/1.11-ode-to-joy.ts   one mission = one file (default export)
src/content/index.ts                registry: picks up every venues/*/*.ts automatically
src/content/templates/*.ts          step templates (engine-side, reviewed carefully)
src/content/pieces/*.ts             one piece per file (MUSIC.md)
src/game/                           the engine: snapshot, matcher, steps, scoring, runner, bot, validator
```

A sketch of a mission (field names may change when it is built — keep this example current):

```ts
import { defineMission, listen, playWait, playInTime, playScore } from '../../templates'
import odeToJoy from '../../pieces/ode-to-joy'

export default defineMission({
  id: '1.11-ode-to-joy', venue: 1, order: 11, type: 'piece',
  title: 'Ode to Joy', blurb: 'Your first real tune, right hand only.',
  teaches: ['rh.c-position', 'read.treble.c4-g4', 'rhythm.quarter', 'rhythm.half'], xp: 300,
  assists: ['full', 'staff', 'page'],
  brief: ['Beethoven wrote this tune for a whole orchestra…', 'Your right thumb sits on middle C…'],
  score: odeToJoy, hands: 'right',
  steps: [
    listen({ label: 'Listen first', bars: [1, 4] }),
    playWait({ label: 'Bars 1–4: the music waits for you', bars: [1, 4] }),
    playInTime({ label: 'Bars 1–4 in time, slowly', bars: [1, 4], rate: 0.6 }),
    playInTime({ label: 'The whole tune', bars: [1, 8], rate: 1 }),
  ],
  bot: playScore(),          // the default bot: play what the score says
})
```

**Spec fields** (planned): `id` (= file name) · `venue` · `order` · `type`
(`lesson`/`drill`/`piece`/`challenge`/`recital`) · `title` · `blurb` · `teaches` ·
`unlockAfter?` · `xp` · `assists` (first = default) · `brief` · `score` (a piece, or an inline
phrase) · `hands` (`right`/`left`/`both`) · `accompany?` (the game plays the other hand) ·
`countInBars?` · `timeLimit?` · `steps` · `tip?` · `bot`.

### What a mission may read (the state snapshot)

Steps, templates and bots only read a **read-only snapshot**, built once per frame on the
audio clock, never engine internals:

- `t` (AudioContext time), `dt`, `latency` (output, seconds)
- `transport`: `running`, `waiting` (wait mode is holding for the player), `beat` (continuous
  beats since bar 1; negative during the count-in), `bar`, `beatInBar`, `bpm` (tempo × rate),
  `rate`, `timeSig`
- `held`: the keys down right now (MIDI note → velocity) · `pedal`: sustain, 0–1
- `events`: note on / note off / pedal since the last frame, each with its audio-clock time
  `at` and `heardBeat` — the beat the player was **hearing** when they played it
- `score`, and `due`: the next group the player has to play
- `judged`: the matcher's results so far — per score note: hit or miss, ms error, velocity,
  how long it was held; plus `extras` (played notes that matched nothing)

### The matcher

Lines up what was played with what the score asks for. It is the heart of scoring; one
implementation, used by every template.

- **Tempo and performance modes:** a played note matches the nearest unmatched score note of
  the **same pitch** inside the timing window. The window is never wider than half the gap to
  the next score note of that pitch, so repeated notes can't steal each other's match. A
  score note nobody matched is a **miss**; a played note that matched nothing is an **extra**
  (a wrong note).
- **Wait mode:** the transport holds at each group until all its keys are down. Wrong keys
  pressed meanwhile are extras; the group scores 100 only if it was right first time.
- **Hands:** MIDI doesn't say which hand played. Each score note carries its hand, so results
  per hand come from the score, not from the input.
- **Chords:** the notes of one group count as together when they start within 50 ms.

### Step templates

| Template | Scores | Phase |
|---|---|---|
| `reach({ label, when })` | nothing (gate) — waits until a condition is true | 1 |
| `listen({ bars })` | nothing — the game plays the passage; staff and keys show it | 1 |
| `playWait({ bars, hands })` | first-try accuracy per group, wrong keys | 1 |
| `playInTime({ bars, hands, rate })` | every note: hit / miss / extra + timing in ms | 1 |
| `pressKeys({ keys })` | nothing or first-try — find named keys on the keyboard, untimed | 2 |
| `tapRhythm({ pattern })` | timing of taps on any key against a written rhythm | 2 |
| `readNote({ rounds, clef, range })` | flashcards: a note appears on the staff, press it — right/wrong + reaction time | 2 |
| `perform({ piece })` | composite: notes 50 %, timing 30 %, flow 20 % (no stops) | 2 |
| `sightRead({ bars })` | like `perform`, on bars the player has never seen, one take | 3 |
| `echo({ phrase })` | the game plays, the player repeats by ear | 7 |
| `sequence([...])` / `parallel([...])` | combinators | 1 |

Every scored template takes `weight` (share of the mission score, default 1) and `tips`
(override the coach tip per weak area).

## Assist levels (D-04)

| Level | Shows | XP |
|---|---|---|
| Full | Staff with cursor **plus** falling notes, lit keys, note names, finger numbers | ×1 |
| Staff | Staff with a moving cursor and hit/miss colours — no falling notes, no lit keys | ×1.5 |
| Page | The still staff, like paper: no cursor, no colours until the results | ×2 |

The staff is on screen at every level; falling notes sit next to it, never instead of it.
Lessons are always Full. From Venue 2 on, a piece can only enter a recital once it has a star
at Staff or Page.

## Scoring

- **Notes:** hit · miss · extra. A wrong note costs the same as a missed one.
- **Timing grades** (ms from the beat the player heard): PERFECT < 20 · GREAT < 40 ·
  GOOD < 80 · OK < 150 · MISS ≥ 150 → points 100 / 85 / 65 / 40 / 10.
- **Mission score** 0–100 = weighted mean of its scored steps.
- **Stars**: ≥ 60 ★ · ≥ 80 ★★ · ≥ 92 ★★★. **Grade**: S ≥ 95, A ≥ 85, B ≥ 70, C ≥ 55, D.
- **XP** = mission XP × score/100 × assist multiplier.
- **Flow** (`perform`): a hesitation is a stretch longer than one bar where notes were due and
  none was played. Keeping the pulse through a wrong note costs little; stopping costs a lot.
- **Combo** (display only): consecutive GREAT+ notes. It never changes the score.
- **Coach tip**: the lowest-scoring step's weakest area as one concrete thing to try, e.g.
  "Your left hand was about 60 ms late in bars 5–6 — play those two bars left hand alone."
- **Later (ROADMAP Phase 5):** tempo steadiness, hands together (per-hand timing), dynamics
  (judged as contrast between soft and loud passages, because velocity curves differ per
  keyboard), note length, pedal changes.

## Learning a piece (the ladder)

A piece is learned the way a teacher teaches it, section by section (2–8 bars):

listen → right hand (wait) → right hand in time → left hand (wait) → left hand in time →
hands together (wait) → together slowly → together at tempo → the whole piece.

Phase 1 writes this ladder by hand for one piece. Phase 2 adds `definePiece`, which builds the
practice missions from a piece's sections so new pieces need no hand-written steps.

## Recitals

- A **programme** of 2–4 pieces from the venue, each played once in Performance mode.
  Applause and a new count-in between pieces.
- **Crowd meter** 0–100, starts at 60: clean section +5 · piece finished +10 · streak bonuses ·
  wrong or missed note −1 · hesitation −10. At 0 the audience has stopped listening → failed.
- **Streak** = clean sections in a row → crowd gains ×1.5, then ×2.
- **Encore**: ≥ ★★ unlocks one bonus piece.
- Results: a row per piece (notes, timing, flow), best and worst bar, crowd, best streak.

## Bot solutions & testing

Every mission ships a `bot`: timed note events sent through the **same path** as the keyboard
(`dispatch` → engine → mission), never by poking state. The default, `playScore()`, plays the
mission's score exactly; options make it imperfect on purpose (`late: 30`, `miss: [bar, beat]`)
to test scoring. A headless test plays every mission with its bot and fails below ★★. The
same bot powers the in-game **Watch** mode.

## Validation (`npm run validate`)

Planned checks: file name = id, folder `v<venue>-…`, id starts with `venue.order`, unique
ids; `unlockAfter` ids exist; `teaches` tags exist in CURRICULUM.md's glossary; brief 1–3
short paragraphs; a bot exists; at least one scored step (except lessons); every `bars` range
exists in the score; the score fits the declared key range; the piece has a source and licence.

## Writing mission text

Plain words, second person, short. Name the physical thing ("the group of two black keys",
"your right thumb"). Introduce a term before using it. Max 3 short brief paragraphs. Coach
tips are specific, never "try to be more accurate".
