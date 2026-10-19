export interface Setlist { id: string; name: string; scores: string[] }
export interface Collection { favourites: string[]; setlists: Setlist[] }

export const EMPTY_COLLECTION: Collection = { favourites: [], setlists: [] }
export function cleanCollection(value: Collection): Collection {
  const ids = (v: unknown) => Array.isArray(v) ? [...new Set(v.filter((id): id is string => typeof id === 'string'))] : []
  return {
    favourites: ids(value.favourites),
    setlists: Array.isArray(value.setlists) ? value.setlists.filter((s) => s && typeof s.id === 'string' && typeof s.name === 'string')
      .map((s) => ({ id: s.id, name: s.name.slice(0, 80), scores: ids(s.scores) })) : [],
  }
}
