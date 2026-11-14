/** A post of a pane module that cannot be read, with what is wrong with it. */
export class UnreadablePost {
  readonly problem: string

  constructor(problem: string) {
    this.problem = problem
  }
}

/** The post with the field `field` of an action that is missing or not of its shape. */
export function unreadableField(field: string): UnreadablePost {
  return new UnreadablePost(`the field ${field} of an action is missing or not of its shape`)
}
