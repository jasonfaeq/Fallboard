# Curriculum

The career from total beginner to performer. Venues are the Guitar Hero "tiers"; each ends
with a **Recital**. This is the content plan; mission mechanics live in MISSIONS.md.

**Status (2026-10-04): a first draft, nothing built.** Venues 1–2 are listed mission by
mission; venues 3–8 are outlines, written out when the venue before them is playable. The
piece choices wait on Jason's goal pieces (VISION.md › Open questions).

Phase 1 status (2026-10-09): Chopin Op. 28 No. 4 is transcribed and available in the Listen
piece player with six practice sections; notes await Jason's confirmation. This is not a
career mission yet. The venue missions below remain unbuilt.

## Legend

**Types**
- 🎓 **Lesson** — first contact with a concept. Guided, step by step, can't really fail.
- 🔁 **Drill** — repeatable, scored, has assist levels (Full → Staff → Page).
- 🎼 **Piece** — learn a piece of music through the ladder (MISSIONS.md › Learning a piece).
- ⚡ **Challenge** — pressure: sight-reading, one take, a time limit.
- 🎤 **Recital** — the venue's pieces in one take each, crowd meter, stars, encore.

**Ids** — `1.11` here = file id `1.11-ode-to-joy` in `src/content/` (zero-padded, slugged).

**Status** — ✅ a mission file with a bot · ⬜ planned

**Needs** — engine features beyond the Phase 1 slice (see ROADMAP):
`KEYS` pressKeys template · `RHY` tapRhythm template · `READ` readNote flashcards ·
`LH` left hand + bass clef · `ACC` game plays the other hand · `REC` recital mode ·
`SIGHT` sight-reading challenge · `DYN` dynamics scoring · `ART` note-length scoring ·
`PED` sustain pedal · `KEYSIG` key signatures · `CHORD` chord symbols / lead sheets ·
`EAR` echo template

## Teaching rules

1. A concept is introduced in a 🎓 Lesson before any Drill or Piece uses it.
2. The staff is on screen from the first mission. Falling notes sit next to it, never
   instead of it.
3. Every Drill and Piece exists at three assist levels. From Venue 2 on, a piece enters the
   recital only once it has a star at Staff or Page.
