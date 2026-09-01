import { describe, expect, it } from 'vitest'
import { DateTime } from 'luxon'

describe('Malaysia timezone conversion',()=>{
  it('converts New York DST time using timezone rules',()=>{const ny=DateTime.fromISO('2026-07-01T08:30:00',{zone:'America/New_York'});const my=ny.setZone('Asia/Kuala_Lumpur');expect(my.hour).toBe(20)})
  it('converts New York standard time using timezone rules',()=>{const ny=DateTime.fromISO('2026-01-01T08:30:00',{zone:'America/New_York'});const my=ny.setZone('Asia/Kuala_Lumpur');expect(my.hour).toBe(21)})
})
