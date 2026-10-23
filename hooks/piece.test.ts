import { describe, expect, test } from 'claude-code/testing'

import { pieceOf } from './piece.ts'
import { Report } from './reply.ts'

const END = {
  final: 'Next I will review it.',
  user: ['fix it'],
  running: [{ id: '1', name: 'build', description: 'd' }],
  waiting: [{ kind: 'monitor', description: 'CI' }],
  sent: [],
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

  test('adds the findings already sent for the current prompt, while there are any', () => {
    const sent = [
      { report: Report.Forbidden, rule: 'r', source: 's', place: 'p', wrong: 'w', instead: 'i' },
    ]
    const [turn] = pieceOf({ ...END, sent, todo: null })

    expect(JSON.parse(turn?.text ?? '')).toHaveProperty('sent', sent)
  })

  test('puts a TODO.md it sends in a block ahead of the rest', () => {
    const [todo, turn, ...rest] = pieceOf({ ...END, todo: '# Todo' })

    expect(todo?.cache).toBeUndefined()
    expect(JSON.parse(todo?.text ?? '')).toEqual({ todo: '# Todo' })
    expect(JSON.parse(turn?.text ?? '')).toHaveProperty('final', 'Next I will review it.')
    expect(rest).toEqual([])
  })
})
