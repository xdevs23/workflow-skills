import { describe, expect } from 'claude-code/testing'

import type { CommandRegistrar } from '../commandRegistration'
import { test } from '../testDeclaration'
import { registerGoalsCommand } from './goalSession'

/** An engine whose registration rejects with `rejection`, and the texts it showed and logged. */
function rejectingRegistrar(rejection: unknown) {
  const shown: { toasts: string[]; logs: string[] } = { toasts: [], logs: [] }
  const registrar: CommandRegistrar = {
    command: { register: () => Promise.reject(rejection) },
    ui: {
      log: text => {
        shown.logs.push(text)
      },
      toast: text => {
        shown.toasts.push(text)
      },
    },
  }

  return { registrar, shown }
}

describe('a rejected registration of /goals', () => {
  test('a rejection by the engine is shown in a toast and in the debug log', async () => {
    const refusal = new Error('$.command.register: "/goals" refused: it is the built-in /goals')
    const { registrar, shown } = rejectingRegistrar(refusal)

    await registerGoalsCommand(registrar)

    expect(shown.toasts).toHaveLength(1)
    expect(shown.toasts[0]).toContain('refused: it is the built-in /goals')
    expect(shown.logs).toEqual(shown.toasts)
  })

  test('an error that does not name the call fails the registration', async () => {
    const failure = new Error('the connection to the host was lost')
    const { registrar, shown } = rejectingRegistrar(failure)

    await expect(registerGoalsCommand(registrar)).rejects.toBe(failure)
    expect(shown.toasts).toEqual([])
    expect(shown.logs).toEqual([])
  })

  test('a rejection that is not an Error fails the registration', async () => {
    const { registrar, shown } = rejectingRegistrar('$.command.register')

    await expect(registerGoalsCommand(registrar)).rejects.toBe('$.command.register')
    expect(shown.toasts).toEqual([])
  })
})
