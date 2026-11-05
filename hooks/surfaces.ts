import type { Elements, RenderSurface, ResolveInput } from 'claude-code'

/** The surfaces whose table of elements has the Input element. */
export type SurfaceWithInputFields = {
  [S in RenderSurface]: 'Input' extends keyof Elements[S] ? S : never
}[RenderSurface]

// The engine completes the table of elements of every surface with every name, and an element
// unknown to a surface draws nothing there, so whether a field is drawn follows from the surface
// alone. The checker compares each value below with the elements declared for its surface.
const DRAWS_INPUT_FIELDS: {
  [S in RenderSurface]: S extends SurfaceWithInputFields ? true : false
} = {
  terminal: true,
  desktop: true,
  mobile: false,
  vscode: true,
}

/** Whether the surface of `e` draws input fields. */
export function drawsInputFields<E extends ResolveInput>(
  e: E,
): e is Extract<E, { surface: SurfaceWithInputFields }> {
  return DRAWS_INPUT_FIELDS[e.surface]
}
