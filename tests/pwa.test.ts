import { describe, expect, it } from 'vitest'
import fs from 'node:fs'

describe('PWA assets',()=>{
  it('manifest has installable identity and icons',()=>{const m=JSON.parse(fs.readFileSync('public/manifest.webmanifest','utf8'));expect(m.name).toBe('Gold Signal Pro');expect(m.display).toBe('standalone');expect(m.icons.length).toBeGreaterThanOrEqual(4)})
  it('service worker handles push clicks',()=>{const sw=fs.readFileSync('public/sw.js','utf8');expect(sw).toContain("addEventListener('push'");expect(sw).toContain("addEventListener('notificationclick'")})
})
