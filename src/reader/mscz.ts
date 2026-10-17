// MuseScore's own files (.mscz, a zip with an .mscx inside, or a bare .mscx) turned into
// MusicXML, so a score downloaded from musescore.com in MuseScore format opens like any other.
// Our own reader of the format (MuseScore's own importer is GPL). It covers what a piano score
// needs: parts and staves, voices, chords, rests, grace notes, tuplets, ties, slurs, beams,
// clefs, keys, times, tempo, rit./accel. lines, dynamics, text, ottavas, pedal, hairpins, repeats, voltas and
// jumps. Files from MuseScore 2, 3 and 4 are read; layout, lyrics and chord symbols are dropped.
// Uses the browser's DOMParser and DecompressionStream (no DOM rendering).

/** True for the file names this module reads. */
export const isMuseScoreFile = (name: string) => /\.msc[zx]$/i.test(name)

/** Reads an .mscz or .mscx file and returns MusicXML text. Throws with a short reason. */
export async function museScoreToMusicXml(data: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(data)
  const zipped = bytes[0] === 0x50 && bytes[1] === 0x4b
  return convert(zipped ? await mscxFromZip(data) : new TextDecoder().decode(bytes))
}

// ---------------- zip ----------------
async function mscxFromZip(data: ArrayBuffer): Promise<string> {
  const files = listZip(data)
  const container = files.get('META-INF/container.xml')
  const listed = container ? [...(await container()).matchAll(/full-path="([^"]+\.mscx)"/g)].map((m) => m[1]) : []
  const name = listed.find((n) => files.has(n)) ?? [...files.keys()].find((n) => /^[^/]+\.mscx$/i.test(n))
  if (!name) throw new Error('there is no score inside it')
  return files.get(name)!()
}

/** The entries of a zip file, each read on demand as UTF-8 text. */
function listZip(data: ArrayBuffer) {
  const view = new DataView(data)
  let end = -1
  for (let i = data.byteLength - 22; i >= Math.max(0, data.byteLength - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) { end = i; break }
  }
  if (end < 0) throw new Error('it is not a complete zip file')
  const files = new Map<string, () => Promise<string>>()
  let p = view.getUint32(end + 16, true)
  for (let n = view.getUint16(end + 10, true); n > 0 && view.getUint32(p, true) === 0x02014b50; n--) {
    const method = view.getUint16(p + 10, true), size = view.getUint32(p + 20, true)
    const nameLength = view.getUint16(p + 28, true), local = view.getUint32(p + 42, true)
    const name = new TextDecoder().decode(new Uint8Array(data, p + 46, nameLength))
    p += 46 + nameLength + view.getUint16(p + 30, true) + view.getUint16(p + 32, true)
    files.set(name, async () => {
      const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true)
      const raw = new Uint8Array(data, start, size)
      if (method === 0) return new TextDecoder().decode(raw)
      if (method !== 8) throw new Error('it uses an unknown zip compression')
      const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
      return new Response(stream).text()
    })
  }
  return files
}

// ---------------- the score model ----------------
interface Note { pitch: number; tpc: number; tieStart: boolean; tieStop: boolean; accidental: string; fingering: string[]; hidden: boolean }
interface Ev {
  tick: number; abs: number; dur: number; rest: boolean; measureRest: boolean; grace: '' | 'slash' | 'plain'
  type: string; dots: number; notes: Note[]; ratio: [number, number] | null; tupletStart: number; tupletStop: number
  beamMode: string; beams: string[]; stem: string; hidden: boolean; staffMove: number
  slurStart: number; slurStop: number; marks: string[]; arpeggio: boolean
}
/** A direction (text, dynamics, tempo, ottava, pedal…), written for whichever staff it sits on. */
interface Dir { inner: string; placement: 'above' | 'below'; sound?: string }
/** Something at a time in one voice: a chord or rest, a clef change or a direction. `order` sorts equal times. */
interface Item { tick: number; order: number; ev?: Ev; clef?: string; dir?: Dir }
interface MeasureData { voices: Item[][]; extras: Item[]; repeatOf: number }
interface Time { n: number; d: number; symbol: string }
interface Bar {
  start: number; len: number; time?: Time; key?: { fifths: number; mode: string }
  startRepeat: boolean; endRepeat: number; style: string; irregular: boolean
  voltaStart?: { numbers: string; text: string }; voltaStop?: { numbers: string; type: string }
}
interface Span { kind: string; staff: number; voice: number; start: number; end: number; el: Element; id: string }
interface Tuplet { actual: number; normal: number; first: Ev | null; last: Ev | null }

