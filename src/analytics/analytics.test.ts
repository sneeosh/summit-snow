import { describe, expect, it, vi } from 'vitest'
import { activeDelta, attribution, validateEvent } from './schema'
vi.mock('./client', () => ({ track: vi.fn() }))
import { track } from './client'
import { useStore } from '../state/store'

describe('campaign attribution', () => {
  it('prefers explicit tags and strips query strings from referrals', () => {
    expect(attribution('https://ski.kennyatx.com/?utm_source=LinkedIn&utm_campaign=launch&utm_content=clip-1', 'https://t.co/private?secret=yes')).toEqual({source:'linkedin',medium:'',campaign:'launch',content:'clip-1'})
    expect(attribution('https://ski.kennyatx.com', 'https://t.co/private?secret=yes').source).toBe('x')
    expect(attribution('https://ski.kennyatx.com', 'https://ski.kennyatx.com/?save=private').source).toBe('direct')
  })
})
it('rejects unknown events and unbounded time; discards extra fields', () => {
  const valid = {id:crypto.randomUUID(),player:crypto.randomUUID(),visit:crypto.randomUUID(),event:'page_view',day:0,seconds:0, secret:'do not store'}
  expect(validateEvent(valid)).not.toHaveProperty('secret')
  expect(validateEvent({...valid,event:'arbitrary'})).toBeNull()
  expect(validateEvent({...valid,event:'active_time',seconds:61})).toBeNull()
  expect(validateEvent({...valid,id:'bad'})).toBeNull()
})
it('excludes hidden/idle time and caps timer suspension gaps', () => {
  expect(activeDelta(10000,9000,9000,true)).toBe(1)
  expect(activeDelta(10000,9000,9000,false)).toBe(0)
  expect(activeDelta(100000,99000,1000,true)).toBe(0)
  expect(activeDelta(30000,0,30000,true)).toBe(5)
})
it('records actual game transitions, including fast-forward, without duplicate open/end events', () => {
  vi.mocked(track).mockClear()
  useStore.getState().startNew('scenario',123)
  useStore.getState().openResortNow()
  useStore.getState().openResortNow()
  useStore.getState().endDayNow()
  useStore.getState().endDayNow()
  expect(vi.mocked(track).mock.calls.map(c=>c[0])).toEqual(['new_game','resort_opened','day_completed'])
})
