---
name: storing-data
description: Storing application data correctly
---

- Run every query against data store in component owning that collection or table, through
  the one place in project that runs queries. Create component for new collection or table in that
  place, shaped, named like existing components. Mapping, provider, worker or route
  requests data from that component. Only that component has a handle to the store, whatever a
  class elsewhere is called
- Write field names of stored data only in component owning the data. Another component passes
  typed values to it. Component owning the data builds record from them
- Write one change in single transaction of data store. Don't spread across several calls to store
  in separate transactions
- In update, write only what caller supplied
- Don't run network call inside db transaction
- Read/write stored record as typed model, converted where enters/leaves store. No dictionary literal or key lookup
- Correct wrong migration with forward migration
- Let migration/backfill copy data into new shape. Old data stays. Remove old data in
  separate, later step, when need deletion
- Before changing where data stored (mount, volume, replaced instance): check what data is there
- Destroy something only after proof and explicit confirm. Run formatting, wiping, replacing only on
  state positively proved by check. Inconclusive check blocks
- UI asks for confirmation listing exactly what will be destroyed
- Use conditional db update where possible, instead of checking condition in program. Data
  can change after check and before write
