---
name: securing-access
description: Write code that sets the access a caller gets, handles an identity, consent or a secret, or sets which data leaves a system.
---

# Securing access

- Fail closed. Deny all access to an unknown, missing or malformed identity, never give it the most
  powerful access, and never reveal in a refusal that something hidden from the caller exists.
- Check a permission by its exact identifier, never by a pattern or substring over text.
- Never let a default open access or share an identity. Never ship a default password, a root shell
  or an automatic login, or a seed, a UUID or a key shared by two installations.
- Leave a value that must be chosen per installation without a default.
- Store a security record, such as a password hash or an encrypted blob, with the algorithm and the
  parameters used to make it, and check the parameters against minimums before you trust it.
- Make a secret impossible to print. Keep it in a type whose printed and debug forms are redacted,
  and remove it from a diagnostic that may contain it before you shorten the diagnostic.
- Never switch transport security off. Keep certificate checks on, and put a private certificate
  authority into the trust store instead of skipping verification.
- Keep authority and consent apart, and check each with a separate mechanism. Authority is whether
  this caller may access something, and consent is whether a person agreed to this act.
- Never let consent grant authority, never count authority as consent, and never let an automatic
  approval grant access.
- Choose what leaves a system by an allowlist of fields, never by a denylist.
