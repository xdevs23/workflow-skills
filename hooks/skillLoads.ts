import type { ApiContentBlock, ApiMessage } from 'claude-code'

import { SKILL_TOOL } from './names'

enum BlockKind {
  SkillCall = 'skill-call',
  ToolResult = 'tool-result',
  Other = 'other',
}

/** A content block of the api form, read into the parts of a Skill tool call and its result. */
type ReadBlock =
  | { kind: BlockKind.SkillCall; callId: string; skill: string }
  | { kind: BlockKind.ToolResult; callId: string; isError: boolean }
  | { kind: BlockKind.Other }

/**
 * Returns the names of the skills in `context` that a call to the Skill tool loaded, counting a
 * call only once its result is present and not marked as an error.
 */
export function readLoadedSkills(context: readonly ApiMessage[]): ReadonlySet<string> {
  const blocks = context.flatMap(message => message.content.map(readBlock))
  const skillsByCall = new Map(
    blocks.flatMap(block =>
      block.kind === BlockKind.SkillCall ? [[block.callId, block.skill] as const] : [],
    ),
  )

  return new Set(
    blocks.flatMap(block => {
      const skill =
        block.kind === BlockKind.ToolResult && !block.isError
          ? skillsByCall.get(block.callId)
          : undefined

      return skill === undefined ? [] : [skill]
    }),
  )
}

/** Reads a block, which the engine declares with fields of unknown type, into a typed model. */
function readBlock(block: ApiContentBlock): ReadBlock {
  const { type, id, name, input, tool_use_id: resultOf, is_error: isError } = block
  if (type === 'tool_use' && name === SKILL_TOOL && typeof id === 'string') {
    const skill = readSkillName(input)

    return skill === undefined
      ? { kind: BlockKind.Other }
      : { kind: BlockKind.SkillCall, callId: id, skill }
  }
  if (type === 'tool_result' && typeof resultOf === 'string') {
    return { kind: BlockKind.ToolResult, callId: resultOf, isError: isError === true }
  }

  return { kind: BlockKind.Other }
}

/** The Skill tool loads a skill also when its name has surrounding spaces or a leading slash. */
function readSkillName(input: unknown): string | undefined {
  if (typeof input !== 'object' || input === null || !('skill' in input)) {
    return undefined
  }
  const { skill } = input

  return typeof skill === 'string' ? skill.trim().replace(/^\//, '') : undefined
}
