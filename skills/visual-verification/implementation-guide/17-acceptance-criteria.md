# Part 17: acceptance criteria

These are the reference harness's acceptance criteria, generalized for any rendered interface. An
adoption spec cites them, and the verification of an adoption reports a separate verdict with
artifact and measurement evidence for every criterion. A criterion that was not run is reported as
not run; "not run" is never "pass".

## The criteria

1. One command and actual paint. From a source tree with committed locks, the documented command
   starts the application locally with the locked engine and produces nonempty PNGs of real
   application content and a local HTML report. No backend and no credentials are required. A
   second clean rendering context yields zero changed pixels for the same synthetic scene and
   settings.

2. Component and page fidelity. The first component scene renders each of its modes with the real
   styling, locale and shipped font faces. The first page scene uses the real entry, route
   protection, state store, screen, section components and shell. The evidence includes the loaded
   font checks, the route, visible fixture text and contextual screenshots, with no module or store
   doubles and no copied presentation.

3. Known regression detected. The regression proof below holds.

4. Initial scope present. Every initial scene and every one of its named checkpoints executes. A
   diagnostic scene uses the application's real display model and screen context, and its clipping
   and overlap measurements are reported as observed, without fixing the product and without calling
   an observed defect acceptable.

5. Interactions proven. Component interactions such as adding, editing and removing rows produce
   exactly the expected model values, with existing content unchanged as a side effect. Page actions
   exercise the real unsaved, save and discard behavior, send exactly the intercepted narrow patch,
   and reload from the scripted saved response. Scenes with fixture variants, such as an absent and
   a stored value, show exactly the expected selected choices. No save reaches a service.

6. Readiness is explicit. Captures wait for response consumption, the correct interface state,
   fonts, image decoding where applicable and stable geometry. A long-held subscription is
   deliberately held and listed as held. No arbitrary sleep and no swallowed readiness timeout
   produces a passing capture.

7. Missing-response failure. Removing the main record's response, and independently a shell
   response and a required help text entry, each fails with the precise missing response or fixture
   key, even when the application normally catches the request error. No screenshot of such a run is
   labeled successful. A local scene that serves a page without one of its shell responses fails at
   its first checkpoint naming that request, although the application swallows the read error.
   Omitted sample files fail before navigation, and incomplete refresh output cannot be selected.

8. No external escape. Negative probes attempt an external image, a data request, a navigation, a
   frame and a socket, an unexpected local data request and a service worker registration or the
   platform's equivalent background worker. External traffic and background workers cannot run,
   and every attempted unexpected network use fails visibly. The verification checks that no
   request was forwarded and no service connection happened. Synthetic rendering succeeds with an
   empty credential environment.

9. Fixture and schema drift fails. Wrong envelopes or types, a missing consumed field, inconsistent
   identifiers, an outdated projection version and an extra request each fail. Static fixture checks
   use the application's real types. Validation reports keep offline compatibility apart from
   unverified live compatibility.

10. Frozen dependencies. Receipts identify both locks, the runtime, the engine and the loaded fonts.
    A lock mismatch refuses execution without rewriting any file or downloading a different engine.
    Runs of the regression proof use the same engine, dependencies and fonts, and incompatible
    receipts fail the comparison explicitly.

11. Comparison is useful and strict. Named matching checkpoints produce side-by-side PNGs,
    difference PNGs, changed-pixel counts and independent geometry and behavior verdicts. Missing
    checkpoints, different dimensions, different scene, data or settings, and changed pixels are all
    visible nonzero results. No automatic approval, overwrite, silent tolerance increase or external
    report resource exists.

12. Artifact and source hygiene. Every generated artifact, temporary source export and engine
    profile is in the harness directory inside the project cache, the location
    `workflow-skills:local-cache` defines, and synthetic fixtures alone are tracked. Receipts
    include fingerprints of dirty and untracked relevant inputs, without machine paths or secrets. A
    source change during a run invalidates the capture: a negative run that changes an imported
    local fixture during execution fails with the message that the source or a fixture changed
    during the capture, and its screenshots remain evidence without passing. Capture and comparison
    leave version control references, the index and application files unchanged, including
    translation files and existing tests.

