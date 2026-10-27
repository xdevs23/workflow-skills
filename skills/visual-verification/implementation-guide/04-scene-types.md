# Scene types

Scene = typed module in same language as application, checked by same compiler or type checker.
Harness defines small set of types used by every scene. Those types = whole scene language. Scenes
call functions and interface of automation component directly. Harness does not build
domain-specific scene language, configuration format or plugin platform on top.

## The variant

Variant = one named combination of rendering settings. Contains name, window or viewport width and
height, interface locale, theme, optionally container width for component scenes. Scene may add
fixture parameter to variant, e.g. whether item has stored value or none. One scene then runs same
question against several states of fixture. Each variant name unique within scene.

Harness defines one shared set of variants. Scenes use it unless their question needs subset or
extension. Set used by reference had three variants: desktop size, primary language, light theme.
Same desktop size, second language, dark theme. Compact width, primary language, light theme.
Component scenes in reference added two narrow container widths at desktop size. These variants
probe only a few sizes, languages and themes. Contract describes them that way, never presents them
as complete coverage of responsive layouts or languages. Adaptation point: sizes, locales and themes
supported by project.

## The response fixture

Response fixture declares one expected request at data boundary and response to it. Contains stable
key, operation or method, path, exact query parameters, exact body for a write, response, policy,
optionally exact count and declared status.

Policy has one of three values. Once response: delivered exactly one time. Repeat response:
delivered to every matching request, for requests polled by shell. Held response: never delivered.
Request left open, as for long-held subscription, until explicit scene step releases it or teardown
cancels it.

Count = exact total number of deliveries across reloads declared by scene, for requests not polled.
Request made by screen once per load, in scene that reloads once: count of two.

Status defaults to success. Failing status marks request as meant to fail. Error output caused by
that failure no longer counts as capture failure, for that path alone. Scene fails when declared
failure does not happen. Every other error output, application error and request failure is still a
failure. Failing status on undeclared path never excused.

## The fixture set

Fixture set = complete data used when one variant runs. Contains version of projection from which it
was built, provenance, main records used to build screens in scene, list of response fixtures.
Provenance: synthetic for fixture written by hand, mixed-projected for set that combines projected
real sample with synthetic responses. Adaptation point: main record types, e.g. item edited on item
editor screen.

Reference reused one small family of fixtures across all scenes, extended per surface. Project does
same, never generates registry of fixtures as large as platform.

## The measurement

Measurement records one check: its predicate as readable sentence, whether it passed, actual
measured values, diagnostic flag. Required measurements determine verdict of capture. Diagnostic
measurements record product findings. Reported and stored in receipt. Failing diagnostic measurement
neither fails capture nor is marked acceptable. Harness never repairs product to make it pass.
Diagnostic scene that captured correctly still has to pass its execution, content and navigation
checks. When later approved change fixes finding, requirement agreed for it becomes required
measurement.

## The scene run context

Run context = object received by run function of scene. Contains automation handle for rendering
surface, current variant, fixture set, check function, capture function.

Check function records measurement with predicate, result, actual values, diagnostic flag.
Measurements attach to next checkpoint captured by scene. Run that records checks after its last
checkpoint fails, since those checks would not belong to any image.

Capture function expects checkpoint name, optionally target element. Runs capture sequence, writes
one PNG. Stored checkpoint name = variant name joined with checkpoint name. Duplicate checkpoint
name in one variant fails run.

Scene can also stop variant with hard assertion, for facts without which rest of scene proves
nothing, e.g. model value after edit. Failed assertion fails variant. Its message contains name of
next checkpoint in scene.

## The scene

Scene contains stable name, one-sentence purpose, version of projection behind fixtures used by it,
its variants, function from variant to its fixture set, its run function. One of two kinds, as union
type enforced by type checker.

Page scene contains function that maps fixture set to real route or screen to open. Starts
application through its real entry, with complete set of responses for every consumer on that screen
and in shell.

Component scene contains harness entry that mounts component. Entry mounts actual component with its
real parameters and model updates inside contextual container that surrounds it in application,
with same start-up, styles, translations, theme and shipped fonts as application. Component scene
may declare empty set of responses. Any request then fails scene.

## Component hosts

