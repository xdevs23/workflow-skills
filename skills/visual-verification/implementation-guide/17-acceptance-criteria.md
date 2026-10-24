# Part 17: acceptance criteria

Every run of an adoption gets the acceptance criteria among its sources of rules. The verification
of an adoption reports a separate verdict for every criterion, with evidence from artifacts and
measurements. A criterion that was not run is reported as not run, and "not run" never counts as
"pass".

## The criteria

1. The harness runs from one command and paints real content. From a source tree with committed
   locks, the documented command starts the application locally with the locked engine. It produces
   nonempty PNGs of real application content and a local HTML report. The run needs neither a
   backend nor credentials. A second clean rendering context gives zero changed pixels for the same
   synthetic scene and settings.

2. Component and page scenes render with full fidelity. The first component scene renders each of
   its modes with the real styling, locale and shipped font faces. The first page scene uses the
   real entry, route protection, state store, screen, section components and shell. The evidence
   includes the loaded font checks, the route, visible fixture text and contextual screenshots. The
   scenes do not replace a module or a store with a double and do not copy presentation.

3. The harness detects a known regression. The regression proof described below succeeds.

4. The initial scope is present. Every initial scene runs, and so does every named checkpoint in it.
   A diagnostic scene uses the real display model and screen context of the application. Its
   clipping and overlap measurements are reported as observed, without a fix to the product and
   without calling an observed defect acceptable.

5. Interactions are proven. Component interactions such as adding, editing and removing rows produce
   exactly the expected model values and leave the existing content unchanged. Page actions exercise
   the real unsaved, save and discard behavior, send exactly the intercepted narrow patch, and
   reload from the scripted saved response. A discard is checked to bring the screen back to the
   state before the edit. Scenes with fixture variants, such as an absent and a stored value, show
   exactly the expected selected choices. With an absent value, nothing is selected and the default
   does not appear. Selecting one choice leaves exactly that choice selected. The scene does not
   send a save request to a service.

6. Readiness is explicit. Captures wait until responses are consumed, the interface is in the
   correct state, the fonts are loaded, images are decoded where applicable and the geometry is
   stable. A long-held subscription is held on purpose and listed as held. A capture never passes
   because of an arbitrary sleep or a swallowed readiness timeout.

7. A missing response fails the run. Removing the response for the main record fails the run, and so
   does removing a shell response or a required help text entry, each independently. Each fails with
   the precise missing response or fixture key, even when the application normally catches the
   request error. A screenshot of such a run is never labeled successful. A local scene that leaves
   out one of the shell responses needed by the page fails at its first checkpoint, with that
   request in the message, although the application swallows the error of the read request. Omitted
   sample files fail before navigation. Incomplete refresh output cannot be selected.

8. Nothing escapes to an external system. Negative probes attempt an external image, a data
   request, a navigation, a frame and a socket, an unexpected local data request and a service
   worker registration or the equivalent background worker of the platform. External traffic and
   background workers cannot run. Every attempt at unexpected network use fails visibly. The
   verification checks that no request was forwarded and that the harness did not connect to any
   service. Synthetic rendering succeeds with an environment that does not contain credentials.

9. Fixture and schema drift fails. Wrong envelopes or types, a missing consumed field, inconsistent
   identifiers, an outdated projection version and an extra request each fail. Static fixture
   checks use the real types of the application. Validation reports list offline compatibility
   separately from unverified live compatibility.

10. The dependencies are frozen. Receipts identify both locks, the runtime, the engine and the
    loaded fonts. A lock mismatch stops the run before it executes, without rewriting any file or
    downloading a different engine. Runs of the regression proof use the same engine, dependencies
    and fonts. Incompatible receipts fail the comparison explicitly.

11. Comparison is useful and strict. Named matching checkpoints produce side-by-side PNGs,
    difference PNGs, changed-pixel counts and independent geometry and behavior verdicts. Missing
    checkpoints, different dimensions, different scene, data or settings, and changed pixels are
    all visible nonzero results. The harness never approves or overwrites automatically, never
    raises the tolerance silently, and does not load any external resource into a report.

