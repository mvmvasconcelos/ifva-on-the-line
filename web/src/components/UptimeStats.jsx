// web/src/components/UptimeStats.jsx
import { useMemo } from 'react'
import { formatDurationVerbose } from '../utils/format'

export function UptimeStats({ history, lastSeen }) {
  const stats = useMemo(() => {
    if (!history || history.length === 0) {
      return {
        uptimePercent: 100,
        totalIncidents: 0,
        totalDowntimeMinutes: 0,
        avgIncidentDuration: 0,
        longestIncident: 0,
        shortestIncident: 0,
        currentMonthIncidents: 0
      }
    }

    const now = new Date()
    const currentMonth = now.getMonth()
    const currentYear = now.getFullYear()
    const startOfMonth = new Date(currentYear, currentMonth, 1)

    let totalDowntimeMinutes = 0
    let totalIncidents = 0
    let maxDuration = 0
    let minDuration = Infinity

    // Iterate over all incidents to properly account for ongoing ones from previous months
    history.forEach(event => {
      const eventStart = new Date(event.timestamp)
      let eventEnd = now
      let isOngoing = false

      if (!event.duration_minutes || event.duration_minutes === 0) {
        // Ongoing downtime
        isOngoing = true
      } else {
        eventEnd = new Date(eventStart.getTime() + event.duration_minutes * 60000)
      }

      // Check if incident overlaps with the current month
      if (eventEnd > startOfMonth && eventStart <= now) {
        // If it started in the current month, count as an incident for this month
        if (eventStart >= startOfMonth) {
          totalIncidents++;
        } else if (isOngoing) {
          // If it started before this month but is still ongoing, it's visibly impacting this month
          totalIncidents++;
        }

        // Calculate downtime overlap for current month
        const overlapStart = eventStart < startOfMonth ? startOfMonth : eventStart;
        const overlapEnd = eventEnd > now ? now : eventEnd;
        const overlapMinutes = (overlapEnd.getTime() - overlapStart.getTime()) / 60000;

        if (overlapMinutes > 0) {
          totalDowntimeMinutes += overlapMinutes;

          // Use real duration for min/max
          const actualDuration = event.duration_minutes || ((now - eventStart) / 60000);
          if (actualDuration > maxDuration) maxDuration = actualDuration;
          if (actualDuration < minDuration) minDuration = actualDuration;
        }
      }
    })

    if (minDuration === Infinity) minDuration = 0

    // Calculate uptime percentage for the month relative to elapsed time
    const minutesInMonth = (now.getTime() - startOfMonth.getTime()) / 60000;

    // Fallback if minutesInMonth is very small or negative (clock skew)
    let uptimePercent = 100;
    if (minutesInMonth > 0) {
      uptimePercent = ((minutesInMonth - totalDowntimeMinutes) / minutesInMonth) * 100
    }

    return {
      uptimePercent: Math.max(0, Math.min(100, uptimePercent)),
      totalIncidents,
      totalDowntimeMinutes,
      avgIncidentDuration: totalIncidents > 0 ? totalDowntimeMinutes / totalIncidents : 0,
      longestIncident: maxDuration,
      shortestIncident: minDuration,
      currentMonthIncidents: totalIncidents
    }
  }, [history])

  const getUptimeColor = (percent) => {
    if (percent >= 99.9) return 'text-green-600'
    if (percent >= 99) return 'text-blue-600'
    if (percent >= 95) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getUptimeBgColor = (percent) => {
    if (percent >= 99.9) return 'bg-green-50 border-green-200'
    if (percent >= 99) return 'bg-blue-50 border-blue-200'
    if (percent >= 95) return 'bg-yellow-50 border-yellow-200'
    return 'bg-red-50 border-red-200'
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
        <h3 className="text-lg font-semibold text-gray-900">📊 Estatísticas do Mês</h3>
      </div>

      <div className="p-6">
        {/* Uptime Percentage - Destaque */}
        <div className={`mb-6 p-6 rounded-lg border-2 ${getUptimeBgColor(stats.uptimePercent)}`}>
          <div className="text-center">
            <div className="text-sm font-medium text-gray-600 mb-2">Uptime Atual</div>
            <div className={`text-5xl font-bold ${getUptimeColor(stats.uptimePercent)}`}>
              {stats.uptimePercent.toFixed(3)}%
            </div>
            <div className="mt-2 text-xs text-gray-500">
              {stats.totalDowntimeMinutes > 0
                ? `${formatDurationVerbose(stats.totalDowntimeMinutes)} de downtime`
                : 'Nenhum downtime registrado'}
            </div>
          </div>
        </div>

        {/* Grid de Estatísticas */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-900">
              {stats.totalIncidents}
            </div>
            <div className="text-xs text-gray-600 mt-1">
              Incidentes
            </div>
          </div>

          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-900">
              {stats.avgIncidentDuration > 0 ? formatDurationVerbose(stats.avgIncidentDuration) : '--'}
            </div>
            <div className="text-xs text-gray-600 mt-1">
              Duração Média
            </div>
          </div>

          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-900">
              {stats.longestIncident > 0 ? formatDurationVerbose(stats.longestIncident) : '--'}
            </div>
            <div className="text-xs text-gray-600 mt-1">
              Maior Queda
            </div>
          </div>

          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-900">
              {stats.shortestIncident > 0 ? formatDurationVerbose(stats.shortestIncident) : '--'}
            </div>
            <div className="text-xs text-gray-600 mt-1">
              Menor Queda
            </div>
          </div>
        </div>

        {/* Barra de Progresso Visual */}
        <div className="mt-6">
          <div className="flex justify-between text-xs text-gray-600 mb-2">
            <span>Uptime</span>
            <span>Downtime</span>
          </div>
          <div className="w-full bg-red-100 rounded-full h-3 overflow-hidden">
            <div
              className="bg-green-500 h-3 rounded-full transition-all duration-500"
              style={{ width: `${stats.uptimePercent}%` }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  )
}