const DURATION: Record<string, number> = { long: 16, breve: 8, whole: 4, half: 2, quarter: 1, eighth: 1 / 2, '16th': 1 / 4, '32nd': 1 / 8, '64th': 1 / 16, '128th': 1 / 32, '256th': 1 / 64, '512th': 1 / 128, '1024th': 1 / 256 }
const FLAGS: Record<string, number> = { eighth: 1, '16th': 2, '32nd': 3, '64th': 4, '128th': 5, '256th': 6, '512th': 7, '1024th': 8 }
const GRACE: Record<string, 'slash' | 'plain'> = { acciaccatura: 'slash', appoggiatura: 'plain', grace4: 'plain', grace16: 'plain', grace32: 'plain', grace8after: 'plain', grace16after: 'plain', grace32after: 'plain' }
/** tonal pitch class of each pitch class, spelled with sharps (when a note has no <tpc>) */
const SHARP_TPC = [14, 21, 16, 23, 18, 13, 20, 15, 22, 17, 24, 19]
const OTTAVA: Record<string, number> = { '8va': 12, '8vb': -12, '15ma': 24, '15mb': -24, '22ma': 36, '22mb': -36, 0: 12, 1: -12, 2: 24, 3: -24, 4: 36, 5: -36 }
const DYNAMICS = new Set(['p', 'pp', 'ppp', 'pppp', 'ppppp', 'pppppp', 'f', 'ff', 'fff', 'ffff', 'fffff', 'ffffff', 'mp', 'mf', 'sf', 'sfp', 'sfpp', 'fp', 'rf', 'rfz', 'sfz', 'sffz', 'fz', 'n', 'pf', 'sfzp'])
const TEMPO_CHANGE: Record<string, string> = { accelerando: 'accel.', allargando: 'allarg.', calando: 'calando', lentando: 'lentando', morendo: 'morendo', precipitando: 'precipitando', rallentando: 'rall.', ritardando: 'rit.', smorzando: 'smorz.', sostenuto: 'sost.', stringendo: 'string.' }
const BAR_STYLE: Record<string, string> = { double: 'light-light', end: 'light-heavy', final: 'light-heavy', 'reverse-end': 'heavy-light', heavy: 'heavy', 'double-heavy': 'heavy-heavy', dashed: 'dashed', dotted: 'dotted' }

// ---------------- small XML helpers ----------------
const kids = (el: Element, tag?: string) => Array.from(el.children).filter((c) => !tag || c.tagName === tag)
const kid = (el: Element | undefined, tag: string) => el ? kids(el, tag)[0] : undefined
const text = (el: Element | undefined, tag: string) => kid(el, tag)?.textContent?.trim() ?? ''
const num = (el: Element | undefined, tag: string, fallback: number) => {
  const t = text(el, tag)
  return t === '' || isNaN(Number(t)) ? fallback : Number(t)
}
const frac = (s: string | null | undefined) => {
  const [a, b] = (s ?? '').split('/').map(Number)
  return b ? a / b : 0
}
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
/** The words of a text element, without MuseScore's symbol names. */
function words(el: Element | undefined): string {
  if (!el) return ''
  let out = ''
  el.childNodes.forEach((n) => {
    if (n.nodeType === 3) out += n.textContent
    else if (n.nodeType === 1 && (n as Element).tagName !== 'sym') out += words(n as Element)
  })
  return out.trim()
}

/** MusicXML <clef> contents for a MuseScore clef name. */
function clefXml(type: string) {
  const octave = /8va|8vb|15ma|15mb/.exec(type)?.[0]
  const change = octave ? `<clef-octave-change>${{ '8va': 1, '8vb': -1, '15ma': 2, '15mb': -2 }[octave]}</clef-octave-change>` : ''
  if (type.startsWith('PERC')) return '<sign>percussion</sign>'
  if (type.startsWith('TAB')) return '<sign>TAB</sign><line>5</line>'
  if (type.startsWith('C')) return `<sign>C</sign><line>${Number(type[1]) || 3}</line>`
  if (type.startsWith('F')) return `<sign>F</sign><line>${type === 'F3' || type === 'F_B' ? 3 : type === 'F_C' ? 5 : 4}</line>${change}`
  return `<sign>G</sign><line>${type === 'G1' ? 1 : 2}</line>${change}`
}

