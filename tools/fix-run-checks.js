// The checks a fix run applies to the results of its fixer and of its diff check before it builds on
// them. A run's journal holds every result a stage returned, the ones the run refused included, so
// the spec tool applies the same checks to the results it reads there. A workflow script runs without
// imports, so the fix script carries these definitions exactly as written here.
const SHA = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/
const shaByPath = list => new Map(list.map(entry => [entry.path, entry.sha]))
const hasHardFlag = r => r?.abort != null && r.abort.trigger !== 'none'
const requireText = (value, label) => {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Missing ' + label)
}
const exactlyOnce = (actual, expected, label) => {
  const wanted = new Set(expected), seen = new Set()
  for (const id of actual) {
    if (!wanted.has(id) || seen.has(id)) throw new Error('Unknown or duplicate ' + label + ': ' + id)
    seen.add(id)
  }
  if (seen.size !== wanted.size) throw new Error('Missing ' + label)
}
const withReceipts = (items, label) => {
  for (const item of items) if (!item.receipts?.length) throw new Error(label + ' without a receipt: ' + JSON.stringify(item))
}
const checkCoverage = r => {
  if (!r.coverage.length) throw new Error('coverage is empty')
  for (const c of r.coverage) {
    if (!c.checked && !r.limitations.length) {
      throw new Error('coverage entry not checked and no limitation declared: ' + c.what + '. Drop the entry when it names an act ' +
        'your own rules forbid or input you are not given by design. Otherwise declare the real limitation that kept it unchecked.')
    }
  }
}
const checkReader = r => {
  withReceipts(r.findings, 'finding')
  for (const f of r.findings) if (!f.lane) throw new Error('finding without a lane: ' + f.claim)
  checkCoverage(r)
}
const checkWriterSnapshot = (result, starts) => {
  const expected = shaByPath(starts), paths = result.repositories.map(r => r.path)
  if (paths.length !== expected.size || new Set(paths).size !== paths.length || paths.some(path => !expected.has(path))) {
    throw new Error('Writer did not return exactly one entry per repository of the list: ' + JSON.stringify(paths))
  }
  for (const r of result.repositories) {
    if (r.startSha !== expected.get(r.path) || !SHA.test(r.snapshotSha || '') || r.clean !== true) {
      throw new Error('Writer did not return a clean immutable snapshot of ' + r.path + ' from its expected start SHA')
    }
  }
}
const checkWriter = r => {
  const paths = new Set(r.repositories.map(repository => repository.path))
  for (const c of r.commits) if (!paths.has(c.repository)) throw new Error('commit ' + c.sha + ' names no repository of the result: ' + JSON.stringify(c.repository))
  let moved = false
  for (const { path, startSha, snapshotSha, clean, git } of r.repositories) {
    if (git.head.trim() !== snapshotSha) throw new Error('git.head ' + JSON.stringify(git.head) + ' of ' + path + ' differs from snapshotSha ' + JSON.stringify(snapshotSha))
    if (clean !== (git.status === '')) throw new Error('clean disagrees with git.status in ' + path)
    const commits = r.commits.filter(c => c.repository === path)
    if (snapshotSha !== startSha) {
      moved = true
      if (!commits.length) throw new Error('the new snapshot of ' + path + ' needs commits in it')
    } else if (commits.length) throw new Error('the unchanged snapshot of ' + path + ' lists commits')
  }
  if (moved) {
    if (!r.files.length) throw new Error('a new snapshot needs files')
    if (!r.checks.some(c => c.passed === r.proofPassed)) throw new Error('no check has passed equal to proofPassed')
  } else if (r.files.length) throw new Error('an unchanged snapshot lists files')
}
// The fixer's result, against the sources of the fix list and the snapshots the fixer started from.
const checkFixerResult = (r, keys, starts) => {
  checkWriter(r)
  exactlyOnce(r.dispositions.map(d => d.key), keys, 'fix key')
  checkWriterSnapshot(r, starts)
  for (const d of r.dispositions) requireText(d.reason, 'fix disposition reason')
}
// The diff check's result, against the sources of the fix list.
const checkDiffResult = (r, keys) => {
  checkReader(r)
  withReceipts(r.mappings, 'mapping')
  for (const m of r.mappings) {
    requireText(m.change, 'mapped change')
    if (!keys.includes(m.source)) throw new Error('mapping to no entry of the fix list: ' + m.source)
  }
  if (!r.mappings.length && !r.findings.length) throw new Error('the diff is not empty, yet no change is mapped and none is a finding')
}
export { hasHardFlag, checkFixerResult, checkDiffResult }
