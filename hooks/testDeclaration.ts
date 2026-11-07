import { test as testOfKit } from 'claude-code/testing'
import type { Plugin, TestBody } from 'claude-code/testing'

/**
 * Declares a test that ends once the work it starts has settled, with the inline plugins `plugins`
 * loaded beside the plugin under test. The kit stops a test after five seconds unless told
 * otherwise. A test that uses `$` first loads the hooks module again, and on a busy machine that
 * load alone can pass five seconds.
 */
export function test(name: string, body: TestBody, plugins: readonly Plugin[] = []): void {
  testOfKit(name, { plugins, timeoutMs: Number.POSITIVE_INFINITY }, body)
}
