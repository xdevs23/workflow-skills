import type { Elements, RenderSurface, ResolveInput } from 'claude-code'

/** The surfaces whose table of elements has the element `Element`. */
type SurfaceWith<Element extends string> = {
  [S in RenderSurface]: Element extends keyof Elements[S] ? S : never
}[RenderSurface]

/** The surfaces whose table of elements has the fields: the Input and the Select element. */
export type SurfaceWithFields = SurfaceWith<'Input'> & SurfaceWith<'Select'>

// The engine completes the table of elements of every surface with every name, and an element
// unknown to a surface draws nothing there, so whether an element is drawn follows from the surface
// alone. The checker compares each value below with the elements declared for its surface.
const DRAWS_FIELDS: {
  [S in RenderSurface]: S extends SurfaceWithFields ? true : false
} = {
  terminal: true,
  desktop: true,
  mobile: false,
  vscode: true,
}

/** Whether the surface of `e` draws fields: input fields and Select. */
export function drawsFields<E extends ResolveInput>(
  e: E,
): e is Extract<E, { surface: SurfaceWithFields }> {
  return DRAWS_FIELDS[e.surface]
}
