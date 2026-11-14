import type { Elements, RenderSurface, ResolveInput } from 'claude-code'

/** The surfaces whose table of elements has the element `Element`. */
type SurfaceWith<Element extends string> = {
  [S in RenderSurface]: Element extends keyof Elements[S] ? S : never
}[RenderSurface]

/** The surfaces whose table of elements has the fields: the Input and the Select element. */
export type SurfaceWithFields = SurfaceWith<'Input'> & SurfaceWith<'Select'>

/** The surfaces whose table of elements has Client, which a surface module draws. */
type SurfaceWithClient = SurfaceWith<'Client'>

const DRAWS_CLIENT: { [S in RenderSurface]: S extends SurfaceWithClient ? true : false } = {
  terminal: true,
  desktop: true,
  mobile: false,
  vscode: false,
}

// The engine completes the table of elements of every surface with every name, and an element
// unknown to a surface draws nothing there, so a surface whose table lacks the fields never draws
// them. A surface whose table has them may still draw an empty Box in their place: a mobile app is
// sent Input and Select only if it named them when it attached, and a hook cannot tell which app it
// got. So mobile draws without fields, which works on every app.
const DRAWS_FIELDS: { [S in RenderSurface]: S extends SurfaceWithFields ? boolean : false } = {
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

/** Whether the surface of `e` draws a Client, the region a surface module draws. */
export function drawsClient<E extends ResolveInput>(
  e: E,
): e is Extract<E, { surface: SurfaceWithClient }> {
  return surfaceDrawsClient(e.surface)
}

/** Whether `surface` draws a Client, the region a surface module draws. */
export function surfaceDrawsClient(surface: RenderSurface): surface is SurfaceWithClient {
  return DRAWS_CLIENT[surface]
}
