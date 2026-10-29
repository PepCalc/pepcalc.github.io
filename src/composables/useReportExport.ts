import { reactive } from 'vue'
import { useShelfStore } from '@/stores/shelf'
import { useNotifyStore } from '@/stores/notify'
import type { ReportPeriod } from '@/domain/report'
import { collectReport } from '@/services/report/collectReport'
import { saveFile } from '@/services/fileTransfer'
import { fileDate, systemClock } from '@/services/time'

/**
 * Export the draws-and-levels PDF for a period. The PDF writer loads only when the user first
 * exports (it is precached like every chunk, so this works offline), the file is built on the
 * device, and it leaves only through the share sheet or a download the user starts.
 */
export function useReportExport() {
  const shelf = useShelfStore()
  const notify = useNotifyStore()
  const state = reactive({ busy: false })

  async function exportReport(period: ReportPeriod): Promise<boolean> {
    state.busy = true
    try {
      const now = systemClock().getTime()
      const data = collectReport({
        vials: shelf.vials,
        draws: shelf.draws,
        groups: shelf.levelGroups,
        vialName: shelf.displayName,
        period,
        now,
        locale: navigator.language,
      })
      const { renderLevelsReport } = await import('@/services/report/levelsReport')
      const pdf = new Blob([renderLevelsReport(data)], { type: 'application/pdf' })
      const result = await saveFile(`pepcalc-report-${fileDate(now)}.pdf`, pdf)
      if (result === 'downloaded') notify.show('Report saved to your downloads.', 'success')
      return result !== 'cancelled'
    } catch {
      notify.show('Could not make the report on this device.', 'error')
      return false
    } finally {
      state.busy = false
    }
  }

  return { state, actions: { exportReport } }
}
