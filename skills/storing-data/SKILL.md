---
name: storing-data
description: Read or write data store, change its schema, migrate data, change where data is kept, or delete or wipe data.
---

# Storing data

- Run every query against a data store in component that owns that collection or table, through
  the one place in project that runs queries. Create component for new collection or table in that
  place, shaped and named like components already there. Mapping, provider, worker or route
  requests data from that component. Only that component has a handle to the store, whatever a
  class elsewhere is called.
- Write field names of stored data only in component that owns the data. Another component passes
  typed values to it. Component that owns the data builds record from them.
- Write one change in single transaction of data store. Never spread across several calls to store
  in separate transactions.
- In update, write only what caller supplied. Update does not change field left out by caller.
- Never run network call inside database transaction.
- Read and write stored record as typed model, converted where it enters or leaves store. Never
  build or read stored record as dictionary literal or by looking up its keys.
- Correct wrong migration with forward migration.
- Let migration or backfill copy data into new shape. Leave old data as it is. Remove old data in
  separate, later step, and only when something truly needs deleting.
- Before changing where data is stored, e.g. mount, volume, replaced instance: check what data is
  there. Recover what the change would hide or destroy.
- Ship persistent storage in same change as feature that writes to it.
- Destroy something only after proof and explicit yes. Run formatting, wiping or replacing only on
  state positively proved by a check. Let inconclusive check block it.
- Ask for confirmation that lists exactly what will be destroyed. Never let default, flag or
  heuristic skip it.
- Use conditional database update where possible, instead of checking condition in program. Data
  can change after check and before write.
