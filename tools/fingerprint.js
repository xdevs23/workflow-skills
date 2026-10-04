// The proof the spec tool prints when a check passes, which each workflow script computes again from
// its own launch values: the 32-bit FNV-1a hash of the values as JSON with sorted keys. A workflow
// script runs without imports, so each one carries these two definitions exactly as written here.
const withSortedKeys = value => {
  if (Array.isArray(value)) return value.map(withSortedKeys)
  if (value === null || typeof value !== 'object') return value
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, withSortedKeys(value[key])]))
}
const fingerprint = values => {
  const json = JSON.stringify(withSortedKeys(values))
  let hash = 0x811c9dc5
  for (let index = 0; index < json.length; index++) hash = Math.imul(hash ^ json.charCodeAt(index), 0x01000193)
  return (hash >>> 0).toString(16).padStart(8, '0')
}
export { fingerprint }
