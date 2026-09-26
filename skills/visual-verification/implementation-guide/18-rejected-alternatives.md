# Part 18: rejected alternatives

The reference harness rejected each alternative below, and each rejection holds for any rendered
interface. An adoption spec that reaches for one of them contradicts this guide and needs the user's
decision before it is built.

## The alternatives and their reasons

Recreating the interface in plain HTML, screenshotting a mock, or measuring geometry in a simulated
document or widget tree was rejected. None of them exercises the real framework, the real layout and
the real font rendering, so none of them shows what a person sees.

Page scenes that replace the application's stores, navigation or data modules were rejected. They
bypass the real start-up, the real request shapes, the real authentication handling and the real
behavior of the shell. The data boundary is the only point where a page scene substitutes anything.

Using a live service during capture, or refreshing data automatically when a cache misses, was
rejected. Either makes a run depend on credentials, makes it unsafe, and makes it impossible to
repeat. Refreshing real data is a separate, explicit operation.

An engine already installed on the machine, an engine downloaded at run time, and fonts that are not
locked were rejected. With any of them, the before and after captures can differ for reasons that
have nothing to do with the interface.

Fixed sleeps, and readiness decided by a global network idle signal, were rejected. A sleep can
capture an unfinished screen, and an idle signal never arrives on an interface with polling reads
and held subscriptions. Captures wait for named observations.

Approving a change from screenshots alone, and asserting styling classes alone, were rejected.
Pixels need interpretation, and a class proves neither the available width nor a working
interaction. Scenes use rendered comparisons and measured behavior checks together.

Test-only fixes of widths, hidden icons and blanket masks were rejected. Each alters the subject
being measured and conceals the product defects the harness exists to show.

A generic scene language, a broad catalogue of the application, a component catalogue tool and a
full-stack test setup were rejected. Each adds machinery that the bounded questions of the scenes do
not need; typed modules and local response fixtures suffice.

A runtime dependency on another repository's harness was rejected. It prevents the project from
reproducing its own evidence independently. The project may learn from another harness, and keeps
its own copy of every mechanism it uses.

## Alternatives rejected in this guide

The guide itself rejects prescribing the reference's runtime, rendering engine, automation library
and image libraries: the components are examples, and the implementing model chooses what fits the
project. It rejects limiting the harness to interfaces that render in a browser, since the rules
hold for any rendered interface. It rejects shipping harness code with the plugin that carries this
guide, since each project implements its own harness from the guide.

## Web realization in the reference

The reference named its rejected alternatives in the same table form in its contract, among them
the simulated document tree its existing unit tests used and a component catalogue tool such as
Storybook. The harness it built in their place kept every artifact in its harness directory inside
the project cache, the location `workflow-skills:local-cache` defines.

## Native and terminal realizations

The same rejections apply under the platform's names. On a native platform, a render of a component
without the application's start-up, theme and shipped fonts is the mock of the first rejection; an
emulator image, simulator runtime or toolkit renderer that is not locked is the unlocked engine; a
screenshot test that passes within a tolerance is the raised tolerance that part 10 forbids; and a
fixed wait before the screenshot is the sleep. In a terminal, a fixed wait for the output to settle
is the sleep, and a terminal emulator or font that is not locked is the unlocked engine.
