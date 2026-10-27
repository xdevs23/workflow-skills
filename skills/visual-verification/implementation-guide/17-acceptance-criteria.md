# Acceptance criteria

Every run of an adoption gets acceptance criteria among its sources of rules. Verification of
adoption reports separate verdict for every criterion, with evidence from artifacts and
measurements. Criterion not run reported as not run. "Not run" never counts as "pass".

## The criteria

1. Harness runs from one command, paints real content. From source tree with committed locks,
   documented command starts application locally with locked engine. Produces nonempty PNGs of real
   application content and local HTML report. Run needs neither backend nor credentials. Second
   clean rendering context gives zero changed pixels for same synthetic scene and settings.

2. Component and page scenes render with full fidelity. First component scene renders each of its
   modes with real styling, locale and shipped font faces. First page scene uses real entry, route
   protection, state store, screen, section components and shell. Evidence includes loaded font
   checks, route, visible fixture text, contextual screenshots. Scenes do not replace module or
   store with a double, do not copy presentation.

3. Harness detects a known regression. Regression proof described below succeeds.

4. Initial scope present. Every initial scene runs, and every named checkpoint in it. Diagnostic
   scene uses real display model and screen context of application. Its clipping and overlap
   measurements reported as observed, without fix to product and without calling observed defect
   acceptable.

5. Interactions proven. Component interactions such as adding, editing and removing rows produce
   exactly expected model values, leave existing content unchanged. Page actions exercise real
   unsaved, save and discard behavior, send exactly intercepted narrow patch, reload from scripted
   saved response. Discard checked to bring screen back to state before edit. Scenes with fixture
   variants, such as absent and stored value, show exactly expected selected choices. With absent
   value, nothing selected, default does not appear. Selecting one choice leaves exactly that choice
   selected. Scene does not send save request to a service.

6. Readiness explicit. Captures wait until responses consumed, interface in correct state, fonts
   loaded, images decoded where applicable, geometry stable. Long-held subscription held on purpose
   and listed as held. Capture never passes because of arbitrary sleep or swallowed readiness
   timeout.

7. Missing response fails run. Removing response for main record fails run, and so does removing
   shell response or required help text entry, each independently. Each fails with precise missing
   response or fixture key, even when application normally catches request error. Screenshot of such
   run never labeled successful. Local scene leaving out one of shell responses needed by page fails
   at its first checkpoint, with that request in message, although application swallows error of
   read request. Omitted sample files fail before navigation. Incomplete refresh output cannot be
   selected.

8. Nothing escapes to external system. Negative probes attempt external image, data request,
   navigation, frame and socket, unexpected local data request, and service worker registration or
   equivalent background worker of platform. External traffic and background workers cannot run.
   Every attempt at unexpected network use fails visibly. Verification checks that harness did not
   forward any request and did not connect to any service. Synthetic rendering succeeds with
   environment that does not contain any credentials.

9. Fixture and schema drift fails. Wrong envelopes or types, missing consumed field, inconsistent
   identifiers, outdated projection version and extra request each fail. Static fixture checks use
   real types of application. Validation reports list offline compatibility separately from
   unverified live compatibility.

10. Dependencies frozen. Receipts identify both locks, runtime, engine and loaded fonts. Lock
    mismatch stops run before it executes, without rewriting any file or downloading different
    engine. Runs of regression proof use same engine, dependencies and fonts. Incompatible receipts
    fail comparison explicitly.

11. Comparison useful and strict. Named matching checkpoints produce side-by-side PNGs, difference
    PNGs, changed-pixel counts, independent geometry and behavior verdicts. Missing checkpoints,
    different dimensions, different scene, data or settings, and changed pixels: all visible nonzero
    results. Harness never approves or overwrites automatically, never raises tolerance silently,
    does not load any external resource into report.

