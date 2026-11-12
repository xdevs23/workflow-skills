import { AT_CLAUSE_END } from './clauses'

/** A verb that names work. Its forms are sources of expressions, where a space stands for any run
 * of white space. */
type WorkVerb = {
  /** The form said after "I'll", "let me" or "then I", such as "look into". */
  base: string
  /** The form said after "I'm", such as "looking into". */
  ing: string
  /** Sources of expressions for what follows the verb, in either form, in a saying that names no
   * work, such as "here" in "I'm stopping here". */
  notFollowedBy?: readonly string[]
}

const WORK_VERBS: readonly WorkVerb[] = [
  { base: 'check', ing: 'checking', notFollowedBy: [followedBy('in', 'back')] },
  { base: 'read', ing: 'reading', notFollowedBy: [String.raw`\s+(?:\S+\s+){0,3}?(?:as|right)\b`] },
  { base: 'investigate', ing: 'investigating' },
  { base: 'trace', ing: 'tracing' },
  { base: 'analy[sz]e', ing: 'analy[sz]ing' },
  { base: 'research', ing: 'researching' },
  { base: 'measure', ing: 'measuring' },
  { base: 'look into', ing: 'looking into' },
  { base: 'dig into', ing: 'digging into' },
  { base: 'work on', ing: 'working on', notFollowedBy: [followedBy('the assumption')] },
  { base: 'work out', ing: 'working out' },
  { base: 'figure out', ing: 'figuring out' },
  { base: 'find out', ing: 'finding out' },
  { base: 'try', ing: 'trying', notFollowedBy: [followedBy('to keep', 'to be')] },
  { base: 'fix', ing: 'fixing' },
  { base: 'write', ing: 'writing' },
  { base: 'draft', ing: 'drafting' },
  { base: 'implement', ing: 'implementing' },
  { base: 'build', ing: 'building', notFollowedBy: [followedBy('on')] },
  { base: 'test', ing: 'testing' },
  { base: 'verify', ing: 'verifying' },
  { base: 'review', ing: 'reviewing' },
  { base: 'rebase', ing: 'rebasing' },
  { base: 'merge', ing: 'merging' },
  { base: 'commit', ing: 'committing' },
  { base: 'push', ing: 'pushing' },
  { base: 'deploy', ing: 'deploying' },
  { base: 'open', ing: 'opening' },
  {
    base: 'pick',
    ing: 'picking',
    notFollowedBy: [followedBy('up on', 'up where', 'between', 'from', 'option', 'one')],
  },
  { base: 'cherry-pick', ing: 'cherry-picking' },
  {
    base: 'start',
    ing: 'starting',
    notFollowedBy: [followedBy('to', 'with the summary', 'with a summary')],
  },
  {
    base: 'stop',
    ing: 'stopping',
    notFollowedBy: [
      followedBy(
        'here', 'there', 'now', 'for', 'at', 'to', 'after', 'because', 'since', 'so', 'until',
        'before', 'early', 'short', 'with', 'by',
      ),
      AT_CLAUSE_END,
    ],
  },
  { base: 'restart', ing: 'restarting' },
  { base: 'retry', ing: 'retrying' },
  { base: 'resume', ing: 'resuming' },
  {
    base: 'run',
    ing: 'running',
    notFollowedBy: [
      followedBy(
        'out', 'low', 'short', 'late', 'behind', 'on', 'as', 'into', 'in', 'at', 'with', 'under',
        'a bit', 'a little', 'this by', 'through',
      ),
    ],
  },
  { base: 'launch', ing: 'launching' },
  { base: 'kick off', ing: 'kicking off' },
  { base: 'continue with', ing: 'continuing with' },
  { base: 'proceed with', ing: 'proceeding with' },
  { base: 'go on with', ing: 'going on with' },
  { base: 'carry on with', ing: 'carrying on with' },
  { base: 'move on with', ing: 'moving on with' },
  { base: 'move on to', ing: 'moving on to' },
  { base: 'go ahead with', ing: 'going ahead with' },
  { base: 'press ahead with', ing: 'pressing ahead with' },
]

/** The source of an expression for white space, then any of the phrases as whole words. */
function followedBy(...phrases: string[]): string {
  return String.raw`\s+(?:${phrases.map(spaced).join('|')})\b`
}

/** The source of an expression for the phrase, with any run of white space where it has a space. */
function spaced(phrase: string): string {
  return phrase.replaceAll(' ', String.raw`\s+`)
}

/** The source of an expression for any work verb in the given form, followed by none of the words
 * that make it a saying. */
function anyWorkVerb(formOf: (verb: WorkVerb) => string): string {
  const verbs = WORK_VERBS.map(verb => {
    const exclusions = (verb.notFollowedBy ?? []).map(after => `(?!${after})`).join('')

    return String.raw`${spaced(formOf(verb))}\b${exclusions}`
  })

  return `(?:${verbs.join('|')})`
}

/** A work verb in the form said after "I'll", "let me" or "then I". */
export const WORK_VERB = anyWorkVerb(verb => verb.base)
/** A work verb in the form said after "I'm". */
export const WORK_GERUND = anyWorkVerb(verb => verb.ing)
