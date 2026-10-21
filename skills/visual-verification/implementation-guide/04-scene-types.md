# Part 4: scene types

A scene is a typed module written in the same language as the application, checked by the same
compiler or type checker. The harness defines a small set of types used by every scene, and those
types are the whole scene language. Scenes call functions and the interface of the automation
component directly. The harness does not build a domain-specific scene language, a configuration
format or a plugin platform on top.

## The variant

A variant is one named combination of rendering settings. It contains a name, the window or viewport
width and height, the interface locale, the theme, and optionally a container width for component
scenes. A scene may add a fixture parameter to a variant, such as whether an item has a stored value
or none. One scene then runs the same question against several states of the fixture. Each variant
name is unique within a scene.

The harness defines one shared set of variants. Scenes use it unless their question needs a subset
or an extension. The set used by the reference had three variants: a desktop size in the primary
language with a light theme, the same desktop size in a second language with a dark theme, and a
compact width in the primary language with a light theme. Component scenes in the reference added
two narrow container widths at the desktop size. These variants probe only a few sizes, languages
and themes. The contract describes them that way and never presents them as complete coverage of
responsive layouts or languages. Adaptation point: the sizes, the locales and the themes supported
by the project.

## The response fixture

A response fixture declares one expected request at the data boundary and the response to it. It
contains a stable key, the operation or method, the path, the exact query parameters, the exact
body for a write, the response, a policy and optionally an exact count and a declared status.

The policy has one of three values. A once response is delivered exactly one time. A repeat response
is delivered to every matching request, for requests polled by the shell. A held response is never
delivered: the request is left open, as for a long-held subscription, until an explicit scene step
releases it or the teardown cancels it.

The count is the exact total number of deliveries across the reloads declared by the scene, for
requests that are not polled. A request made by the screen once per load, in a scene that reloads
once, has a count of two.

The status defaults to success. A failing status marks the request as meant to fail. The error
output caused by that failure no longer counts as a capture failure, for that path alone. The scene
fails when the declared failure does not happen. Every other error output, application error and
request failure is still a failure. A failing status on an undeclared path is never excused.

## The fixture set

A fixture set is the complete data used when one variant runs. It contains the version of the
projection it was built from, a provenance, the main records used to build the screens in the scene,
and the list of response fixtures. The provenance is synthetic for a fixture written by hand, and
mixed-projected for a set that combines a projected real sample described in part 13 with synthetic
responses. Adaptation point: the main record types, such as the item edited on an item editor
screen.

The reference reused one small family of fixtures across all scenes, extended per surface. A project
does the same and never generates a registry of fixtures as large as the platform.

## The measurement

A measurement records one check: its predicate as a readable sentence, whether it passed, the actual
measured values, and a diagnostic flag. Required measurements determine the verdict of the capture.
Diagnostic measurements record product findings. They are reported and stored in the receipt. A
failing diagnostic measurement neither fails the capture nor is marked acceptable. The harness never
repairs the product to make it pass. A diagnostic scene that captured correctly still has to pass
its execution, content and navigation checks. When a later approved change fixes the finding, the
requirement agreed for it becomes a required measurement.

## The scene run context

The run context is the object received by the run function of a scene. It contains the automation
handle for the rendering surface, the current variant, the fixture set, a check function and a
capture function.

The check function records a measurement with its predicate, result, actual values and diagnostic
flag. Measurements attach to the next checkpoint captured by the scene. A run that records checks
after its last checkpoint fails, since those checks would belong to no image.

The capture function takes a checkpoint name and optionally a target element. It runs the capture
sequence described in part 6 and writes one PNG. The stored checkpoint name is the variant name
joined with the checkpoint name. A duplicate checkpoint name in one variant fails the run.

A scene can also stop a variant with a hard assertion, for facts without which the rest of the scene
proves nothing, such as a model value after an edit. A failed assertion fails the variant, and its
message contains the name of the next checkpoint in the scene.

## The scene

A scene contains a stable name, a one-sentence purpose, the version of the projection behind the
fixtures it uses, its variants, a function from a variant to its fixture set, and its run function.
It is one of two kinds, as a union type enforced by the type checker.

A page scene contains a function that maps the fixture set to the real route or screen to open. It
starts the application through its real entry, with the complete set of responses for every
consumer on that screen and in the shell.

A component scene contains the harness entry that mounts the component. The entry mounts the actual
component with its real parameters and model updates inside the contextual container that surrounds
it in the application, with the same start-up, styles, translations, theme and shipped fonts as the
application, as described in part 6. A component scene may declare an empty set of responses. Any
request then fails the scene.

## Component hosts

