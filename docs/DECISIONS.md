# Decisions

Dated log of settled choices. Newest at the bottom. To change one, add a new entry that
supersedes it — don't edit history.

Format: **D-nn · date · title** — decision. *Why.* (Supersedes/consequences if any.)

D-01 to D-12 were written with the first docs, before any code, from Jason's brief and from
what DJ Trainer already settled. Jason can overrule any of them with a new entry.

---

**D-01 · 2026-10-04 · A separate repo, copied from DJ Trainer** — Piano Trainer is its own
project. Code comes across by copying and adapting (PORTING.md); there is no shared library
and DJ Trainer is never edited from here. *DJ Trainer's mission engine is written against two
decks, a crossfader and phrases, so the design transfers but the code does not; a shared
framework would slow both games down.*

**D-02 · 2026-10-04 · Browser stack** — Vite + React + TypeScript, Web Audio, Web MIDI; no
Tauri/Rust yet. *Same as DJ Trainer (its D-01): fastest iteration, and the project setup can
be copied.*

**D-03 · 2026-10-04 · MIDI keyboards only** — input is MIDI note on/off, velocity and sustain
pedal. No microphone, no acoustic pianos. *MIDI is exact and identical on every keyboard, so
there is no per-model mapping; polyphonic pitch detection from a microphone is a research
project of its own.*

**D-04 · 2026-10-04 · Assist ladder: Full → Staff → Page** — Full shows falling notes, lit
keys and note names next to the staff (XP ×1); Staff shows only the staff with a moving
cursor (×1.5); Page shows the still staff like paper (×2). The staff is visible at every
level. *Falling notes alone teach the game, not the piano; the staff must always be in view
so reading is learned from the first mission.*

**D-05 · 2026-10-04 · Score what the audience hears** — right notes, timing in ms against
the beat the player was hearing, later steadiness, hands together, dynamics, note length and
pedal. Never fingering or posture. *MIDI can't see hands; scoring only what is audible keeps
the score honest.*

**D-06 · 2026-10-04 · One clock: a Transport on the audio clock** — the piece's position in
beats is computed from `AudioContext.currentTime`. Practice (wait) mode pauses the transport
until the right notes are down; tempo mode runs it at 50–100 % speed; performance never
waits. *One timing model for every mode; same rule as DJ Trainer's audio-clock timing.*

**D-07 · 2026-10-04 · Missions and pieces are data, each with a bot** — TypeScript data
modules built from step templates. A piece's default bot simply plays its score through the
normal input path; tests and the in-game Watch mode use it. *Same as DJ Trainer's D-11.*

**D-08 · 2026-10-04 · Our own Score model is the source of truth** — game logic, matching
and bots read our `Score` type only. Drills are written in a small text notation; a MusicXML
importer comes later. The staff renderer is a drawing layer fed from the Score. **Which
renderer is still open**: Phase 1 runs a short spike (candidates: VexFlow — MIT;
OpenSheetMusicDisplay — BSD-3; abcjs — MIT; or our own drawing for beginner scores) and
records the result as a new decision after asking Jason. *Keeps the game independent of any
file format or library; engraving is the one place a dependency probably earns its keep.*

