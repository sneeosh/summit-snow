/**
 * The HUD wrapper is pointer-events-none so the map stays interactive under
 * floating panels — which means every full-screen overlay with a z-index
 * MUST opt back in with pointer-events-auto (or declare none on purpose).
 * The day-end report once forgot, and every player soft-locked at day 1.
 * This scan makes that class of bug a test failure instead of a bug report.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const COMPONENT_DIRS = ['src/components', 'src']

function classStrings(source: string): string[] {
  // static class lists only — template literals get their static parts scanned too
  return [...source.matchAll(/className=\{?["'`]([^"'`]+)["'`]/g)].map((m) => m[1])
}

describe('HUD overlay invariants', () => {
  it('every absolute inset-0 overlay with a z-index declares its pointer-events', () => {
    const violations: string[] = []
    for (const dir of COMPONENT_DIRS) {
      for (const file of readdirSync(dir)) {
        if (!file.endsWith('.tsx')) continue
        const source = readFileSync(join(dir, file), 'utf8')
        for (const cls of classStrings(source)) {
          const fullScreen = /\babsolute\b/.test(cls) && /\binset-0\b/.test(cls)
          const layered = /\bz-\d/.test(cls) || /\bz-\[/.test(cls)
          const declared = /\bpointer-events-(auto|none)\b/.test(cls)
          if (fullScreen && layered && !declared) {
            violations.push(`${file}: "${cls.slice(0, 80)}…" needs pointer-events-auto (clickable) or -none (pass-through)`)
          }
        }
      }
    }
    expect(violations).toEqual([])
  })
})