// ---------------- reading the .mscx ----------------
function convert(source: string): string {
  const doc = new DOMParser().parseFromString(source, 'application/xml')
  const root = doc.documentElement
  if (doc.getElementsByTagName('parsererror').length || root.tagName !== 'museScore') throw new Error('it is not a MuseScore score')
  const version = parseFloat(root.getAttribute('version') ?? '0')
  if (version < 2) throw new Error('it was saved by MuseScore 1, which is too old to read here')
  const old = version < 3 // MuseScore 2: no <voice> elements; ticks, tracks and ids instead
  const score = kid(root, 'Score')
  if (!score) throw new Error('there is no score inside it')
  const div = num(score, 'Division', 480)
  const whole = 4 * div
  const staffEls = kids(score, 'Staff')
  if (!staffEls.length) throw new Error('the score has no staves')

  // Bars: where each measure starts and how long it is, from the first staff.
  const bars: Bar[] = []
  let sig: Time = { n: 4, d: 4, symbol: '' }
  let total = 0
  for (const m of kids(staffEls[0], 'Measure')) {
    const ts = m.getElementsByTagName('TimeSig')[0]
    let time: Time | undefined
    if (ts) time = sig = { n: num(ts, 'sigN', 4), d: num(ts, 'sigD', 4), symbol: ({ 1: 'common', 2: 'cut' } as Record<string, string>)[text(ts, 'subtype')] ?? '' }
    const len = m.getAttribute('len') ? frac(m.getAttribute('len')) * whole : sig.n / sig.d * whole
    bars.push({ start: total, len, time, startRepeat: false, endRepeat: 0, style: '', irregular: false })
    total += len
  }
  if (!bars.length) throw new Error('the score has no measures')
  const barAt = (t: number) => { // the bar a time falls in (start ≤ t < end)
    let lo = 0, hi = bars.length - 1
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (bars[mid].start <= t + 1e-6) lo = mid; else hi = mid - 1 }
    return lo
  }

  // Parts and their staves, in the order the score's staves come.
  const parts: { name: string; staves: number[] }[] = []
  const defaultClef: string[] = []
  let next = 0
  for (const part of kids(score, 'Part')) {
    const pStaves = kids(part, 'Staff')
    const instrument = kid(part, 'Instrument')
    const staves = pStaves.map((st, i) => {
      const own = (instrument ? kids(instrument, 'clef') : []).find((c) => (Number(c.getAttribute('staff')) || 1) === i + 1)?.textContent?.trim()
      const percussion = kid(st, 'StaffType')?.getAttribute('group') === 'percussion'
      defaultClef[next] = text(st, 'defaultClef') || own || (percussion ? 'PERC' : 'G')
      return next++
    })
    parts.push({ name: text(part, 'trackName') || text(instrument, 'longName') || `Part ${parts.length + 1}`, staves })
  }
  while (next < staffEls.length) { defaultClef[next] = 'G'; parts.push({ name: `Part ${parts.length + 1}`, staves: [next++] }) }

  // Title and composer: the title frame, else the score's properties.
  let title = '', composer = ''
  for (const t of staffEls[0].getElementsByTagName('Text')) {
    const style = text(t, 'style').toLowerCase()
    if (style === 'title' && !title) title = words(kid(t, 'text'))
    if (style === 'composer' && !composer) composer = words(kid(t, 'text'))
  }
  const meta = (name: string) => kids(score, 'metaTag').find((m) => m.getAttribute('name') === name)?.textContent?.trim() ?? ''
  title ||= meta('workTitle') || meta('movementTitle')
  composer ||= meta('composer')

  const data: MeasureData[][] = staffEls.map(() => [])
  const spans: Span[] = []
  const firstClef: (string | undefined)[] = []

  staffEls.forEach((staffEl, s) => {
    kids(staffEl, 'Measure').forEach((mEl, m) => {
      const bar = bars[m]
      if (!bar) return
      const md: MeasureData = { voices: [[], [], [], []], extras: [], repeatOf: -1 }
      data[s][m] = md
      const registry = new Map<string, Tuplet>() // MuseScore 2 tuplets, by id
      const read = (els: Element[], streamVoice: number) => {
        let cursor = 0
        const stack: Tuplet[] = []
        let marks: string[] = []
        let after: Ev[] = []
        const extra = (tick: number, dir: Dir, order = 1) => md.extras.push({ tick, order, dir })

        const chordRest = (el: Element) => {
          for (const g of kids(el, 'Chord')) chordRest(g) // grace chords, if ever nested
          const voice = old && kid(el, 'track') ? num(el, 'track', 0) % 4 : streamVoice
          const type = text(el, 'durationType'), dots = num(el, 'dots', 0)
          const graceTag = Object.keys(GRACE).find((g) => kid(el, g))
          const rest = el.tagName === 'Rest', measureRest = rest && type === 'measure'
          const ref = old ? registry.get(text(el, 'Tuplet')) : undefined
          const tuplets = graceTag ? [] : old ? (ref ? [ref] : []) : stack
          const ratio: [number, number] | null = tuplets.length
            ? [tuplets.reduce((a, t) => a * t.actual, 1), tuplets.reduce((a, t) => a * t.normal, 1)] : null
          let dur = 0
          if (measureRest) {
            const d = kid(el, 'duration')
            dur = (d?.getAttribute('z') ? Number(d.getAttribute('z')) / Number(d.getAttribute('n')) : frac(d?.textContent)) * whole || bar.len
          } else if (!graceTag) dur = (DURATION[type] ?? 1) * div * (2 - 2 ** -dots) * (ratio ? ratio[1] / ratio[0] : 1)
          const ev: Ev = {
            tick: cursor, abs: bar.start + cursor, dur, rest, measureRest, grace: graceTag ? GRACE[graceTag] : '',
            type: measureRest ? '' : DURATION[type] ? type : 'quarter', dots, notes: [], ratio, tupletStart: 0, tupletStop: 0,
            beamMode: text(el, 'BeamMode'), beams: [], stem: text(el, 'StemDirection'), hidden: text(el, 'visible') === '0',
            staffMove: num(el, 'staffMove', 0), slurStart: 0, slurStop: 0, marks: [], arpeggio: !!kid(el, 'Arpeggio'),
          }
          for (const n of kids(el, 'Note')) {
            const pitch = num(n, 'pitch', 60)
            const ties = kids(n, 'Spanner').filter((sp) => sp.getAttribute('type') === 'Tie')
            const acc = text(kid(n, 'Accidental'), 'subtype').replace(/^accidental/, '').toLowerCase()
            ev.notes.push({
              pitch, tpc: num(n, 'tpc', SHARP_TPC[((pitch % 12) + 12) % 12]),
              tieStart: ties.some((sp) => kid(sp, 'next')) || !!kid(n, 'Tie'),
              tieStop: ties.some((sp) => kid(sp, 'prev')) || !!kid(n, 'endSpanner'),
              accidental: ({ sharp: 'sharp', flat: 'flat', natural: 'natural', doublesharp: 'double-sharp', sharp2: 'double-sharp', doubleflat: 'flat-flat', flat2: 'flat-flat' } as Record<string, string>)[acc] ?? '',
              fingering: kids(n, 'Fingering').map((f) => words(kid(f, 'text'))).filter(Boolean),
              hidden: text(n, 'visible') === '0',
            })
          }
          for (const a of [...kids(el, 'Articulation'), ...kids(el, 'Ornament')]) ev.marks.push(...articulation(text(a, 'subtype')))
          for (const sl of kids(el, 'Slur')) { // MuseScore 2
            if (sl.getAttribute('type') === 'start') ev.slurStart++
            if (sl.getAttribute('type') === 'stop') ev.slurStop++
          }
          const item = { tick: cursor, order: 2, ev }
          if (graceTag?.endsWith('after')) { after.push(ev); return }
          md.voices[voice].push(item)
          if (graceTag) return
          ev.marks.push(...marks)
          marks = []
          for (const t of tuplets) {
            if (!t.first) { t.first = ev; ev.tupletStart++ }
            t.last = ev
          }
          cursor += dur
          for (const g of after) { g.tick = cursor; g.abs = bar.start + cursor; md.voices[voice].push({ tick: cursor, order: 2, ev: g }) }
          after = []
        }

        for (const el of els) {
          switch (el.tagName) {
            case 'startRepeat': bar.startRepeat = true; break
            case 'endRepeat': bar.endRepeat = Number(el.textContent) || 2; break
            case 'irregular': bar.irregular = true; break
            case 'tick': cursor = Number(el.textContent) - bar.start; break
            case 'location': cursor += frac(text(el, 'fractions')) * whole; break
            case 'Chord': case 'Rest': chordRest(el); break
            case 'Tuplet': {
              const t: Tuplet = { actual: num(el, 'actualNotes', 3), normal: num(el, 'normalNotes', 2), first: null, last: null }
              if (old && el.getAttribute('id')) registry.set(el.getAttribute('id')!, t)
              else stack.push(t)
              break
            }
            case 'endTuplet': { const t = stack.pop(); if (t?.last) t.last.tupletStop++; break }
            case 'Clef': {
              const type = text(el, 'concertClefType') || text(el, 'subtype') || 'G'
              if (m === 0 && cursor === 0) firstClef[s] = type
              else md.voices[streamVoice].push({ tick: cursor, order: 1, clef: type })
              break
            }
            case 'KeySig':
              bar.key ??= { fifths: num(el, 'concertKey', num(el, 'accidental', num(el, 'key', 0))), mode: text(el, 'mode') }
              break
            case 'Tempo': {
              const tempo = num(el, 'tempo', 2) * 60
              const shown = kid(el, 'text')
              const syms = shown ? Array.from(shown.getElementsByTagName('sym')).map((x) => x.textContent ?? '') : []
              const unit = syms.map((x) => /Whole/.test(x) ? 'whole' : /Half/.test(x) ? 'half' : /8th/.test(x) ? 'eighth' : /16th/.test(x) ? '16th' : /Quarter/.test(x) ? 'quarter' : '').find(Boolean)
              const dotted = syms.some((x) => /AugmentationDot/.test(x))
              const perMinute = unit ? Math.round(tempo / (DURATION[unit] * (dotted ? 1.5 : 1)) * 100) / 100 : 0
              const label = words(shown).replace(/=\s*[\d.]+\s*$/, '').trim()
              const inner = (label ? `<words>${esc(label)}</words>` : '') + (unit && !kid(el, 'hide')
                ? `<metronome><beat-unit>${unit}</beat-unit>${dotted ? '<beat-unit-dot/>' : ''}<per-minute>${perMinute}</per-minute></metronome>` : '')
              extra(cursor, { inner: inner || '<words></words>', placement: 'above', sound: `<sound tempo="${Math.round(tempo * 100) / 100}"/>` })
              break
            }
            case 'Dynamic': {
              const sub = text(el, 'subtype')
              const inner = DYNAMICS.has(sub) ? `<dynamics><${sub}/></dynamics>` : sub ? `<words>${esc(sub)}</words>` : ''
              if (inner) extra(cursor, { inner, placement: 'below' })
              break
            }
            case 'StaffText': case 'SystemText': case 'Expression': case 'RehearsalMark': {
              const w = words(kid(el, 'text'))
              if (w) extra(cursor, { inner: el.tagName === 'RehearsalMark' ? `<rehearsal>${esc(w)}</rehearsal>` : `<words>${esc(w)}</words>`, placement: el.tagName === 'Expression' ? 'below' : 'above' })
              break
            }
            case 'Fermata': marks.push(/Below/.test(text(el, 'subtype')) ? '<fermata type="inverted"/>' : '<fermata/>'); break
            case 'Jump': {
              const to = text(el, 'jumpTo').toLowerCase()
              const sound = to === 'start' ? '<sound dacapo="yes"/>' : to.includes('segno') ? '<sound dalsegno="segno"/>' : undefined
              extra(bar.len, { inner: `<words>${esc(words(kid(el, 'text')) || (to === 'start' ? 'D.C.' : 'D.S.'))}</words>`, placement: 'above', sound }, 3)
              break
            }
            case 'Marker': {
              const kind = (text(el, 'label') || text(el, 'subtype')).toLowerCase()
              if (kind.startsWith('segno')) extra(0, { inner: '<segno/>', placement: 'above', sound: '<sound segno="segno"/>' }, 0)
              else if (kind === 'coda' || kind === 'codab' || kind === 'varcoda') extra(0, { inner: '<coda/>', placement: 'above', sound: '<sound coda="coda"/>' }, 0)
              else if (kind === 'fine') extra(bar.len, { inner: '<words>Fine</words>', placement: 'above', sound: '<sound fine="yes"/>' }, 3)
              else if (kind === 'tocoda' || kind === 'tocodasym') extra(bar.len, { inner: `<words>${esc(words(kid(el, 'text')) || 'To Coda')}</words>`, placement: 'above', sound: '<sound tocoda="coda"/>' }, 3)
              break
            }
            case 'BarLine': {
              const sub = text(el, 'subtype')
              if (BAR_STYLE[sub]) bar.style = BAR_STYLE[sub]
              break
            }
            case 'RepeatMeasure': case 'MeasureRepeat': md.repeatOf = m - (num(el, 'subtype', 1) || 1); break
            case 'Spanner': { // MuseScore 3 and 4: a start carries where it ends
              const kind = el.getAttribute('type') ?? ''
              const loc = kid(kid(el, 'next'), 'location')
              if (!loc || kind === 'Tie') break
              const endBar = bars[m + num(loc, 'measures', 0)]
              spans.push({ kind, staff: s, voice: streamVoice, start: bar.start + cursor, end: (endBar ? endBar.start : total) + cursor + frac(text(loc, 'fractions')) * whole, el: kid(el, kind) ?? el, id: '' })
              break
            }
            case 'Ottava': case 'Pedal': case 'HairPin': case 'Volta': // MuseScore 2: ends at a later <endSpanner id>
              if (old && el.getAttribute('id')) spans.push({ kind: el.tagName, staff: s, voice: num(el, 'track', 0) % 4, start: bar.start + cursor, end: NaN, el, id: el.getAttribute('id')! })
              break
            case 'endSpanner': {
              const span = spans.find((sp) => sp.id === el.getAttribute('id') && isNaN(sp.end))
              if (span) span.end = bar.start + cursor
              break
            }
          }
        }
        for (const t of registry.values()) if (t.last && !t.last.tupletStop && t.first) { t.last.tupletStop++ }
      }
      const voiceEls = kids(mEl, 'voice')
      if (voiceEls.length) {
        read(kids(mEl).filter((c) => c.tagName !== 'voice'), 0)
        voiceEls.slice(0, 4).forEach((v, i) => read(kids(v), i))
      } else read(kids(mEl), 0)
      if (md.repeatOf >= 0 && data[s][md.repeatOf]) {
        const from = data[s][md.repeatOf], shift = bar.start - bars[md.repeatOf].start
        md.voices = from.voices.map((items) => items.map((it) => it.ev ? { ...it, ev: { ...it.ev, abs: it.ev.abs + shift, beams: [] } } : it))
      }
    })
  })

  // Spanners: ottava shifts, directions for pedal, hairpins and ottavas, voltas and slurs.
  const shifts: { staff: number; start: number; end: number; by: number }[] = []
  const place = (staff: number, t: number, dir: Dir, stop: boolean) => {
    let m = barAt(t)
    if (stop && m > 0 && Math.abs(bars[m].start - t) < 1e-6) m-- // a stop on a barline ends the bar before
    data[staff][m]?.extras.push({ tick: Math.min(t - bars[m].start, bars[m].len), order: stop ? 0 : 1, dir })
  }
  const chordsOf = new Map<string, Ev[]>()
  const chords = (staff: number, voice: number) => {
    const key = `${staff}:${voice}`
    if (!chordsOf.has(key)) chordsOf.set(key, data[staff].flatMap((md) => md?.voices[voice].flatMap((it) => it.ev && !it.ev.rest && !it.ev.grace ? [it.ev] : []) ?? []))
    return chordsOf.get(key)!
  }
  for (const sp of spans) {
    if (isNaN(sp.end)) sp.end = total
    const sub = text(sp.el, 'subtype')
    if (sp.kind === 'Ottava') {
      const by = OTTAVA[sub] ?? 12, size = Math.abs(by) === 12 ? 8 : Math.abs(by) === 24 ? 15 : 22
      shifts.push({ staff: sp.staff, start: sp.start, end: sp.end, by })
      place(sp.staff, sp.start, { inner: `<octave-shift type="${by > 0 ? 'down' : 'up'}" size="${size}"/>`, placement: by > 0 ? 'above' : 'below' }, false)
      place(sp.staff, sp.end, { inner: `<octave-shift type="stop" size="${size}"/>`, placement: by > 0 ? 'above' : 'below' }, true)
    } else if (sp.kind === 'Pedal') {
      place(sp.staff, sp.start, { inner: '<pedal type="start" line="yes"/>', placement: 'below' }, false)
      place(sp.staff, sp.end, { inner: '<pedal type="stop" line="yes"/>', placement: 'below' }, true)
    } else if (sp.kind === 'HairPin') {
      if (Number(sub) > 1) continue // "cresc." lines: drawn as text in MuseScore, skipped here
      place(sp.staff, sp.start, { inner: `<wedge type="${Number(sub) % 2 ? 'diminuendo' : 'crescendo'}"/>`, placement: 'below' }, false)
      place(sp.staff, sp.end, { inner: '<wedge type="stop"/>', placement: 'below' }, true)
    } else if (sp.kind === 'GradualTempoChange') { // MuseScore 4's rit./accel. lines: the words, which playback reads
      const label = words(kid(sp.el, 'beginText')) || TEMPO_CHANGE[text(sp.el, 'tempoChangeType') || 'rallentando'] || 'rit.'
      place(sp.staff, sp.start, { inner: `<words>${esc(label)}</words>`, placement: 'above' }, false)
    } else if (sp.kind === 'Volta') {
      const numbers = text(sp.el, 'endings').replace(/\s/g, '') || '1'
      const first = barAt(sp.start)
      let last = barAt(sp.end)
      if (last > first && Math.abs(bars[last].start - sp.end) < 1e-6) last--
      bars[first].voltaStart = { numbers, text: words(kid(sp.el, 'beginText')) || `${numbers}.` }
      const hook = kid(sp.el, 'endHookType') ? num(sp.el, 'endHookType', 0) : num(sp.el, 'endHook', 0)
      bars[last].voltaStop = { numbers, type: hook ? 'stop' : 'discontinue' }
    } else if (sp.kind === 'Slur') {
      const list = chords(sp.staff, sp.voice)
      const from = list.find((e) => e.abs >= sp.start - 1e-6)
      const to = [...list].reverse().find((e) => e.abs <= sp.end + 1e-6)
      if (from && to && from !== to && to.abs > from.abs) { from.slurStart++; to.slurStop++ }
    }
  }
  const shiftAt = (staff: number, abs: number) => shifts.find((x) => x.staff === staff && abs >= x.start - 1e-6 && abs < x.end - 1e-6)?.by ?? 0

  // Beams: MuseScore's marks where it has them, else grouped by beat.
  let time: Time = { n: 4, d: 4, symbol: '' }
  bars.forEach((bar, m) => {
    time = bar.time ?? time
    for (const staff of data) for (const items of staff[m]?.voices ?? []) beam(items.flatMap((it) => it.ev && !it.ev.grace ? [it.ev] : []), time, div)
  })

  // ---------------- writing MusicXML ----------------
  const out: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<score-partwise version="4.0">',
    title ? `<work><work-title>${esc(title)}</work-title></work>` : '',
    `<identification>${composer ? `<creator type="composer">${esc(composer)}</creator>` : ''}<encoding><software>Fallboard (from a MuseScore ${Math.floor(version)} file)</software></encoding></identification>`,
    '<part-list>', ...parts.map((p, i) => `<score-part id="P${i + 1}"><part-name>${esc(p.name)}</part-name></score-part>`), '</part-list>',
  ]
  parts.forEach((part, pi) => {
    out.push(`<part id="P${pi + 1}">`)
    const slurNumbers = new Map<string, number[]>()
    const slurInUse = new Set<number>()
    let key = { fifths: NaN, mode: '' }
    let number = 1
    bars.forEach((bar, m) => {
      const pickup = m === 0 && bar.irregular
      out.push(`<measure number="${pickup ? 0 : number}"${bar.irregular ? ' implicit="yes"' : ''}>`)
      if (!pickup) number++
      if (bar.startRepeat || bar.voltaStart) {
        out.push('<barline location="left">', bar.startRepeat ? '<bar-style>heavy-light</bar-style>' : '',
          bar.voltaStart ? `<ending number="${bar.voltaStart.numbers}" type="start">${esc(bar.voltaStart.text)}</ending>` : '',
          bar.startRepeat ? '<repeat direction="forward"/>' : '', '</barline>')
      }
      const attributes: string[] = []
      if (m === 0) attributes.push(`<divisions>${div}</divisions>`)
      const k = bar.key ?? (m === 0 ? { fifths: 0, mode: '' } : undefined)
      if (k && (k.fifths !== key.fifths || k.mode !== key.mode)) {
        attributes.push(`<key><fifths>${k.fifths}</fifths>${k.mode === 'major' || k.mode === 'minor' ? `<mode>${k.mode}</mode>` : ''}</key>`)
        key = k
      }
      const t = bar.time ?? (m === 0 ? { n: 4, d: 4, symbol: '' } : undefined)
      if (t) attributes.push(`<time${t.symbol ? ` symbol="${t.symbol}"` : ''}><beats>${t.n}</beats><beat-type>${t.d}</beat-type></time>`)
      if (m === 0) {
        if (part.staves.length > 1) attributes.push(`<staves>${part.staves.length}</staves>`)
        part.staves.forEach((s, i) => attributes.push(`<clef number="${i + 1}">${clefXml(firstClef[s] ?? defaultClef[s])}</clef>`))
      }
      if (attributes.length) out.push(`<attributes>${attributes.join('')}</attributes>`)

      let cursor = 0
      const moveTo = (tick: number, voice: number, staff: number) => {
        const to = Math.round(tick)
        if (to > cursor) out.push(`<forward><duration>${to - cursor}</duration><voice>${voice}</voice><staff>${staff}</staff></forward>`)
        if (to < cursor) out.push(`<backup><duration>${cursor - to}</duration></backup>`)
        cursor = to
      }
      part.staves.forEach((s, li) => {
        const md = data[s][m]
        if (!md) return
        const staffNo = li + 1
        const used = md.voices.map((items, v) => ({ items, v })).filter((x) => x.items.length)
        if (!used.length && md.extras.length) used.push({ items: [], v: 0 })
        used.forEach(({ items, v }, ui) => {
          const voiceNo = li * 4 + v + 1
          const all = ui === 0 ? [...items, ...md.extras] : items
          const sorted = all.map((it, i) => ({ it, i })).sort((a, b) => a.it.tick - b.it.tick || a.it.order - b.it.order || a.i - b.i).map((x) => x.it)
          moveTo(0, voiceNo, staffNo)
          for (const it of sorted) {
            if (it.dir) {
              const offset = Math.round(it.tick) - cursor
              out.push(`<direction placement="${it.dir.placement}"><direction-type>${it.dir.inner}</direction-type>${offset ? `<offset>${offset}</offset>` : ''}<staff>${staffNo}</staff>${it.dir.sound ?? ''}</direction>`)
            } else if (it.clef) {
              moveTo(it.tick, voiceNo, staffNo)
              out.push(`<attributes><clef number="${staffNo}">${clefXml(it.clef)}</clef></attributes>`)
            } else if (it.ev) {
              const ev = it.ev
              moveTo(ev.tick, voiceNo, staffNo)
              const duration = ev.grace ? 0 : Math.round(ev.tick + ev.dur) - cursor
              const slurKey = `${s}:${v}`
              const slurs: string[] = []
              for (let i = 0; i < ev.slurStop; i++) {
                const n = slurNumbers.get(slurKey)?.pop()
                if (n) { slurInUse.delete(n); slurs.push(`<slur type="stop" number="${n}"/>`) }
              }
              for (let i = 0; i < ev.slurStart; i++) {
                let n = 1
                while (slurInUse.has(n)) n++
                slurInUse.add(n)
                slurNumbers.set(slurKey, [...(slurNumbers.get(slurKey) ?? []), n])
                slurs.push(`<slur type="start" number="${n}"/>`)
              }
              const shift = shiftAt(s, ev.abs)
              const notes = ev.rest || !ev.notes.length ? [null] : ev.notes
              const onStaff = Math.min(Math.max(staffNo + ev.staffMove, 1), part.staves.length)
              notes.forEach((n, i) => out.push(noteXml(ev, n, i, onStaff, voiceNo, duration, shift, i === 0 ? slurs : [])))
              if (!ev.grace) cursor += duration
            }
          }
        })
      })
      const last = m === bars.length - 1
      const style = bar.endRepeat ? 'light-heavy' : bar.style || (last ? 'light-heavy' : '')
      if (style || bar.voltaStop || bar.endRepeat) {
        out.push('<barline location="right">', style ? `<bar-style>${style}</bar-style>` : '',
          bar.voltaStop ? `<ending number="${bar.voltaStop.numbers}" type="${bar.voltaStop.type}"/>` : '',
          bar.endRepeat ? `<repeat direction="backward"${bar.endRepeat > 2 ? ` times="${bar.endRepeat}"` : ''}/>` : '', '</barline>')
      }
      out.push('</measure>')
    })
    out.push('</part>')
  })
  out.push('</score-partwise>')
  return out.join('\n')
}

