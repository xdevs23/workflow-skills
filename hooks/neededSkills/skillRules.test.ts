import { describe, expect } from 'claude-code/testing'

import { test } from '../testDeclaration'
import type { SeenToolCall } from './matcher'
import { SKILL_RULES } from './skillRules'

const PROJECT_ROOT = '/home/dev/shop'

const WRITING_CODE = 'workflow-skills:writing-code'
const COMMIT_MESSAGES = 'workflow-skills:commit-messages'
const WRITING_STYLE = 'workflow-skills:writing-style'
const COPYWRITING = 'workflow-skills:copywriting'
const WRITING_TESTS = 'workflow-skills:writing-tests'
const CHANGING_THE_BUILD = 'workflow-skills:changing-the-build'
const PULL_REQUEST = 'workflow-skills:pull-request'
const PR_COMMENT_REPLIES = 'workflow-skills:pr-comment-replies'

const KOTLIN = 'skills/writing-code/languages/kotlin.md'
const RUST = 'skills/writing-code/languages/rust.md'
const TYPESCRIPT = 'skills/writing-code/languages/typescript.md'
const PYTHON = 'skills/writing-code/languages/python.md'
const GO = 'skills/writing-code/languages/go.md'
const C_CPP = 'skills/writing-code/languages/c-cpp.md'
const NIX = 'skills/writing-code/languages/nix.md'

/** An edit of the file at `path` in the project. */
function inProject(path: string): SeenToolCall {
  const file_path = `${PROJECT_ROOT}/${path}`

  return {
    call: { tool: 'Edit', input: { file_path, old_string: '', new_string: '' }, isReadOnly: false },
    projectRoot: PROJECT_ROOT,
  }
}

function bash(command: string): SeenToolCall {
  return {
    call: { tool: 'Bash', input: { command }, isReadOnly: false },
    projectRoot: PROJECT_ROOT,
  }
}

/** The skills and files named by the rows of the table that match `seen`, in table order. */
function needsOf(seen: SeenToolCall): { skills: string[]; files: string[] } {
  const rows = SKILL_RULES.filter(rule => rule.when(seen))

  return { skills: rows.flatMap(rule => rule.skills), files: rows.flatMap(rule => rule.files) }
}

const NOTHING = { skills: [], files: [] }

describe('rows for source files of a language', () => {
  test('an edit of a source file needs writing-code and the rules for the language', () => {
    const cases: readonly (readonly [path: string, language: string])[] = [
      ['app/src/Profile.kt', KOTLIN],
      ['scripts/release.kts', KOTLIN],
      ['core/src/lib.rs', RUST],
      ['web/src/badge.ts', TYPESCRIPT],
      ['web/src/Badge.tsx', TYPESCRIPT],
      ['tools/report.py', PYTHON],
      ['cmd/server/main.go', GO],
      ['native/codec.c', C_CPP],
      ['native/codec.h', C_CPP],
      ['native/render.cpp', C_CPP],
      ['native/render.hpp', C_CPP],
      ['nix/modules/shop.nix', NIX],
    ]
    for (const [path, language] of cases) {
      expect(needsOf(inProject(path))).toEqual({ skills: [WRITING_CODE], files: [language] })
    }
  })

  test('a name that only contains an extension for a language needs nothing', () => {
    for (const path of ['app/src/Profile.kt.orig', 'web/src/badge.tsv', 'notes/go.txt']) {
      expect(needsOf(inProject(path))).toEqual(NOTHING)
    }
  })
})

describe('rows for files of other skills', () => {
  test('a Markdown file needs writing-style', () => {
    expect(needsOf(inProject('docs/setup.md'))).toEqual({ skills: [WRITING_STYLE], files: [] })
  })

  test('a file in a translation folder or a strings.xml needs copywriting', () => {
    const paths = [
      'web/i18n/de.json',
      'web/l10n/fr.json',
      'web/public/locales/en/common.json',
      'translations/pt.po',
      'app/src/main/res/values/strings.xml',
    ]
    for (const path of paths) {
      expect(needsOf(inProject(path))).toEqual({ skills: [COPYWRITING], files: [] })
    }
  })

  test('a test file needs writing-tests beside the rules for the language', () => {
    expect(needsOf(inProject('web/src/badge.test.ts'))).toEqual({
      skills: [WRITING_CODE, WRITING_TESTS],
      files: [TYPESCRIPT],
    })
    expect(needsOf(inProject('pkg/badge/badge_test.go'))).toEqual({
      skills: [WRITING_CODE, WRITING_TESTS],
      files: [GO],
    })
    expect(needsOf(inProject('app/src/test/ProfileTest.kt'))).toEqual({
      skills: [WRITING_CODE, WRITING_TESTS],
      files: [KOTLIN],
    })
    expect(needsOf(inProject('tests/checkout.sh'))).toEqual({ skills: [WRITING_TESTS], files: [] })
  })

  test('a build file needs changing-the-build', () => {
    for (const path of ['web/package.json', 'core/Cargo.toml', 'build.gradle', 'Dockerfile']) {
      expect(needsOf(inProject(path))).toEqual({ skills: [CHANGING_THE_BUILD], files: [] })
    }
    expect(needsOf(inProject('flake.nix'))).toEqual({
      skills: [WRITING_CODE, CHANGING_THE_BUILD],
      files: [NIX],
    })
    expect(needsOf(inProject('app/build.gradle.kts'))).toEqual({
      skills: [WRITING_CODE, CHANGING_THE_BUILD],
      files: [KOTLIN],
    })
  })
})

describe('rows for shell commands', () => {
  test('git commit and git add need commit-messages', () => {
    const commands = [
      'git commit -m "fix badge"',
      'git commit --amend --no-edit',
      'git add app/src/Profile.kt',
      'cd app && git   commit -F msg.txt',
    ]
    for (const command of commands) {
      expect(needsOf(bash(command))).toEqual({ skills: [COMMIT_MESSAGES], files: [] })
    }
  })

  test('other git commands need nothing', () => {
    for (const command of ['git rebase main', 'git merge feature', 'git commit-tree HEAD^{tree}']) {
      expect(needsOf(bash(command))).toEqual(NOTHING)
    }
  })

  test('creating or editing a pull request needs pull-request', () => {
    for (const command of ['gh pr create --fill', 'gh pr edit 12 --body-file body.md']) {
      expect(needsOf(bash(command))).toEqual({ skills: [PULL_REQUEST], files: [] })
    }
  })

  test('a comment on a pull request or an issue needs pr-comment-replies', () => {
    for (const command of ['gh pr comment 12 --body-file reply.md', 'gh issue comment 7']) {
      expect(needsOf(bash(command))).toEqual({ skills: [PR_COMMENT_REPLIES], files: [] })
    }
    expect(needsOf(bash('gh pr view 12 --comments'))).toEqual(NOTHING)
  })
})

describe('tools the rows do not read', () => {
  test('a tool that does not write the file or run the command needs nothing', () => {
    const read: SeenToolCall = {
      call: {
        tool: 'Read',
        input: { file_path: `${PROJECT_ROOT}/app/Profile.kt` },
        isReadOnly: true,
      },
      projectRoot: PROJECT_ROOT,
    }

    expect(needsOf(read)).toEqual(NOTHING)
  })
})
