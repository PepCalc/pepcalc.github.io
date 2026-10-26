import { describe, expect, it } from 'vitest'
import { detectPlatform } from '@/composables/useInstallPrompt'

describe('detectPlatform', () => {
  it('recognises iPhone and iPadOS (which reports a Mac user agent)', () => {
    expect(detectPlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', 5)).toBe('ios')
    expect(detectPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari', 5)).toBe('ios')
  })

  it('separates Firefox from Chromium on Android', () => {
    expect(
      detectPlatform('Mozilla/5.0 (Android 15; Mobile; rv:140.0) Gecko Firefox/140.0', 5),
    ).toBe('android-firefox')
    expect(detectPlatform('Mozilla/5.0 (Linux; Android 15) Chrome/140 Mobile', 5)).toBe(
      'android-chromium',
    )
  })

  it('treats a Mac without touch as desktop', () => {
    expect(detectPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0)).toBe('desktop')
  })
})