**D-09 · 2026-10-04 · Synthesised piano first** — the first piano voice is built from Web
Audio oscillators and envelopes, in our own code. A sampled grand piano comes with the
look-and-feel phase, after a licence check. *No assets and no licensing in the first slice
(like DJ Trainer's procedural tracks, its D-03).*

**D-10 · 2026-10-04 · Licences** — dependencies: MIT/BSD/ISC/Apache-2.0/zlib only; no
GPL/AGPL/LGPL code. Shipped pieces: public-domain compositions in our own arrangements, or
original. Nothing copyrighted is committed. *Same as DJ Trainer's D-13; keeps the paid
version possible.*

**D-11 · 2026-10-04 · Desktop build = Tauri, later** — when the time comes, with native
low-latency audio. *Jason knows Tauri (DJ Trainer's D-14); browser output latency is the main
technical risk for keyboards without their own sound.*

**D-12 · 2026-10-04 · Shared agent instructions** — `AGENTS.md` is the single source of truth
for Claude, Codex and Antigravity; `CLAUDE.md` imports it. Design docs live in `docs/`.

**D-13 · 2026-10-09 · The piece player comes first, the career second** — the first thing
built is a player for one real piece: the staff always on screen, falling notes and lit keys
as an optional view, tempo 50–100 %, section loop, and four modes — Listen (the game plays),
Wait (the piece waits for the right notes), Play in time (a cursor moves, the game is silent
for the player's part), Play with guide (the game plays the piece too). Venues, XP and
recitals wrap around it afterwards. *Jason is a returning beginner who wants to play pieces
he knows now; the player is also the core every mission needs.* (Reorders ROADMAP phases 1–2;
the view toggle is the same ladder as D-04, which still sets the XP.)

**D-14 · 2026-10-09 · Sampled grand piano from the first slice** — the game's piano voice is
a sampled grand from Phase 1, not a synthesised one. Candidate: Salamander Grand Piano;
**verify its licence allows bundling in a paid app before using it**, and fall back to the
synthesised voice if it does not. *Listen and guide modes are how Jason learns what a piece
should sound like, and how he proof-reads a transcription; a thin synth undermines both.*
(Supersedes D-09.)

**D-15 · 2026-10-09 · Pieces are transcribed by hand, from Phase 1** — Jason hands over sheet
music and an agent writes the piece file (notes, hands, sections, suggested fingering,
practice plan). `verified` stays false until Jason has heard it in Listen mode and confirmed
the notes. Public-domain compositions are committed; anything else goes in the git-ignored
personal folder. The automatic MusicXML/MIDI importer stays a later phase. *No importer is
needed to add a few pieces, and it is the thing Jason asked for first.* (Moves part of
ROADMAP Phase 6 forward; the first pieces need more of the text notation than Venue 1 would
have — chords, ties, triplets, accidentals, two hands.)

**D-16 · 2026-10-09 · The staff is drawn with VexFlow** — VexFlow 5 (MIT), imported from
`vexflow/bravura` so the music font is bundled and nothing is fetched at run time. Jason
approved the dependency. The spike (`src/ui/StaffSpike.tsx`) drew four two-hand bars of the
Chopin prelude in under 250 ms, read each note's x position (`getAbsoluteX`) and coloured
single notes (`setStyle`). We lay out the bars and decide the accidentals ourselves:
VexFlow's `Accidental.applyAccidentals` repeated accidentals when given two voices. Every
note, beam and ledger line needs its colour set, or it is drawn black. The single-file build
grew to about 880 KB. *It gives real engraving (beams, ledger lines, accidentals, clefs) for
a few lines of our code; writing that for the Moonlight's triplets would take far longer.*
(Closes the open question in D-08.)

**D-17 · 2026-10-09 · Local Salamander sample bank** — D-14's licence check passed:
the original archive's metadata (https://archive.org/metadata/SalamanderGrandPianoV3) names
Alexander Holm and CC BY 3.0; the Creative Commons licence permits commercial redistribution
with attribution. Bundle Tonejs/audio's 30-note MP3 conversion at commit
`efd8296360f9526e379bfbe5c1698ff54d6a1d34`, with the original README, source/hash manifest,
notice and UI credit. CC BY is an asset licence, separate from D-10's code dependency rule.
Use native Web Audio playback, nearest-sample transposition, velocity gain and sustain.
*About 2 MB, works locally with no runtime CDN or new dependency. This first voice uses one
recorded layer; the full 16-layer library and resonance are not implemented. Jason still
needs to judge its sound/latency on the DEP-20.*

**D-18 · 2026-10-09 · Explicit pitch text notation on a quarter-note clock** — `definePiece`
reads one string per hand, `|` bars, explicit spelled octave/pitch and duration on each token
(`F#4:8`, `[C4,E4,G4]:2.`). Whole-chord ties, grace notes and eighth triplets cover the first
Chopin piece; playback merges ties while retaining separate engraving events. The engine
uses quarter-note beats even for 2/2, with a negative pickup and explicit shortened final
bar. The complete transcription comes from Mutopia 921's public-domain Peters-based parts;
the printed turn is expanded using its note realisation. *Readable diffs and validation of
every bar, without an importer or new dependency. Steady practice playback omits rubato,
fermata extensions and expressive pedal/dynamic shaping; Jason confirms the notes in Listen
before `verified` changes.*

**D-19 · 2026-10-09 · Independent score voices for Bach BWV 846** — Jason requested
Prelude No. 1 in C major as an additional piece. A hand may now contain an array of notation
strings, each a simultaneous voice with independently validated bar lengths and ties.
VexFlow aligns those voices on the same staff, with opposing stems. *Bach's held bass and
delayed inner note overlap; shortening either into a sequential stream would change the
music. No importer or dependency is needed. The 35-bar public-domain Mutopia-5 source is
transcribed in explicit pitches and remains unverified until Jason confirms it in Listen.*

**D-20 · 2026-10-14 · A sheet music reader first; the MIDI trainer is parked** — Jason:
"put all the MIDI stuff on hold". He wants a proper sheet music reader that shows the sheet
music, the keys, or both; imports what he downloads from MuseScore; plays it back; and can
show the music in 1, 2, 3 or 4 rows. The MIDI input and monitor, the Play along / Practise
modes (including the then-uncommitted work), the text-notation score model, the VexFlow
staff and the mission/career docs move to `parked/midi-trainer/` as a complete snapshot, with
a README on how to bring them back. *Jason's call. The reader is useful without a keyboard,
and its score display, timeline and playback are what the trainer needs later anyway.*
(Supersedes D-13 for now. D-03, D-05, D-07, D-15, D-18 and D-19 are parked with the code;
they apply again if the trainer returns, through a new entry.)

**D-21 · 2026-10-14 · MusicXML, drawn by OpenSheetMusicDisplay** — Scores are MusicXML
(`.mxl`, `.musicxml`, `.xml`), which musescore.com (Download → MusicXML) and MuseScore Studio
(File → Export) both produce. OpenSheetMusicDisplay 2.1.3 parses and draws them; Jason approved
the dependency on 2026-10-14. Licences: OSMD BSD-3-Clause; its VexFlow 1.2.93, loglevel and
typescript-collections are MIT; jszip is MIT-or-GPL, used under MIT; the optional `gl` is
BSD-2 and unused in the browser. Pinned exactly, because 2.2.x was less than two weeks old.
Playback is ours: `reader/timeline.ts` walks OSMD's iterator, which follows repeats and
voltas, merges ties and sounds the written pitches on the Salamander piano (D-17), scheduled
on the audio-clock Transport (D-06). `.mscz`, MIDI and PDF files are refused with a message
saying how to get MusicXML. VexFlow 5 is removed from `package.json`; the parked staff code
needs it back. *OSMD has years of MusicXML engraving behind it (slurs, dynamics, repeats,
several instruments); a renderer of our own would draw real MuseScore files badly for a long
time. Its parsed model gives the playback notes without a second parser.* (Supersedes D-08's
"our own Score model" and D-16 for the reader.)

**D-22 · 2026-10-14 · Rows = zoom to fit** — "Rows: N" picks the zoom at which N lines
(systems) of music fill the sheet panel, measured from the rendered layout. While playing,
the current line stays at the top, so N−1 lines ahead are always visible. 1 row is a single
endless line that scrolls sideways under the playhead. *Jason asked for 2, 3 or 4 rows;
fitting the zoom gives exactly that on any window size, with no separate zoom control.*

**D-23 · 2026-10-14 · Built-in pieces as MusicXML; imports stay in the browser** — The
Chopin and Bach transcriptions (D-15/18/19) were converted once from the parked text
notation to MusicXML in `src/content/scores/`. The converted files sound exactly what the old
model did (604 and 549 notes, 125 s and 140 s; checked by a test). From now on they are
edited as MusicXML, for example in MuseScore. Imported files are stored only in the browser
(IndexedDB); nothing a user imports is written to the repo. *One format for everything, and
copyrighted downloads never reach git (D-10, MUSIC.md).*

**D-24 · 2026-10-16 · The app is called Fallboard** — Jason picked the name. A fallboard
is the hinged lid over a piano's keys, and the name also fits the falling-keys view. It
names the reader that exists today (D-20), not the parked trainer. The visible name (page
title, header, package name) and the repo folder (`Projects\Fallboard`) changed; the
browser storage keys (`piano-trainer-library`, `piano-trainer:*`) keep the old name so
imported scores and settings survive. *Not yet checked against Steam, domains or trademarks.*

**D-25 · 2026-10-16 · MuseScore files open directly, converted by our own reader** — `.mscz`
(and bare `.mscx`) files from MuseScore 2, 3 and 4 are imported: `reader/mscz.ts` unzips
them (the browser's `DecompressionStream`), reads the `.mscx` with `DOMParser` and writes
MusicXML, which is what the library stores and OSMD draws, so the timeline and sheet are
unchanged. It covers parts, staves, voices, chords, rests, grace notes, tuplets, ties,
slurs, beams (MuseScore's marks, else grouped by beat), clefs, keys, times, tempo, dynamics,
text, 8va/8vb, pedal, hairpins, repeats, voltas and jumps; lyrics, chord symbols and layout
are dropped. Checked against MuseScore Studio 4.7.3's own MusicXML export of six files
(Chopin, Bach and the test Ode saved by MuseScore 4, a real MuseScore 2 download in MS2 and
MS4 form, and MuseScore's 25-part test score): the same notes, times, spelling, beams, ties
and repeats. Transposing instruments come out at concert pitch. *Jason asked for getting
scores to be easy (2026-10-16). MuseScore's own converter (webmscore) is GPL, ruled out by
D-10, and a MIDI file has no notation.* Not built: downloading from musescore.com the way
LibreScore/dl-librescore do. Those tools get around MuseScore's download paywall and fetch
page images and MIDI, not notation; that has no place in a paid app. The `app-librescore`
zip Jason shared holds only its docs, translations and a build workflow, no downloader.
(Supersedes D-21's refusal of `.mscz`, and the `.mscz` non-goal in VISION.md.)

**D-26 · 2026-10-17 · A player-style layout, and loops that speed up** — Jason asked for a
nicer-looking app with better features. The two rows of buttons became a top bar (scores,
title, view, rows, full screen, help) and a dock under the music like a media player
(scrubber; position and hands; start, previous bar, play, next bar, loop; speed, metronome,
count-in), with the settings used now and then (speed presets, transpose, note names, sheet
colours, volume) in a popover. The sheet sits on a card, the keys are shaded with a felt
strip and glowing lit keys, falling notes glow while they sound, and the Scores drawer has
covers, an import area and search. New: drag the line between sheet and keys to resize them
(remembered); full screen (F); previous/next bar buttons; a loop repeat count; and **Speed up
loops**, which plays a loop 5 % faster each time round until 100 %. Hand colours (gold
right, blue left) and every shortcut are unchanged; no dependency was added (icons are our
own SVG). *Practice tools stay first (pillar 3): speeding a loop up gradually is the usual
way to learn a hard passage, and a resizable split lets the keys or the sheet take the room.
Fewer always-visible controls make the music the biggest thing on screen.*

**D-27 · 2026-10-17 · Pedal marks hold notes by delaying their note-off** — The timeline reads
OSMD's pedal marks (start, stop, change; lines or Ped./✱) into down/up spans in playing order,
and gives each note a `release`: a note whose key comes up while the pedal is down rings until
the pedal lifts, or until the same key is struck again. A note released exactly as the pedal
goes down is not caught, as in legato pedalling. The pedal belongs to the instrument: a mark
on either staff holds both hands, and muting one hand leaves the other pedalled. A pedal
still down at the end lifts there. *Computing it in the timeline keeps the player simple and
the result testable; seek, pause and loops already stop every note, so nothing can hang.*
To get there the timeline now places everything by played position first and converts to
seconds with one clock, which the tempo marks of D-29 also use.

**D-28 · 2026-10-17 · How dynamics are played** — Each note's velocity comes from the marks
before it: ppp 32, pp 42, p 54, mp 66, mf 78, f 92, ff 106, fff 118; music without marks
plays at mf, and lower staves at 64/78 of the level, exactly today's 78 and 64. sf, sfz, fz,
rf make the notes at the mark 1.2–1.4× louder; fp and sfp play forte, then p. Accents add
×1.2, marcato ×1.3. **A mark sets every staff of its instrument** unless a staff has its own
mark at the same moment: MuseScore applies dynamics to the whole part and usually writes them
on the upper staff, so the left hand would otherwise never change. **A hairpin** grows linearly
from its start to the mark that follows it, if that mark comes within a bar of the hairpin's
end and goes the right way; otherwise it moves one step (14) by its own end and stays there.
*Simple rules that match how the marks are written; the numbers need Jason's ear.*

**D-29 · 2026-10-17 · How fermatas, ritardando and ornaments are played** — All of it goes
through the timeline's clock, so sheet, keys, playhead and scrubber stay together.
**rit., rall., allarg.** (as words or a MuseScore 4 line) slow the tempo linearly to 70 % by
the next tempo mark; **accel.** speeds it to 130 %; **a tempo**, tempo I, a new metronome
mark or a jump back for a repeat restore it; with none of those it runs to the end. A
MusicXML or MuseScore line's own end is not used (OSMD does not keep it). **A fermata**
doubles the last part of its note (from the last step before the note ends), adding at most
1.5 s. **Trills** alternate with the note above at about 0.09 s per note and end on the main
note; **turns, inverted and delayed turns, mordents** play their four or three notes at that
speed and hold the last. Neighbour notes follow the key signature or the ornament's printed
accidental (not earlier accidentals in the bar). Times are score seconds, so ornaments slow
down with the speed slider. OSMD gives some of these words a made-up tempo of its own (it read
"poco accel." as ♩ = 60, so such a bar used to play at half speed); for rit./accel. words that
are not metronome marks the timeline ignores it. *Plain rules that are easy to hear and change; every number is a
guess for Jason to judge.*

**D-30 · 2026-10-17 · A volume per hand instead of a mute** — Jason asked to hear the other
hand quietly rather than not at all. Each staff has a volume 0–100 % (0 = muted), remembered
per score as `volumes` (an old `muted` list is read as 0). The hand chips in the dock stay a
one-click mute and unmute back to the hand's last volume, and show the volume when it is
below 100 %; the sliders live in Settings, where there is room. The volume scales the
note's gain linearly on top of its velocity, so the dynamics are kept. *A slider per hand in
the dock would crowd it; the chips cover the common case.*

**D-31 · 2026-10-17 · A room echo made by our own code** — Settings has a Room choice: Off,
Room, Hall, Large hall (remembered, default Off so nothing changes until Jason picks one).
The echo is a `ConvolverNode` with an impulse response generated at start-up: stereo noise
after a 12 ms pre-delay that dies away by 60 dB over 0.9, 2.2 or 3.6 s and darkens as it
does, mixed in at 0.2, 0.28 or 0.34 beside the dry piano. Only the piano goes through it, not
the metronome. *No dependency and no recorded impulse file to license; four named choices
are easier to compare by ear than a slider.*

**D-32 · 2026-10-17 · Saved sections are named loops by pass** — A section is the loop's first
and last pass (indices into the timeline's passes), with a name that defaults to its bars
("Bars 12–16"); it is kept per score with the other score settings. Pass indices, not printed
bar numbers, so a section in a repeat's second time (or a 2nd ending) loops exactly that.
The list is kept in the order the sections come in the piece; saving the same bars again
renames the old one. It opens from a bookmark button next to the loop button, and `[` / `]`
loop the previous or next section, which is how Jason would move between hard passages at the
piano. *If a built-in score's bars change in a later version, an out-of-range section is
ignored rather than guessed.*

**D-33 · 2026-10-17 · Speed up loops: a step, a start and a target** — The step is 2, 5 or
10 % per time round, the target 50–200 % (so a passage can be pushed past tempo), and the
start either "the speed now" (today's behaviour, the default) or 25–150 %. The start speed is
applied when Jason makes a loop (L, Shift+click, picking a section), not on every Play, so
pausing in the middle of the ramp and playing on keeps the speed reached; making the loop
again starts the ramp again. A loop restored when a score reopens keeps the score's speed.
Defaults are +5 % up to 100 % from the speed now, as in D-26. *Lists of fixed choices are
quicker to set at the piano than free numbers.*

**D-34 · 2026-10-17 · Count-in in bars or beats, and per loop** — The count-in is 1–4 bars or
1–8 beats (default one bar, as before), counted at the beat where playback starts. Clicks a
whole bar before the start are accented, so "2 beats" in 4/4 is two plain clicks and "2 bars"
accents both bar starts. **Count in each loop** is a setting under count-in and needs the
dock's Count-in on: when the loop comes round the music stops for the count-in, then plays the
loop again. The jump is the usual loop jump, so the first click can be ~20 ms late. *One
on/off chip stays in the dock for the common case; the length is set once in Settings.*

**D-35 · 2026-10-17 · Go to bar goes to the first time a bar is played** — A printed bar
number can be played more than once (repeats, D.C.). Go to bar picks the first pass with that
number, not the one nearest the playhead: it is predictable, matches reading the score from
the top, and the next-bar button or a click on the music reaches a later time through. *The
"nearest" rule would make the same number land in different places depending on where you
were.*

**D-36 · 2026-10-17 · Metronome only is a mode, not remembered** — Metronome only mutes what
the piano receives and keeps everything else (playhead, lit notes, falling keys, the click
even with the metronome off), so Jason can play the part himself to the click. It is not
saved: opening the app to silence would look broken. While on, the dock's Metronome chip
says so and one click turns the music back on; Shift+M toggles it. The accented first beat
already existed (a higher, louder click); it is now a setting, on by default, that also
covers the count-in. *The accent's level and pitch were left as they were for Jason to
judge by ear.*

**D-37 · 2026-10-18 · Vercel hosts the app as a plain Vite project** — The app is one static
Vite build with no backend, so it deploys as an ordinary Vercel project: Vercel detects Vite,
runs `npm run build` and serves `dist/`. There is no `vercel.json`; there are no client routes
to rewrite. `.vercelignore` keeps Jason's `public/scores/` (and other local files) out of CLI
deploys, since the CLI doesn't read `.gitignore`. *Vercel Services was considered and dropped:
nothing calls anything, and the parked trainer can't build on its own and stays parked.*

**D-38 · 2026-10-19 · A music desk with an optional focus mode** — Jason asked for a broad
upgrade to the reader's appearance and usability. The reader now sits on a warm ivory desk
with a charcoal sidebar, a larger score heading and a centred score library. Playback and
practice controls occupy separate rows, keeping play centred as the window narrows. The
library has search, source filters and sorting; Import score opens a file picker directly.
The minimum sheet zoom is 0.25 so four rows still fit beside the new controls (D-22).
Focus (Z) temporarily hides the sidebar and heading without changing the score, position,
loop or playback. Paper/night is available beside the view controls. The progress bar and
sheet/keys divider work from the keyboard, modal dialogs contain focus and restore it when
closed, and reduced-motion preferences are respected. *The score remains the main surface;
focus is temporary so the next visit still has an obvious way into the library. The gold
right hand and blue left hand, audio clock, local storage and existing reader tools stay
the same. No dependencies, remote fonts or services were added.*

**D-39 · 2026-10-19 · A performance stage and a map of played passages** — Jason chose the
Performance concept and approved building the physical piano, performance view and passage
map first. P opens a full-width keys stage, keeping the previous reading view for when it
closes. Controls fade while playing after 2.4 seconds without input, and reveal on pointer
movement, keyboard input or focus; open panels and reduced motion keep them visible. The
piano has visible key travel, ivory faces, black-key bevels, front lips, felt and a wood rail.
Lighting follows active score notes and authored velocities, with a remembered 0–100 %
control; reduced motion removes decorative light and movement transitions. *This uses the
same score time and sampled piano; the UI idle timer never schedules notes.*

V opens a passage map with note density and current position. Automatic passages contain
up to four consecutive played bars and split at repeats/jumps. They are navigation groups,
not inferred musical phrases. Select to seek, loop the range, drag or use arrows on its
boundaries, and save a name. Names reuse D-32's sections and pass indices; custom loop
labels show each consecutive run when crossing a repeat. *A printed bar can occur more
than once, so every repeated pass must retain its own address. No new storage model or
dependency is needed.*

**D-40 · 2026-10-19 · A local collection with ordered listening setlists** — Jason asked
to build the remaining reader ideas. Each score gets an original CSS book jacket derived
from its title and composer; no downloaded art is used. Favourites and named, ordered
setlists live in localStorage alongside the IndexedDB score library. Setlists can be
renamed, reordered and edited; Play starts at the beginning of each score, without its
saved loop, and advances on natural completion. Saved speed, transposition and hand
volumes still apply. The queue has previous/next and End; opening a score manually ends it.
An eight-second preview starts at the first note at original tempo with both hands. It
pauses the main player and uses a separate Player on the same audio engine, preserving
the main score, position, loop and speed. Closing the library or hiding the page stops
the preview. *Explicit previews avoid accidental sound; no service, dependency or new
content licence is needed. Listening quality and transitions need Jason.*

**D-41 · 2026-10-19 · Printed-bar notes and optional musical context** — A opens notes and
bookmarks for the current printed bar, stored per score by source measure index. Repeated
plays share the same note, while passage loops keep their pass addresses (D-32/39). Markers
use the sheet's measured bar boxes, so resizing, night mode and transposition keep them
attached to the bar. The editor also lists saved notes and can jump to their first pass.
C toggles a remembered context strip: the beat follows timeline clicks, and pedal down/up
uses the same sustain spans as playback. Chord labels are explicitly estimates from all
written note lengths overlapping a played bar: exact major/minor/diminished triads and
common seventh sets only, with slash bass; unmatched or ambiguous sets stay blank.
*This small recogniser is not harmonic analysis, and does not preserve source chord
symbols lost during MuseScore conversion. Everything follows the transposed timeline.*

**D-42 · 2026-10-19 · Recaps measure listening activity on the audio clock** — My sessions
shows the current listen and the latest 50 saved sessions in this browser. A pure
SessionTracker receives audio-clock samples from the main player and counts actual
playing time, passage entries/revisits and speed-setting changes. Count-ins, pauses,
previews, seeks and the ending ringing tail add no listening time. A recap is saved on
natural completion, switching scores, closing/reloading the page, or Finish session;
intervals shorter than a quarter second are discarded. Completion offers a restrained
View recap notice. Dates only label the history; they never decide note timing or
listening duration. *These are reader activity records, with no grades or claims about
what Jason played, heard, or learned.*
