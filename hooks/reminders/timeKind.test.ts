import { describe, expect } from 'claude-code/testing'

import { test } from '../testDeclaration'
import {
  CadenceProblem,
  FieldKind,
  defaultCadenceOf,
  labelOf,
  listKind,
  optionsOf,
} from './cadenceKind'
import { TIME_KIND, TimeUnit } from './timeKind'

/** The registration of a kind that registers no hooks, for the tests of its card alone. */
function registerNothing(): void {}

describe('the card of a reminder sent every given time', () => {
  test('a whole number from 1 and a unit are read, anything else is a problem', () => {
    const listed = listKind(TIME_KIND, registerNothing)

    expect(listed.problemOf({ amount: '2', unit: TimeUnit.Hours })).toBeUndefined()
    expect(listed.problemOf({ amount: ' 30 ', unit: TimeUnit.Minutes })).toBeUndefined()
    for (const amount of ['', '0', '1.5', '-1', 'two', '02']) {
      expect(listed.problemOf({ amount, unit: TimeUnit.Hours })).toBeInstanceOf(CadenceProblem)
    }
    expect(listed.problemOf({ amount: '2', unit: 'days' })).toBeInstanceOf(CadenceProblem)
  })

  test('the card starts on 1 hour, and its cadence line reads as the draft shows', () => {
    const listed = listKind(TIME_KIND, registerNothing)

    expect(defaultCadenceOf(listed).values).toEqual({ amount: '1', unit: TimeUnit.Hours })
    expect(listed.problemOf(defaultCadenceOf(listed).values)).toBeUndefined()
    expect(listed.describe({ amount: '1', unit: TimeUnit.Hours })).toBe('every 1 hour')
    expect(listed.describe({ amount: '2', unit: TimeUnit.Hours })).toBe('every 2 hours')
    expect(listed.describe({ amount: '1', unit: TimeUnit.Minutes })).toBe('every 1 minute')
    expect(listed.describe({ amount: '45', unit: TimeUnit.Minutes })).toBe('every 45 minutes')
  })

  test('the labels of the units agree with the amount typed', () => {
    const unitField = TIME_KIND.fields.find(field => field.kind === FieldKind.Choice)
    const labelsBeside = (amount: string) =>
      unitField === undefined
        ? []
        : optionsOf(TIME_KIND.fields, { amount }, unitField).map(option => option.label)

    expect(labelsBeside('1')).toEqual(['hour', 'minute'])
    expect(labelsBeside('2')).toEqual(['hours', 'minutes'])
  })

  test(
    'the label of the amount names the unit picked, as the dropdown writes more than one',
    () => {
      const amountField = TIME_KIND.fields.find(field => field.kind === FieldKind.Text)
      const unitField = TIME_KIND.fields.find(field => field.kind === FieldKind.Choice)
      const units: readonly string[] = Object.values(TimeUnit)
      if (amountField === undefined || unitField === undefined) {
        throw new Error('The kind "every" has no field for the amount or the unit.')
      }
      const labelOfAmount = (unit: string) =>
        labelOf(TIME_KIND.fields, { amount: '2', unit }, amountField).toLowerCase()
      const labelOfUnit = (unit: string) =>
        optionsOf(TIME_KIND.fields, { amount: '2', unit }, unitField).find(
          option => option.value === unit,
        )?.label

      expect(units.map(labelOfAmount)).toEqual(units.map(labelOfUnit))
    },
  )
})
