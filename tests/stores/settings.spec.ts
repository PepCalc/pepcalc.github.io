import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { repository } from '@/db'
import { useSettingsStore } from '@/stores/settings'

describe('settings.acceptDisclaimer', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.restoreAllMocks()
  })

  it('marks the notice accepted only after the acceptance is saved', async () => {
    let finishWrite = () => {}
    vi.spyOn(repository, 'setSetting').mockReturnValue(
      new Promise<void>((resolve) => (finishWrite = resolve)),
    )
    const settings = useSettingsStore()
    const pending = settings.acceptDisclaimer('2026-10-29T12:00:00.000Z')
    expect(settings.disclaimerAcceptedAt).toBeNull()
    finishWrite()
    await pending
    expect(settings.disclaimerAcceptedAt).toBe('2026-10-29T12:00:00.000Z')
  })

  it('keeps the notice open when the save fails', async () => {
    vi.spyOn(repository, 'setSetting').mockRejectedValue(new Error('QuotaExceededError'))
    const settings = useSettingsStore()
    await expect(settings.acceptDisclaimer('2026-10-29T12:00:00.000Z')).rejects.toThrow()
    expect(settings.disclaimerAcceptedAt).toBeNull()
  })
})
