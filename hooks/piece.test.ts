import { describe, expect, test } from 'claude-code/testing'

import { pieceOf } from './piece.ts'

const SAY = { kind: 'say', text: 'done' } as const

describe('the piece of work', () => {
  test('during a turn is the work alone', () => {
    expect(pieceOf([SAY], undefined).map(block => JSON.parse(block.text))).toEqual([
      { turnEnded: false, work: [SAY] },
    ])
  })

  test('at the end of a turn adds TODO.md in a cached block, and the running workflows', () => {
    const tasks = [
      { id: '1', type: 'workflow', status: 'running', description: 'd', name: 'build' },
      { id: '2', type: 'workflow', status: 'completed', description: 'old' },
      { id: '3', type: 'shell', status: 'running', description: 'watch' },
    ]
    const [todo, piece, ...rest] = pieceOf([SAY], { todo: '# Todo', tasks })

    expect(todo?.cache).toBe(true)
    expect(JSON.parse(todo?.text ?? '')).toEqual({ todo: '# Todo' })
    expect(JSON.parse(piece?.text ?? '')).toEqual({
      turnEnded: true,
      work: [SAY],
      running: [{ workflow: 'build', description: 'd' }],
    })
    expect(rest).toEqual([])
  })
})
