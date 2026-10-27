# Go

- Assert at compile time that type conforms to interface: `var _ Message = (*Request)(nil)`.
- Wrap every error with what was being attempted:
  `fmt.Errorf("could not store the session: %w", err)`.
- Run storage operation inside one transaction closure: `db.Update(func(tx) error { … })`.
- Release resource in function that acquires it, with `defer` directly after error check of
  acquisition: `defer resp.Body.Close()`, or `defer c.Close()` for any `io.Closer`.
- Use `recover` only at boundary, e.g. request handler, top of goroutine or foreign interface.
  Never as the way library returns errors.
- Make sure deferred handler calling `recover` cannot panic itself.
- Put codecs behind small interfaces (`Encoder`, `Decoder`).
- Give each handler method separate typed request and response structs.
- Give method that changes its receiver a pointer receiver.
- Use generics and interfaces in place of switch over type names.
- Model closed set of domain values as struct type with one unexported field, its values as
  package variables, e.g. `type Outcome struct{ name string }` and
  `var OutcomeRun = Outcome{"run"}`. Code outside package then can neither make value nor pass
  bare string.
- Read text into closed set with one parse function returning error for text matching none of the
  values.
- Write value of closed set out as text through its `MarshalText` method, never as number.
