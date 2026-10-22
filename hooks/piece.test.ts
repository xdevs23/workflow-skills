import { describe, expect, test } from 'claude-code/testing'

import { pieceOf } from './piece.ts'

const END = {
  final: 'Next I will review it.',
  user: ['fix it'],
  running: [{ id: '1', name: 'build', description: 'd' }],
  waiting: [{ kind: 'monitor', description: 'CI' }],
}

describe('the piece', () => {
  test('is the final message, the prompts of the user and the running workflows', () => {
    expect(pieceOf({ ...END, todo: null }).map(block => JSON.parse(block.text))).toEqual([
      {
        final: 'Next I will review it.',
        user: ['fix it'],
        running: [{ workflow: 'build', description: 'd' }],
        waiting: [{ kind: 'monitor', description: 'CI' }],
      },
    ])
  })

  test('puts a TODO.md it sends in a block ahead of the rest', () => {
    const [todo, turn, ...rest] = pieceOf({ ...END, todo: '# Todo' })

    expect(todo?.cache).toBeUndefined()
    expect(JSON.parse(todo?.text ?? '')).toEqual({ todo: '# Todo' })
    expect(JSON.parse(turn?.text ?? '')).toHaveProperty('final', 'Next I will review it.')
    expect(rest).toEqual([])
  })
})
