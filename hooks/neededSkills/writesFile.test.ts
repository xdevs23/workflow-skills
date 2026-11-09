import { describe, expect } from 'claude-code/testing'

import { test } from '../testDeclaration'
import type { Matcher, ToolCall } from './matcher'
import { writesFile } from './writesFile'

const PROJECT_ROOT = '/home/dev/shop'

const SNAPSHOTS = writesFile({ names: ['*.snap', 'snapshot-*.json'], folders: ['fixtures'] })

function edit(path: string): ToolCall {
  return {
    tool: 'Edit',
    input: { file_path: path, old_string: '', new_string: '' },
    isReadOnly: false,
  }
}

function matchesIn(matcher: Matcher, call: ToolCall, projectRoot = PROJECT_ROOT) {
  return matcher({ call, projectRoot })
}

describe('the file matcher', () => {
  test('a star in a name pattern stands for any run of characters', () => {
    for (const path of ['web/badge.snap', 'web/.snap', 'data/snapshot-cart.json']) {
      expect(matchesIn(SNAPSHOTS, edit(`${PROJECT_ROOT}/${path}`))).toBe(true)
    }
  })

  test('a name that only contains the pattern does not match', () => {
    for (const path of ['web/badge.snap.orig', 'web/badge.snapshot', 'data/snapshot-cart.jsonl']) {
      expect(matchesIn(SNAPSHOTS, edit(`${PROJECT_ROOT}/${path}`))).toBe(false)
    }
  })

  test('a folder matches at any depth below the project root', () => {
    for (const path of ['fixtures/cart.txt', 'web/test/fixtures/deep/cart.txt']) {
      expect(matchesIn(SNAPSHOTS, edit(`${PROJECT_ROOT}/${path}`))).toBe(true)
    }
    expect(matchesIn(SNAPSHOTS, edit(`${PROJECT_ROOT}/web/fixtures-old/cart.txt`))).toBe(false)
  })

  test('a folder above the project root does not match', () => {
    const projectRoot = '/home/dev/fixtures/shop'

    expect(matchesIn(SNAPSHOTS, edit(`${projectRoot}/src/cart.txt`), projectRoot)).toBe(false)
  })

  test('a file outside the project root matches by its name alone', () => {
    expect(matchesIn(SNAPSHOTS, edit('/home/dev/fixtures/cart.txt'))).toBe(false)
    expect(matchesIn(SNAPSHOTS, edit('/home/dev/fixtures/cart.snap'))).toBe(true)
  })

  test('Write matches by the path of the file it writes, and Read does not match', () => {
    const path = `${PROJECT_ROOT}/web/badge.snap`

    const write = { tool: 'Write', input: { file_path: path, content: '' }, isReadOnly: false }
    const read = { tool: 'Read', input: { file_path: path }, isReadOnly: true }

    expect(matchesIn(SNAPSHOTS, write)).toBe(true)
    expect(matchesIn(SNAPSHOTS, read)).toBe(false)
  })
})
