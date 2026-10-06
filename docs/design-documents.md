# Design documents are the writers' call

No prompt and no agent template of implement-review-verify orders a writer to write a design
document, and the marked block of its script names no documents directory. Whether a change needs a
design document is the call of the writer that makes the change, by the project's rules and the
plugin's skills.

## Rejected alternatives

**rejected-design-document-order**: An order in every writer's prompt and template to write or
extend a tracked design document by hand from the code, whenever its change altered the design, was
rejected. The order reached every writer of every run, so every unit got a document, whether or not
it needed one.
