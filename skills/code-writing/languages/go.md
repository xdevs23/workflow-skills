# Go

- Assert at compile time that a type conforms to an interface: `var _ Message = (*Request)(nil)`.
- Wrap every error with what was being attempted:
  `fmt.Errorf("could not store the session: %w", err)`.
- Run a storage operation inside one transaction closure: `db.Update(func(tx) error { … })`.
- Release a resource in the function that acquires it, with a `defer` directly after the error check
  of the acquisition: `defer resp.Body.Close()`, or `defer c.Close()` for any `io.Closer`.
- Use `recover` only at a boundary, such as a request handler, the top of a goroutine or a foreign
  interface, never as the way a library returns errors.
- Make sure the deferred handler that calls `recover` can't panic itself.
- Put codecs behind small interfaces (`Encoder`, `Decoder`).
- Give each handler method separate typed request and response structs.
- Give a method that changes its receiver a pointer receiver.
- Use generics and interfaces in place of a switch over type names.
- Model a closed set of domain values as a struct type with one unexported field and its values as
  package variables, such as `type Outcome struct{ name string }` and
  `var OutcomeRun = Outcome{"run"}`, so code outside the package can neither make a value nor pass
  a bare string.
- Read text into a closed set with one parse function that returns an error for text matching none
  of the values.
- Write a value of a closed set out as text through its `MarshalText` method, never as a number.