Component scene draws component in every real host where it appears, at literal width, height and
background of that host, including narrowest host used for it by application. Host = box around
component on real screen, e.g. side panel, popover, dialog, full-width phone view. Scene also draws
component in each state shown by it for requests needed by it, e.g. ready, loading, error.
Adaptation point: hosts of each component, with sizes and backgrounds.

Container-responsive component, which changes layout with its width: mounted in one host per layout,
at literal widths of real hosts where it appears. Every host rendered in every named variant. Each
layout appears in every language and theme of variant set.

Container widths of component scene describe component alone, do not replace evidence from page
layout. Geometry checks of component applied again in page scene that draws component inside real
screen where it appears. There, shell, neighbouring sections and real container determine how much
space component gets.

## Target selection

Targets found through existing test hooks of application where present, through scoped accessible
roles and names elsewhere. Selectors written in scene built for the question. Missing target fails.
Ambiguous target fails too. Scene never silently switches to different element. Selector never
asserts styling class as substitute for geometry measurement. Selection and toggle states read from
accessibility state of controls, e.g. checked attribute, the way assistive technology reads them.

Where test hook missing, scene finds target by its content or by its accessible name in language of
variant. Card found as innermost container that contains its known controls. Control without
accessible name found by its position within group whose other members are named. Text field found
by element type when another field with same role is on screen.

## Writing interactions

Each interaction waits for its observable outcome before next step: value appearing, control
becoming enabled or disabled, row count changing, dialog appearing.

Popover or menu that closes when focus leaves its control: opened with dispatched activation event
that does not move focus, since capture sequence clears focus. Where popover takes focus by itself,
scene prevents the one focus-leaving event caused by capture from getting to popover. Transitions
advanced by running frames of paused clock until element either fully shown (opacity complete,
animations finished) or gone. Scene fails when neither has happened and nothing is left that could
still change element: no finite animation runs on element or on ancestor of it, and paused clock
does not have any pending timer or frame callback. Timer or frame callback that schedules itself
again makes scene run until user who runs harness stops it. Failure message contains name of
element.

Hover state produced with dispatched pointer event at computed coordinates, since capture sequence
moves real pointer away and would end real hover.

Scene that saves page checks concrete unsaved and saved states. After edit: save and discard actions
enabled, real unsaved indication of application visible. Save happens once. After it: actions of
saved state disabled, unsaved indication gone. Each of these states read from screen, never set
through state store of application.

Component whose state would need visible control to change: switched through channel that draws
nothing, e.g. fragment of address or parameter of harness entry. Channel leaves every control of
harness out of picture. Component that picks random value, e.g. rotating placeholder, receives
fixed real value from entry.

Expected strings read from translation files of application for language of variant, where scene has
access to them. String written by hand in scene: written once per interface language. Expected
numbers and dates formatted with formatter of platform in language of variant.

Surface wider or taller than viewport inside scrolling container: captured region by region, each
region separate checkpoint, after viewport checkpoint of whole shell.

## Where scenes live

Tracked scenes stored beside harness code, one module per scene, registered in scene registry.
Exploratory scenes stored in harness directory inside project cache, location defined by
`workflow-skills:local-cache`, until promoted.

## Web realization in the reference

Reference wrote its types in TypeScript, checked each scene module with `satisfies` operator against
scene union. Targets located with Playwright locators on `data-test` attributes and with role and
accessible name queries scoped to container. Popovers opened with dispatched click event, hover
states with dispatched pointer move. Transitions advanced with frame steps of page clock. Expected
strings came from JSON translation files of application, expected numbers and dates from `Intl`
formatters of browser. Component entry drew one host element per real host, with width and height
of host in CSS pixels and its background, plus one more host for each state of a request needed by
component. Container-responsive panel mounted in wide host for its wide layout and in two narrow
hosts, one of them at narrowest phone width, for its narrow layout.

## Native and terminal realizations

Native mobile scene = test class in same language as application. Its variant: device profile with
screen size in density-independent units, density, locale, dark or light mode, font scale. Its
container width: width of host view. Targets found through test tags, resource identifiers or
accessibility identifiers, and through accessibility labels scoped to container. Desktop scene uses
object names and accessible names provided by toolkit same way.

Variant of terminal scene: terminal size in columns and rows, locale, color scheme, color
capability. Targets checked by it: regions of screen grid, found by anchoring on text drawn by
application. Its checkpoints capture whole screen or rectangle of cells.