/** MusicXML marks for a MuseScore articulation or ornament name. */
function articulation(sub: string): string[] {
  const s = sub.toLowerCase()
  if (s.includes('fermata')) return [/below|^d/.test(s) ? '<fermata type="inverted"/>' : '<fermata/>']
  if (s.includes('staccatissimo')) return ['<articulations><staccatissimo/></articulations>']
  if (s.includes('portato') || s.includes('tenutostaccato')) return ['<articulations><detached-legato/></articulations>']
  if (s.includes('accentstaccato')) return ['<articulations><accent/><staccato/></articulations>']
  if (s.includes('marcatostaccato')) return ['<articulations><strong-accent/><staccato/></articulations>']
  if (s.includes('staccato')) return ['<articulations><staccato/></articulations>']
  if (s.includes('tenuto')) return ['<articulations><tenuto/></articulations>']
  if (s.includes('marcato')) return ['<articulations><strong-accent/></articulations>']
  if (s.includes('accent') || s === 'sforzato') return ['<articulations><accent/></articulations>']
  if (s.includes('trill')) return ['<ornaments><trill-mark/></ornaments>']
  if (s.includes('prall') || s.includes('shortmordent') || s === 'ornamentshorttrill') return ['<ornaments><inverted-mordent/></ornaments>']
  if (s.includes('mordent')) return ['<ornaments><mordent/></ornaments>']
  if (s.includes('turninverted') || s.includes('reverseturn')) return ['<ornaments><inverted-turn/></ornaments>']
  if (s.includes('turn')) return ['<ornaments><turn/></ornaments>']
  return []
}

