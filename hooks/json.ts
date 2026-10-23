// A value as JSON can write it.
export type Json = null | boolean | number | string | readonly Json[] | JsonObject
export type JsonObject = { readonly [key: string]: Json }

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isJson = (value: unknown): value is Json =>
  value === null ||
  typeof value === 'boolean' ||
  typeof value === 'number' ||
  typeof value === 'string' ||
  (Array.isArray(value) && value.every(isJson)) ||
  isJsonObject(value)

export const isJsonObject = (value: unknown): value is JsonObject =>
  isRecord(value) && Object.values(value).every(isJson)