12. Artifacts and sources kept clean. Every generated artifact, temporary source export and engine
    profile in harness directory inside project cache, location defined by
    `workflow-skills:local-cache`. Only synthetic fixtures tracked. Receipts include fingerprints of
    dirty and untracked relevant inputs, without machine paths or secrets. Source change during run
    invalidates capture. Negative run that changes imported local fixture during execution fails
    with message that source or a fixture changed during capture. Screenshots of that run are still
    evidence, but run does not pass. Capture and comparison leave version control references, index
    and application files unchanged, including translation files and existing tests.

13. Production behavior preserved. Harness entries, fixtures, engine and image libraries absent from
    production import graph and production output. Production routes, start-up, styles and data
    behavior unchanged. Verification runs full check of project bare, inspects production artifact
    for included harness code.

14. Optional real samples labeled truthfully, handled safely. Without credentials or selection,
    refresh fails with actionable instructions. Captures never start refresh. With run-time
    credentials authorized separately, verification checks:
    * that only selected read requests without side effects were sent;
    * projection;
    * that redirects were not followed and credentials were not logged;
    * that complete samples were published;
    * that later replay works without credentials.

    Until that verification runs, credentialed part marked not run. Synthetic checks cannot satisfy
    it.

## The regression proof

Regression proof shows harness catching real rendering defect. Needs pair of past commits: one with
rendering defect expressible by measured check, and commit that fixed it. Both commits have same
application dependency locks, because comparison rejects captures with different locks. Pair used in
reference also changed neither application entry nor global stylesheet between the two commits.

Same current scene and fixture run against both commits, each exported separately from its revision,
with identical harness, engine and settings. PNGs and measurements of both runs kept, also when
assertion on defective commit fails. Defective commit fails measured check that expresses defect.
Fixed commit passes it. Named checkpoint showing defect has nonzero pixel difference between the two
commits, attributable to fix. Comparison of pair expected to report difference and exit nonzero.

Proof obtained honestly. Thresholds never weakened to get it. Styles never patched in engine,
defective component never rewritten, branches never changed. Revisions resolve locally. Working
tree, index and branches unchanged afterwards. Proof does not include patch to production code. When
chosen viewport does not expose defect, real screen container investigated, scene refined with
measurements. Proof claimed only after both outcomes observed. Scene that produced proof kept
permanently. Changed counts recorded for each variant become fixed expectation in fourth acceptance
rule for diff coloring.

Project without such commit pair makes any deliberate visible change instead, on commit that is
never merged, e.g. changed padding, color or text in component captured by a scene. Project captures
scene on base commit and on that commit, shows comparison reports change: nonzero pixel difference
in checkpoints that draw changed component, and failed measured check where change breaks one.
Unmerged commit has same dependency locks as base commit, since it changes only visible detail.
Counts recorded for that pair replace historical counts in acceptance rule for coloring.

## Recorded verification

Harness contract in project records which captures and runs verified each criterion and what they
showed. Capture names in that record: local evidence, never approved baselines. Captures left in
harness directory. Record includes negative runs: fixture changed during capture, missing response
of local scene, lock mismatch, network probes of self-test suite with zero requests received by
trap.

Record also contains lessons from failed attempts. In reference, two captures of same scene first
differed by a few hundred pixels in one checkpoint, because running page clock let randomized blink
of closed widget land inside one capture. Pausing clock removed that source of difference, without
masking a region. Observed product finding, e.g. long value overflowing cell around it in diagnostic
scene, recorded with its measurements. Passing run of that scene does not approve layout.

## Web realization in the reference

Reference ran regression proof by capturing first page scene twice with source revision option, once
for each commit of historical pair. In defective commit, container of controls in a row had not
filled row. Defective capture failed every row width predicate in all three variants. Fixed capture
passed them. Checkpoint of card containing those rows differed by between one and two thousand
pixels per variant. Both images and difference inspected.

## Native and terminal realizations

Criteria apply unchanged to native and terminal interfaces, with equivalents on platform: emulator
or simulator screen or in-process renderer for paint, start-up and navigation of toolkit for
fidelity, background workers and sockets of platform for escape probes, release package for
production isolation. Regression proof uses exported revisions built into separate application
packages, or rendered by in-process renderer from each export.
