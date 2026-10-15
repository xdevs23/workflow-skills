# C and C++

- Make ownership explicit. Free every allocation in exactly one place, which in C++ is an RAII type.
- Never let a raw pointer own memory, and never return from a function a pointer into its stack
  frame or into memory it has freed.
- Keep data that never changes in read-only memory, which on a microcontroller is program memory
  (`F()`, `PROGMEM`).
- Let debug output compile away entirely.
- Use macros only where the language can't do the job. Write minimum, maximum, constants and
  overloads by argument count as inline functions, `constexpr` and variadic templates.
- Keep control flow structured. Use `goto` only as the single forward jump to the cleanup at the end
  of a function, the way kernel C uses it, and never to build a loop or a call.
- Model a closed set of domain values as an `enum class` in C++ and an `enum` in C.
- Read text into a closed set with one function that returns nothing for text matching none of the
  values.
- Never cast unchecked input to the enum.