/** One <note> of a chord (or the rest, when `n` is null). */
function noteXml(ev: Ev, n: Note | null, index: number, staff: number, voice: number, duration: number, shift: number, slurs: string[]) {
  const x: string[] = [`<note${ev.hidden || n?.hidden ? ' print-object="no"' : ''}>`]
  if (ev.grace) x.push(ev.grace === 'slash' ? '<grace slash="yes"/>' : '<grace/>')
  if (index > 0) x.push('<chord/>')
  if (!n) x.push(ev.measureRest ? '<rest measure="yes"/>' : '<rest/>')
  else {
    const step = 'FCGDAEB'[(((n.tpc + 1) % 7) + 7) % 7], alter = Math.floor((n.tpc + 1) / 7) - 2
    const pitch = n.pitch + shift
    x.push(`<pitch><step>${step}</step>${alter ? `<alter>${alter}</alter>` : ''}<octave>${Math.floor((pitch - alter) / 12) - 1}</octave></pitch>`)
  }
  if (!ev.grace) x.push(`<duration>${duration}</duration>`)
  if (n?.tieStop) x.push('<tie type="stop"/>')
  if (n?.tieStart) x.push('<tie type="start"/>')
  x.push(`<voice>${voice}</voice>`)
  if (ev.type) x.push(`<type>${ev.type}</type>`)
  for (let i = 0; i < ev.dots; i++) x.push('<dot/>')
  if (n?.accidental) x.push(`<accidental>${n.accidental}</accidental>`)
  if (ev.ratio) x.push(`<time-modification><actual-notes>${ev.ratio[0]}</actual-notes><normal-notes>${ev.ratio[1]}</normal-notes></time-modification>`)
  if (n && (ev.stem === 'up' || ev.stem === 'down')) x.push(`<stem>${ev.stem}</stem>`)
  x.push(`<staff>${staff}</staff>`)
  if (index === 0) ev.beams.forEach((b, i) => x.push(`<beam number="${i + 1}">${b}</beam>`))
  const notations: string[] = []
  if (n?.tieStop) notations.push('<tied type="stop"/>')
  if (n?.tieStart) notations.push('<tied type="start"/>')
  if (index === 0) {
    notations.push(...slurs)
    for (let i = 0; i < ev.tupletStop; i++) notations.push(`<tuplet type="stop" number="${i + 1}"/>`)
    for (let i = 0; i < ev.tupletStart; i++) notations.push(`<tuplet type="start" number="${i + 1}"/>`)
    notations.push(...ev.marks)
  }
  if (n?.fingering.length) notations.push(`<technical>${n.fingering.map((f) => `<fingering>${esc(f)}</fingering>`).join('')}</technical>`)
  if (n && ev.arpeggio) notations.push('<arpeggiate/>')
  if (notations.length) x.push(`<notations>${notations.join('')}</notations>`)
  x.push('</note>')
  return x.join('')
}

