# Part 4: scene types

A scene is a typed module in the application's own language, checked by the same compiler or type
checker as the application. The harness defines a small set of types that every scene uses, and the
types are the whole scene language: scenes call functions and the automation component's own
interface directly, and no domain-specific scene language, configuration format or plugin platform
is built on top.

## The variant

A variant is one named combination of rendering settings. It carries a name, the window or viewport
width and height, the interface locale, the theme, and optionally a container width for component
scenes. A scene may add its own fixture parameter to a variant, such as whether an item has a stored
value or none, so that one scene runs the same question against several fixture states. Each variant
name is unique within a scene.

The harness defines one shared variant set, and scenes use it unless their question needs a subset
or an extension. The reference's set was a desktop size in the primary language with a light theme,
the same desktop size in a second language with a dark theme, and a compact width in the primary
language with a light theme; its component scenes added two narrow container widths at the desktop
size. These are bounded probes of a few sizes, languages and themes, and the contract says so; they
never claim complete responsive or language coverage. Adaptation point: the sizes, the locales and
the themes the project supports.

## The response fixture

A response fixture declares one expected request at the data boundary and its answer. It carries a
stable key, the operation or method, the path, the exact query parameters, the exact body for a
write, the response, a policy and optionally an exact count and a declared status.

The policy is one of three. A once response is delivered exactly one time. A repeat response is
delivered to every matching request, for reads the shell polls. A held response is never answered:
the request stays open, as for a long-held subscription, until an explicit scene step releases it or
the teardown cancels it.

The count is the exact total number of deliveries across the scene's declared reloads, for reads
that do not poll. A read that the screen makes once per load and that the scene reloads once has a
count of two.

The status defaults to success. A failing status declares that this request is meant to fail. The
error output the failure provokes stops counting as a capture failure for that path alone, and the
scene fails when the declared failure never happens. Every other error output, application error
and request failure stays a failure, and no status is ever excused for an undeclared path.

## The fixture set

A fixture set is the complete data one variant runs against. It carries a projection version, a
provenance, the main records the scene's screens are built around, and the list of response
fixtures. The provenance is synthetic for a fixture written by hand, and mixed-projected for a set
that combines a projected real sample of part 13 with synthetic responses. Adaptation point: the
main record types, such as the item an item editor screen edits.

The reference reused one small fixture family across all scenes, extended per surface. A project
does the same and never generates a registry of fixtures as large as the platform.

## The measurement

A measurement records one check: its predicate as a readable sentence, whether it passed, the actual
measured values, and a diagnostic flag. Required measurements decide the verdict of the capture.
Diagnostic measurements record product findings: they are reported and kept in the receipt, and a
failing diagnostic neither fails the capture nor is marked acceptable, and the harness never repairs
the product to make it pass. A diagnostic scene that captured correctly still has to pass its
execution, content and navigation checks. When a later approved change fixes the finding, its agreed
requirement becomes a required measurement.

## The scene run context

The run context is the object a scene's run function receives. It carries the automation handle for
the rendering surface, the current variant, the fixture set, a check function and a capture
function.

The check function records a measurement with its predicate, result, actual values and diagnostic
flag. Measurements attach to the next checkpoint the scene captures, and a run that records checks
after its last checkpoint fails, since those checks would belong to no image.

The capture function takes a checkpoint name and optionally a target element. It runs the capture
sequence of part 6 and writes one PNG. The stored checkpoint name joins the variant name and the
checkpoint name, so every checkpoint of a capture is unique, and a duplicate checkpoint name in one
variant fails the run.

A scene can also stop a variant with a hard assertion, for facts without which the rest of the scene
answers nothing, such as a model value after an edit. A failed assertion fails the variant and names
the checkpoint the scene was working towards.

## The scene

A scene carries a stable name, a one-sentence purpose, the projection version of its fixtures, its
variants, a function from a variant to its fixture set, and its run function. It is one of two
kinds, as a union type that the type checker enforces.

A page scene carries a function from the fixture set to the real route or screen it opens. It starts
the application through its real entry, with the complete response set of every consumer on that
screen and in the shell.

A component scene carries the harness entry that mounts it. The entry mounts the actual component
with its real parameters and model updates inside the contextual container it is drawn in, with the
same start-up, styles, translations, theme and shipped fonts as the application, as part 6
describes. A component scene may declare no responses at all, and then any request fails the scene.

## Target selection

Targets are found through the application's existing test hooks where present and through scoped
accessible roles and names elsewhere. The selectors live in the scene that owns the question. A
missing target fails, and an ambiguous target fails; a scene never silently switches to a different
element. No selector asserts a styling class as a substitute for a geometry measurement. Selection
and toggle states are read from the accessibility state of the controls, such as their checked
attribute, the way assistive technology reads them.

Where no test hook exists, the scene finds a target through what it contains or through its
accessible name in the variant's language. A card is found as the innermost container holding its
known controls, a control without an accessible name by its position within a group whose other
members are named, and a text field by its element type when another field with the same role is on
screen.

## Writing interactions

Each interaction awaits its own observable outcome before the next step: a value appearing, a
control becoming enabled or disabled, a row count changing, a dialog appearing. No step waits for a
fixed time.

A popover or menu that closes when focus leaves its control is opened with a dispatched activation
event that does not move focus, since the capture sequence clears focus. Where the popover takes
focus by itself, the scene stops the one focus-leaving event the capture causes from reaching it.
Transitions are advanced by running frames of the paused clock until the element is fully shown,
with its opacity complete and its animations finished, or gone, with a deadline that fails the scene
naming the element.

A hover state is produced with a dispatched pointer event at computed coordinates, since the capture
sequence moves the real pointer away and would end a real hover.

A component whose state would need a visible control to change is switched through a channel that
draws nothing, such as a fragment of the address or a parameter of the harness entry, so no harness
control appears in the picture. A component that picks a random value, such as a rotating
placeholder, receives a fixed real value from the entry.

Expected strings are read from the application's own translation files for the variant's language
where the scene can reach them, and a string a scene writes by hand is written once per interface
language. Expected numbers and dates are formatted with the platform's own formatter in the
variant's language.

A surface wider or taller than the viewport inside a scrolling container is captured region by
region, each region a checkpoint of its own, after a viewport checkpoint of the whole shell.

## Where scenes live

Tracked scenes live beside the harness code, one module per scene, and are registered as part 3
describes. Exploratory scenes live in the harness directory inside the project cache, the location
`workflow-skills:local-cache` defines, until they are promoted.

## Web realization in the reference

The reference wrote its types in TypeScript and checked each scene module with the `satisfies`
operator against the scene union. Its targets were located with Playwright locators on `data-test`
attributes and with role and accessible name queries scoped to a container. Popovers were opened
with a dispatched click event, hover states with a dispatched pointer move, and transitions were
advanced with the page clock's frame steps. Expected strings came from the application's JSON
translation files, and expected numbers and dates from the browser's `Intl` formatters.

## Native and terminal realizations

A native mobile scene is a test class in the application's language. Its variant is a device
profile with a screen size in density-independent units, a density, a locale, a dark or light mode
and a font scale, and its container width is the width of a host view. Targets are found through
test tags, resource identifiers or accessibility identifiers, and through accessibility labels
scoped to a container. A desktop scene uses the toolkit's object names and accessible names the same
way.

A terminal scene's variant is a terminal size in columns and rows, a locale, a color scheme and a
color capability. Its targets are regions of the screen grid found by anchoring on text the
application draws, and its checkpoints capture the whole screen or a rectangle of cells.