4. Pieces are learned in sections: listen → each hand alone → together slowly → at tempo.
5. A Recital only uses pieces and skills from its venue and earlier ones.
6. Every mission ends musically (MISSIONS.md › Level flow).
7. Finger numbers are suggested, never scored (the game can't see hands).

**Unlocks** (rules copied from DJ Trainer's career map): Venue 1 is open. Inside an open
venue every mission is playable; the Recital opens once all the venue's other missions have
≥ 1★. Clearing the Recital (≥ 1★) opens the next venue. A mission's `unlockAfter` adds extra
prerequisites. "Unlock everything" opens it all.

## Skill tags (`teaches`)

The validator checks `teaches` against this list. Add a tag here when a mission needs one.

`keys.geography` · `rh.c-position` · `lh.c-position` · `hands.alternate` · `hands.together` ·
`read.staff` · `read.treble.c4-g4` · `read.bass.c3-g3` · `rhythm.beat` · `rhythm.quarter` ·
`rhythm.half` · `rhythm.whole` · `rhythm.rest` · `dynamics.loud-soft` · `perform.one-take`

---

## Venue 1 — Living Room · the keyboard and the right hand

Right hand, five-finger position on C. Treble clef C4–G4. Quarter, half and whole notes in 4/4.

| # | Mission | Type | What you do | Needs | Status |
|---|---|---|---|---|---|
| 1.1 | First Notes | 🎓 | Find the groups of two and three black keys, then middle C; press it, hear it | KEYS | ⬜ |
| 1.2 | Keyboard Tour | 🎓 | The seven white-key names; find every C and every F on your keyboard | KEYS | ⬜ |
| 1.3 | Five Fingers | 🎓 | Finger numbers 1–5; thumb on middle C; play C D E F G up and down | | ⬜ |
| 1.4 | Keep the Beat | 🔁 | Tap any key on every beat for 8 bars (timing in ms) | RHY | ⬜ |
| 1.5 | Long and Short | 🔁 | Quarter, half and whole notes: play one key in the written rhythm | RHY | ⬜ |
| 1.6 | Lines and Spaces | 🎓 | How C D E F G look on the staff | | ⬜ |
| 1.7 | Read and Play | 🔁 | A note appears on the staff — press it (C4–G4) | READ | ⬜ |
| 1.8 | Steps and Skips | 🔁 | Read four-note patterns by their shape: step up, skip down, repeat | | ⬜ |
| 1.9 | Hot Cross Buns | 🎼 | Three notes, right hand | | ⬜ |
| 1.10 | Mary Had a Little Lamb | 🎼 | Four notes, right hand | | ⬜ |
| 1.11 | Ode to Joy | 🎼 | The theme in five-finger position (our arrangement) — **the Phase 1 slice** | | ⬜ |
| 1.12 🎤 | **For the Family** | Recital | Three pieces, right hand only | REC | ⬜ |

## Venue 2 — Family Party · the left hand and the bass clef

Left hand five-finger position on C3. Both clefs. Hands take turns; they rarely play together.

| # | Mission | Type | What you do | Needs | Status |
|---|---|---|---|---|---|
| 2.1 | The Left Hand | 🎓 | Left-hand finger numbers; little finger on C3; play C D E F G | LH | ⬜ |
| 2.2 | Bass Clef | 🎓 | How C3–G3 look on the lower staff; middle C between the staves | LH | ⬜ |
| 2.3 | Read and Play: Bass | 🔁 | A note appears on the bass staff — press it | READ LH | ⬜ |
| 2.4 | Rests | 🔁 | Quarter, half and whole rests: silence that is counted | RHY | ⬜ |
| 2.5 | Pass It Over | 🔁 | A melody that moves from the right hand to the left and back | LH | ⬜ |
| 2.6 | Both Clefs | 🔁 | Notes appear on either staff; press them with the right hand | READ LH | ⬜ |
| 2.7 | Loud and Soft | 🎓 | How hard you press sets the volume; play a phrase soft, then loud | DYN | ⬜ |
| 2.8 | Au Clair de la Lune | 🎼 | A melody shared between the hands | LH | ⬜ |
| 2.9 | Frère Jacques | 🎼 | Left hand, then right hand, then both in turn | LH | ⬜ |
| 2.10 | When the Saints | 🎼 | Right-hand melody over single held left-hand notes | LH ACC | ⬜ |
| 2.11 | First Sight | ⚡ | Four bars you have never seen, one take, Staff assist | SIGHT | ⬜ |
| 2.12 🎤 | **Family Party** | Recital | Three pieces using both hands | REC | ⬜ |

## Venues 3–8 (outlines)

| Venue | Focus | New skills | Example pieces (public-domain compositions) |
|---|---|---|---|
| 3 · School Recital | hands together | both hands at once, eighth notes, ties, G and F positions, 3/4 time | Minuet in G (Petzold), Jingle Bells, Amazing Grace |
| 4 · Café | chords and keys | triads, broken-chord accompaniment, key signatures (G, F, D), major scales one octave | Canon in D (simplified), Greensleeves, Scarborough Fair |
| 5 · Wedding | expression | sustain pedal, legato and staccato, phrasing, dotted rhythms, crescendo | Prelude in C (Bach), Gymnopédie No. 1 (Satie), Für Elise (opening) |
| 6 · Piano Bar | playing without a full score | lead sheets, chord symbols, left-hand patterns, playing by ear | The Entertainer (Joplin), Auld Lang Syne from a lead sheet |
| 7 · Theatre | speed and technique | scales and arpeggios hands together, sixteenth notes, hand crossings | Sonatina Op. 36 No. 1 (Clementi), Arabesque (Burgmüller) |
| 8 · Concert Hall | full repertoire | longer pieces, sight-reading under pressure, performing from memory | Für Elise (complete), Prelude in E minor (Chopin), Clair de Lune (Debussy) |

Check each piece's public-domain status and write our own arrangement before it is added
(MUSIC.md › Licensing).
