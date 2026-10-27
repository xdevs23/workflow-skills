# C and C++

- Make ownership explicit. Free every allocation in exactly one place, in C++ an RAII type.
- Never let raw pointer own memory. Never return from function a pointer into its stack frame or
  into memory freed by it.
- Keep data that never changes in read-only memory. On microcontroller: program memory (`F()`,
  `PROGMEM`).
- Let debug output compile away entirely.
- Use macros only where language cannot do the job. Write minimum, maximum, constants and overloads
  by argument count as inline functions, `constexpr` and variadic templates.
- Keep control flow structured. Use `goto` only as single forward jump to cleanup at end of
  function, as kernel C uses it. Never to build loop or call.
- Model closed set of domain values as `enum class` in C++, `enum` in C.
- Read text into closed set with one function returning nothing for text matching none of the
  values.
- Never cast unchecked input to the enum.
