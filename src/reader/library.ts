// The score library: built-in pieces plus the files the player imports, kept in this browser
// (IndexedDB), so an imported score is still there next time. Nothing leaves the computer.
import chopin from '../content/scores/chopin-op28-4.musicxml?raw'
import bach from '../content/scores/bach-bwv846.musicxml?raw'
import { isMuseScoreFile } from './mscz'

export interface ScoreEntry {
  id: string
  title: string
  composer: string
  /** the imported file's name; empty for built-in pieces */
  file: string
  added: number
  builtIn: boolean
}

export const BUILT_IN: (ScoreEntry & { xml: string })[] = [
  { id: 'builtin:chopin-op28-4', title: 'Prelude in E minor, Op. 28 No. 4', composer: 'Frédéric Chopin', file: '', added: 0, builtIn: true, xml: chopin },
  { id: 'builtin:bach-bwv846', title: 'Prelude in C major, BWV 846', composer: 'Johann Sebastian Bach', file: '', added: 0, builtIn: true, xml: bach },
]

/** what OpenSheetMusicDisplay.load() accepts: MusicXML text, or a compressed .mxl as a Blob */
export type ScoreSource = string | Blob

const ZIP = [0x50, 0x4b, 0x03, 0x04]
const isZip = (bytes: Uint8Array) => ZIP.every((b, i) => bytes[i] === b)

/** Explains files that cannot be opened, so the player knows what to download instead.
 *  MuseScore files (.mscz/.mscx) pass: they are converted to MusicXML on import (mscz.ts). */
export function checkFile(name: string, data: ArrayBuffer): string | null {
  const lower = name.toLowerCase()
  const bytes = new Uint8Array(data, 0, Math.min(data.byteLength, 512))
  const head = new TextDecoder().decode(bytes)
  const howTo = 'On musescore.com, open the score and choose Download → MusicXML. In MuseScore Studio, use File → Export → MusicXML.'
  if (isMuseScoreFile(lower)) return null
  if (lower.endsWith('.mid') || lower.endsWith('.midi') || head.startsWith('MThd')) return `MIDI files have no sheet music in them. ${howTo}`
  if (lower.endsWith('.pdf') || head.startsWith('%PDF')) return `A PDF is a picture of the music, so it cannot be played. ${howTo}`
  if (isZip(bytes)) return lower.endsWith('.mxl') || lower.endsWith('.zip') ? null : `This compressed file is not a MusicXML (.mxl) file. ${howTo}`
  if (/<score-(partwise|timewise)/.test(head) || /<\?xml|<!DOCTYPE/.test(head)) return null
  return `This does not look like MusicXML. ${howTo}`
}

export function sourceFrom(data: ArrayBuffer): ScoreSource {
  const bytes = new Uint8Array(data)
  if (isZip(bytes)) return new Blob([bytes], { type: 'application/vnd.recordare.musicxml' })
  // MuseScore writes UTF-8; a UTF-16 byte order mark is honoured too.
  const utf16 = (bytes[0] === 0xff && bytes[1] === 0xfe) || (bytes[0] === 0xfe && bytes[1] === 0xff)
  return new TextDecoder(utf16 ? (bytes[0] === 0xff ? 'utf-16le' : 'utf-16be') : 'utf-8').decode(bytes)
}

// ---------------- IndexedDB ----------------
const DB = 'piano-trainer-library'
let opening: Promise<IDBDatabase> | null = null
function db() {
  opening ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB, 1)
    request.onupgradeneeded = () => {
      request.result.createObjectStore('meta', { keyPath: 'id' })
      request.result.createObjectStore('data')
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  opening.catch(() => { opening = null })
  return opening
}
function run<T>(store: 'meta' | 'data', mode: IDBTransactionMode, body: (s: IDBObjectStore) => IDBRequest<T>) {
  return db().then((d) => new Promise<T>((resolve, reject) => {
    const request = body(d.transaction(store, mode).objectStore(store))
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  }))
}

export async function listImported(): Promise<ScoreEntry[]> {
  try {
    const all = await run<ScoreEntry[]>('meta', 'readonly', (s) => s.getAll())
    return all.sort((a, b) => b.added - a.added)
  } catch { return [] }
}

/** Saves an imported file. Returns its entry; `saved` is false when this browser cannot store it. */
export async function importFile(name: string, data: ArrayBuffer): Promise<{ entry: ScoreEntry; saved: boolean }> {
  const entry: ScoreEntry = {
    id: `file:${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    title: name.replace(/\.(musicxml|xml|mxl|mscz|mscx)$/i, ''), composer: '', file: name, added: Date.now(), builtIn: false,
  }
  try {
    await run('data', 'readwrite', (s) => s.put(data, entry.id))
    await run('meta', 'readwrite', (s) => s.put(entry))
    return { entry, saved: true }
  } catch { return { entry, saved: false } }
}

export async function loadImported(id: string): Promise<ArrayBuffer | null> {
  try { return (await run<ArrayBuffer | undefined>('data', 'readonly', (s) => s.get(id))) ?? null } catch { return null }
}

export async function renameImported(entry: ScoreEntry) {
  try { await run('meta', 'readwrite', (s) => s.put(entry)) } catch { /* the name is cosmetic */ }
}

export async function deleteImported(id: string) {
  await run('meta', 'readwrite', (s) => s.delete(id))
  await run('data', 'readwrite', (s) => s.delete(id))
}
