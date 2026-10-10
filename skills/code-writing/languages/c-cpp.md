# C and C++

- Make ownership explicit: every allocation has exactly one place that frees it, and in C++ that
  place is an RAII type. A raw pointer never owns memory, and no function returns a pointer into its
  own stack frame or into memory it has freed.
- Keep data that never changes in read-only memory, which on a microcontroller means program memory
  (`F()`, `PROGMEM`).
- Let debug output compile away entirely.
- Use macros only where the language can't do the job: minimum, maximum, constants and
  argument-count overloads are inline functions, `constexpr` and variadic templates.
- Keep control flow structured. Use `goto` only as the single forward jump to a function's cleanup,
  the way kernel C uses it, and never to build a loop or a call.
- Model a closed set of domain values as an `enum class` in C++ and an `enum` in C.
- Read text into a closed set with one function that returns no value for text naming none, and
  never cast unchecked input to the enum.