12. Artifacts and sources are kept clean. Every generated artifact, temporary source export and
    engine profile is in the harness directory inside the project cache, the location defined by
    `workflow-skills:local-cache`. Only synthetic fixtures are tracked. Receipts include
    fingerprints of dirty and untracked relevant inputs, without machine paths or secrets. A source
    change during a run invalidates the capture. A negative run that changes an imported local
    fixture during execution fails with the message that the source or a fixture changed during the
    capture. The screenshots of that run are still evidence, but the run does not pass. Capture and
    comparison leave version control references, the index and application files unchanged,
    including translation files and existing tests.

13. Production behavior is preserved. Harness entries, fixtures and the engine and image libraries
    are absent from the production import graph and the production output. Production routes,
    start-up, styles and data behavior are unchanged. The verification runs the full check of the
    project bare and inspects the production artifact for included harness code.

14. Optional real samples are labeled truthfully and handled safely. Without credentials or a
    selection, the refresh fails with actionable instructions. Captures never start the refresh.
    With run-time credentials authorized separately, the verification checks:
    * that only selected read requests without side effects are sent;
    * the projection;
    * that redirects are not followed and that credentials are not logged;
    * that complete samples are published;
    * that a later replay works without credentials.

    Until that verification runs, the credentialed part is marked not run. Synthetic checks cannot
    satisfy it.

## The regression proof

The regression proof shows the harness catching a real rendering defect. It needs a pair of past
commits: one with a rendering defect expressible by a measured check, and the commit that fixed it.
The two commits have the same application dependency locks, because the comparison refuses captures
with different locks. The pair used in the reference also changed neither the application entry nor
the global stylesheet between the two commits.

The same current scene and fixture run against both commits, each exported separately from its
revision, with identical harness, engine and settings. The PNGs and measurements of both runs are
kept, also when the assertion on the defective commit fails. The defective commit fails the measured
check that expresses the defect, and the fixed commit passes it. The named checkpoint that shows the
defect has a nonzero pixel difference between the two commits, attributable to the fix. The
comparison of the pair is expected to report a difference and exit nonzero.

The proof is obtained honestly. Thresholds are never weakened to get it. Styles are never patched in
the engine, the defective component is never rewritten, and branches are never changed. The
revisions resolve locally. The working tree, the index and the branches are unchanged afterwards.
The proof does not include a patch to production code. When the chosen viewport does not expose the
defect, the real screen container is investigated and the scene is refined with measurements. A
proof is claimed only after both outcomes have been observed. The scene that produced the proof is
kept permanently. The changed counts recorded for each variant become a fixed expectation in the
fourth acceptance rule for the diff coloring in part 11.

A project without such a commit pair makes any deliberate visible change instead, on a commit that
is never merged, such as a changed padding, color or text in a component captured by a scene. The
project captures the scene on the base commit and on that commit and shows that the comparison
reports the change: a nonzero pixel difference in the checkpoints that draw the changed component,
and a failed measured check where the change breaks one. The unmerged commit has the same dependency
locks as the base commit, since it changes only the visible detail. The counts recorded for that
pair replace the historical counts in the acceptance rule for the coloring.

## Recorded verification

The harness contract in the project records which captures and runs verified each criterion and
what they showed. The capture names in that record are local evidence, never approved baselines.
The captures are left in the harness directory. The record includes the negative runs: the fixture
changed during a capture, the missing response of a local scene, the lock mismatch, and the network
probes of the self-test suite with the zero requests received by the trap.

The record also contains the lessons from failed attempts. In the reference, two captures of the
same scene first differed by a few hundred pixels in one checkpoint, because a running page clock
let a randomized blink of a closed widget land inside one capture. Pausing the clock removed that
source of difference, without masking a region. An observed product finding, such as a long value
overflowing the cell around it in a diagnostic scene, is recorded with its measurements. A passing
run of that scene does not approve the layout.

## Web realization in the reference

The reference ran the regression proof by capturing the first page scene twice with the source
revision option, once for each commit of a historical pair. In the defective commit, the container
of the controls in a row had not filled the row. The defective capture failed every row width
predicate in all three variants, and the fixed capture passed them. The checkpoint of the card
containing those rows differed by between one and two thousand pixels per variant. Both images and
the difference were inspected.

## Native and terminal realizations

The criteria apply unchanged to native and terminal interfaces, with the equivalents on the
platform: an emulator or simulator screen or an in-process renderer for the paint, the start-up and
navigation of the toolkit for fidelity, the background workers and sockets of the platform for the
escape probes, and the release package for production isolation. The regression proof uses exported
revisions built into separate application packages, or rendered by the in-process renderer from
each export.