13. Production behavior preserved. Harness entries, fixtures and the engine and image libraries are
    absent from the production import graph and the production output. Production routes, start-up,
    styles and data behavior are unchanged. The verification runs the project's full check bare and
    inspects the production artifact for harness inclusion.

14. Optional real samples are honest and safe. Without credentials or a selection, the refresh fails
    with actionable instructions and captures never invoke it. With separately authorized run-time
    credentials, the verification checks only selected reads without side effects, the projection,
    that no redirect is followed and no credential is logged, complete sample publication, and later
    credential-free replay. Until that verification is performed, the credentialed part is marked
    not run; synthetic checks cannot satisfy it.

## The regression proof

The regression proof shows the harness catching a real rendering defect. It needs a pair of past
commits: one whose rendering had a defect that a measured check can express, and the commit that
fixed it. The two commits share the same application dependency locks, because the comparison
refuses captures whose locks differ; the reference's pair also changed neither the application entry
nor the global stylesheet between the two commits.

The same current scene and fixture run against both commits, each exported separately from its
revision, with identical harness, engine and settings. Both runs keep their PNGs and measurements,
also when the defective commit's assertion fails. The defective commit fails the measured check
that expresses the defect, the fixed commit passes it, and the named checkpoint that shows the
defect has a nonzero pixel difference between the two, attributable to the fix. The comparison of
the pair is expected to report a difference and exit nonzero.

The proof is obtained honestly. Thresholds are never weakened to get it, no styles are patched in
the engine, the defective component is never rewritten, and no branch is changed. The revisions
resolve locally, and the working tree, the index and the branches are unchanged afterwards. No
production code patch is part of the proof. When the chosen viewport does not expose the defect, the
real screen container is investigated and the scene refined with measurements; no proof is claimed
until both outcomes have been observed. The scene that produced the proof is kept permanently, and
its recorded changed counts per variant become a fixed expectation of the diff coloring's fourth
acceptance rule in part 11.

A project without such a commit pair makes any deliberate visible change instead, on a commit that
is never merged, such as a changed padding, color or text in a component a scene captures. It
captures the scene on the base commit and on that commit and shows that the comparison reports the
change: a nonzero pixel difference in the checkpoints that draw the changed component, and a failed
measured check where the change breaks one. The unmerged commit shares the base's dependency locks,
since it changes nothing but the visible detail. The recorded counts of that pair take the place of
the historical counts in the coloring's acceptance rule.

## Recorded verification

The project's harness contract records which captures and runs verified each criterion and what they
showed. Capture names in that record are local evidence, never approved baselines, and the captures
stay in the harness directory. The record includes the negative runs: the fixture changed during a
capture, the missing response of a local scene, the lock mismatch, and the network probes of the
self-test suite with the zero requests the trap received.

The record also keeps what a failed attempt taught. In the reference, two captures of the same scene
first differed by a few hundred pixels in one checkpoint, because a running page clock let a
randomized blink of a closed widget land inside one capture. The paused clock removed that source of
difference; no region was masked. An observed product finding, such as a long value overflowing its
cell in a diagnostic scene, is recorded with its measurements, and the passing execution of that
scene approves nothing about the layout.

## Web realization in the reference

The reference ran its regression proof by capturing its first page scene twice with the source
revision option, once per commit of a historical pair in which a row's controls container had not
filled its row. The defective capture failed every one of its row width predicates in all three
variants, the fixed capture passed them, and the checkpoint of the card holding those rows differed
by between one and two thousand pixels per variant. Both images and the difference were inspected.

## Native and terminal realizations

The criteria hold unchanged for native and terminal interfaces, with the platform's equivalents: an
emulator or simulator screen or an in-process renderer for the paint, the toolkit's own start-up and
navigation for fidelity, the platform's background workers and sockets for the escape probes, and
the release package for production isolation. The regression proof uses exported revisions built
into separate application packages, or rendered by the in-process renderer from each export.
