import type { Input, NoteEvent } from '../../src/engine/input'

declare global {
  interface Window {
    __piano: { input: Input; send: (e: NoteEvent) => void }
  }
}
