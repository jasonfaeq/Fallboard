import type { Input, NoteEvent } from '../../src/engine/input'
import type { Engine } from '../../src/engine/audio'

declare global {
  interface Window {
    __piano: { input: Input; engine: Engine; send: (e: NoteEvent) => void }
  }
}
