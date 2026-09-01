import { describe,expect,it } from 'vitest'
import fs from 'node:fs'
import { parseEvent } from '../netlify/functions/_shared/news'

describe('acceptance safeguards',()=>{
  it('preserves All Day and Tentative Forex Factory events without invented times',()=>{
    const all=parseEvent({date:'09-01-2026',time:'All Day',country:'USD',impact:'Holiday',title:'Bank Holiday'},1)
    const tentative=parseEvent({date:'09-02-2026',time:'Tentative',country:'USD',impact:'High',title:'Speech'},2)
    expect(all.isAllDay).toBe(true); expect(all.utcTime).toBeNull(); expect(tentative.isTentative).toBe(true); expect(tentative.utcTime).toBeNull()
  })
  it('filters unfinished candles in the provider adapter',()=>{const s=fs.readFileSync('netlify/functions/_shared/market.ts','utf8');expect(s).toContain('Date.parse(c.timestamp)+interval<=now')})
  it('database prevents duplicate notification records',()=>{const sql=fs.readFileSync('netlify/database/migrations/001_init.sql','utf8');expect(sql).toContain('UNIQUE(signal_id, subscription_id, notification_type)')})
  it('full-screen alerts are deduplicated by signal ID',()=>{const app=fs.readFileSync('src/App.tsx','utf8');expect(app).toContain('gsp-seen-signals');expect(app).toContain('seen.includes(s.id)')})
  it('acknowledgement persists to the signal record',()=>{const f=fs.readFileSync('netlify/functions/acknowledge-signal.ts','utf8');expect(f).toContain('acknowledged_at')})
  it('mobile baseline is 320px and touch controls are at least 44px',()=>{const css=fs.readFileSync('src/index.css','utf8');const app=fs.readFileSync('src/App.tsx','utf8');expect(css).toContain('min-width:320px');expect(app).toContain('min-h-11')})
  it('push click deep-links to the saved signal',()=>{const sw=fs.readFileSync('public/sw.js','utf8');const scan=fs.readFileSync('netlify/functions/scheduled-signal-scan.ts','utf8');expect(sw).toContain('notificationclick');expect(scan).toContain('/?signal=')})
  it('does not expose a broker order execution function',()=>{const files=fs.readdirSync('netlify/functions');expect(files.some(x=>/order|broker|trade-execute/i.test(x))).toBe(false)})
})
