---
name: securing-access
description: Write code that grants access, handles identity, consent or secrets, or sets which data leaves system
---

- Fail closed. Deny all access to unknown, missing or malformed identity. Never reveal in refusal
  that something hidden from caller exists
- Check permission by exact identifier
- Never let a default open access or share an identity. Never ship default password, root shell or
  automatic login. Nor seed, UUID or key shared by two installations
- Leave value that must be chosen per installation without default
- Store security record, e.g. password hash or encrypted blob, with algorithm and parameters used
  to make it. Check parameters against minimums before trusting it
- Make secret impossible to print. Keep it in type whose printed and debug forms are redacted.
  Remove it from diagnostic that may contain it before shortening the diagnostic
- Never switch transport security off. Put private certificate authority into trust store instead
  of skipping verification
- Check authority and consent each with separate mechanism. Authority: whether this caller may
  access something. Consent: whether a person agreed to this act
- Never let consent grant authority. Never count authority as consent. Never let automatic approval
  grant access
- Choose what leaves a system by allowlist of fields
