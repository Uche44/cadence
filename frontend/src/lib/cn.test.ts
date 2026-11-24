import { describe, expect, it } from 'vitest'

import { cn } from './cn'

describe('cn', () => {
  it('joins conditional classes', () => {
    const hidden: boolean = false

    expect(cn('p-4', hidden && 'hidden', undefined, 'gap-2')).toBe('p-4 gap-2')
  })

  it('keeps a type size and a text colour together', () => {
    const result = cn('text-label-lg', 'text-on-ink')

    expect(result).toContain('text-label-lg')
    expect(result).toContain('text-on-ink')
  })

  it('keeps a type size and a heading colour together', () => {
    const result = cn('text-headline-lg', 'text-ink-heading')

    expect(result).toContain('text-headline-lg')
    expect(result).toContain('text-ink-heading')
  })

  it('resolves two text colours to the last one', () => {
    expect(cn('text-ink', 'text-on-ink')).toBe('text-on-ink')
  })

  it('resolves two type sizes to the last one', () => {
    expect(cn('text-body-md', 'text-headline-lg')).toBe('text-headline-lg')
  })

  it('resolves two backgrounds to the last one', () => {
    expect(cn('bg-canvas', 'bg-surface')).toBe('bg-surface')
  })

  it('keeps a background and a shadow', () => {
    expect(cn('bg-surface', 'shadow-card')).toBe('bg-surface shadow-card')
  })
})