/** Fills `beams` for one voice of one measure. */
function beam(evs: Ev[], time: Time, div: number) {
  const beat = 4 * div / time.d
  const groupSize = (flags: number) => {
    if (time.d === 8 && time.n % 3 === 0) return 3 * beat
    if (time.d === 4 && time.n === 4 && flags === 1) return 2 * beat
    if (time.d === 16 && time.n % 3 === 0) return 3 * beat
    return beat
  }
  const groups: Ev[][] = []
  let group: Ev[] = []
  let breakAfter = false
  const close = () => { if (group.length > 1) groups.push(group); group = [] }
  for (const ev of evs) {
    const flags = FLAGS[ev.type] ?? 0
    const mode = ev.beamMode
    if (ev.rest || !flags || mode === 'no') { close(); breakAfter = false; continue }
    const prev = group[group.length - 1]
    let join = !!prev && !breakAfter
    if (join && (mode === '' || mode === 'auto')) {
      const size = groupSize(Math.max(flags, FLAGS[prev.type] ?? 0))
      join = Math.floor((prev.tick + 1e-6) / size) === Math.floor((ev.tick + 1e-6) / size)
    }
    if (mode === 'begin') join = false
    if (mode === 'mid' || mode === 'end' || mode === 'begin32' || mode === 'begin64') join = !!prev
    if (!join) close()
    group.push(ev)
    breakAfter = mode === 'end'
  }
  close()
  for (const g of groups) {
    const flags = g.map((e) => FLAGS[e.type] ?? 0)
    const levels = Math.max(...flags)
    for (let level = 1; level <= levels; level++) {
      g.forEach((ev, i) => {
        if (flags[i] < level) return
        const before = i > 0 && flags[i - 1] >= level, after = i < g.length - 1 && flags[i + 1] >= level
        ev.beams.push(before && after ? 'continue' : after ? 'begin' : before ? 'end' : i === g.length - 1 ? 'backward hook' : 'forward hook')
      })
    }
  }
}