A component scene draws the component in every real host where it appears, at the literal width,
height and background of that host, including the narrowest host used for it by the application. A
host is the box around the component on a real screen, such as a side panel, a popover, a dialog or
a full-width phone view. The scene also draws the component in each state it shows for the requests
needed by it, such as ready, loading and error.
Adaptation point: the hosts of each component, with their sizes and backgrounds.

A container-responsive component, which changes layout with its width, is mounted in one host per
layout, at the literal widths of the real hosts where it appears. Every host is rendered in every
named variant. Each layout appears in every language and theme of the variant set.

The container widths of a component scene describe the component alone and do not replace evidence
from the page layout. The geometry checks of the component are applied again in a page scene that
draws the component inside the real screen where it appears. There, the shell, the neighbouring
sections and the real container determine how much space the component gets.

## Target selection

Targets are found through the existing test hooks of the application where present and through
scoped accessible roles and names elsewhere. The selectors are written in the scene built for the
question. A missing target fails, and so does an ambiguous target. A scene never silently switches
to a different element. A selector never asserts a styling class as a substitute for a geometry
measurement. Selection and toggle states are read from the accessibility state of the controls, such
as the checked attribute, the way assistive technology reads them.

Where a test hook is missing, the scene finds a target by its content or by its accessible name in
the language of the variant. A card is found as the innermost container that contains its known
controls. A control without an accessible name is found by its position within a group whose other
members are named. A text field is found by its element type when another field with the same role
is on screen.

## Writing interactions

Each interaction waits for its observable outcome before the next step: a value appearing, a control
becoming enabled or disabled, a row count changing, a dialog appearing. A step never waits for a
fixed time.

A popover or menu that closes when focus leaves its control is opened with a dispatched activation
event that does not move focus, since the capture sequence clears focus. Where the popover takes
focus by itself, the scene prevents the one focus-leaving event caused by the capture from getting
to the popover. Transitions are advanced by running frames of the paused clock until the element is
either fully shown, with its opacity complete and its animations finished, or gone. The scene fails
when neither has happened and nothing is left that could still change the element: no finite
animation runs on the element or on an ancestor of it, and the paused clock holds no pending timer
and no frame callback. A timer or a frame callback that schedules itself again keeps the scene
running until the user who runs the harness stops it. The failure message contains the name of the
element.

A hover state is produced with a dispatched pointer event at computed coordinates, since the capture
sequence moves the real pointer away and would end a real hover.

A scene that saves a page checks the concrete unsaved and saved states. After an edit, the save and
discard actions are enabled and the real unsaved indication of the application is visible. The save
happens once. After it, the actions of the saved state are disabled and the unsaved indication is
gone. Each of these states is read from the screen and never set through the state store of the
application.

A component whose state would need a visible control to change is switched through a channel that
draws nothing, such as a fragment of the address or a parameter of the harness entry, which leaves
every control of the harness out of the picture. A component that picks a random value, such as a
rotating placeholder, receives a fixed real value from the entry.

Expected strings are read from the translation files of the application for the language of the
variant, where the scene has access to them. A string written by hand in a scene is written once per
interface language. Expected numbers and dates are formatted with the formatter of the platform in
the language of the variant.

A surface wider or taller than the viewport inside a scrolling container is captured region by
region, each region as a separate checkpoint, after a viewport checkpoint of the whole shell.

## Where scenes live

Tracked scenes are stored beside the harness code, one module per scene, and registered as described
in part 3. Exploratory scenes are stored in the harness directory inside the project cache, the
location defined by `workflow-skills:local-cache`, until they are promoted.

## Web realization in the reference

The reference wrote its types in TypeScript and checked each scene module with the `satisfies`
operator against the scene union. Targets were located with Playwright locators on `data-test`
attributes and with role and accessible name queries scoped to a container. Popovers were opened
with a dispatched click event and hover states with a dispatched pointer move. Transitions were
advanced with the frame steps of the page clock. Expected strings came from the JSON translation
files of the application, and expected numbers and dates from the `Intl` formatters of the browser.
A component entry drew one host element per real host, with the width and height of the host in CSS
pixels and its background, and one more host for each state of a request needed by the component.
A container-responsive panel was mounted in a wide host for its wide layout and in two narrow hosts,
one of them at the narrowest phone width, for its narrow layout.

## Native and terminal realizations

A native mobile scene is a test class written in the same language as the application. Its variant
is a device profile with a screen size in density-independent units, a density, a locale, a dark or
light mode and a font scale. Its container width is the width of a host view. Targets are found
through test tags, resource identifiers or accessibility identifiers, and through accessibility
labels scoped to a container. A desktop scene uses the object names and accessible names provided by
the toolkit the same way.

The variant of a terminal scene is a terminal size in columns and rows, a locale, a color scheme and
a color capability. The targets it checks are regions of the screen grid, found by anchoring on text
drawn by the application. Its checkpoints capture the whole screen or a rectangle of cells.
