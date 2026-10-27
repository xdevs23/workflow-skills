---
name: storing-data
description: Read or write a data store, change its schema, migrate data, change where data is kept, or delete or wipe data.
---

# Storing data

- Run every query against a data store in the component that owns that collection or table, through
  the one place in the project that runs queries. Create the component for a new collection or
  table in that place, shaped and named like the components already there. A mapping, a provider,
  a worker or a route requests the data from that component. Only that component has a handle to
  the store, whatever a class elsewhere is called.
- Write the field names of stored data only in the component that owns the data. Another component
  passes typed values to the component that owns the data, which builds the record from them.
- Write one change in a single transaction of the data store, never spread across several calls to
  the store in separate transactions.
- Write in an update only what the caller supplied. The update does not change a field left out by
  the caller.
- Never run a network call inside a database transaction.
- Read and write a stored record as a typed model, converted where it enters or leaves the store.
  Never build or read a stored record as a dictionary literal or by looking up its keys.
- Correct a wrong migration with a forward migration.
- Let a migration or backfill copy data into its new shape and leave the old data as it is. Remove
  the old data in a separate, later step, and only when something truly needs deleting.
- Before you change where data is stored, such as a mount, a volume or a replaced instance, check
  what data is there and recover what the change would hide or destroy.
- Ship persistent storage in the same change as the feature that writes to it.
- Destroy something only after proof and an explicit yes. Run formatting, wiping or replacing only
  on a state positively proved by a check, and let an inconclusive check block it.
- Ask for a confirmation that lists exactly what will be destroyed, and never let a default, a flag
  or a heuristic skip it.
- Use a conditional database update where possible instead of checking a condition in the program,
  since the data can change after the check and before it is written.
