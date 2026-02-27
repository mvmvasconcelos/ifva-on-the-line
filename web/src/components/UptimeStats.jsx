// web/src/components/UptimeStats.jsx
import { useMemo } from 'react'

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

    // Filter incidents from current month
    const monthIncidents = history.filter(event => {
      const eventDate = new Date(event.timestamp)
      return eventDate.getMonth() === currentMonth && 
             eventDate.getFullYear() === currentYear
    })

    const totalIncidents = monthIncidents.length
    const durations = monthIncidents
      .map(e => e.duration_minutes || 0)
      .filter(d => d > 0)
    
    const totalDowntimeMinutes = durations.reduce((sum, d) => sum + d, 0)
    const avgIncidentDuration = durations.length > 0 
      ? totalDowntimeMinutes / durations.length 
      : 0
    
    const longestIncident = durations.length > 0 ? Math.max(...durations) : 0
    const shortestIncident = durations.length > 0 ? Math.min(...durations) : 0

    // Calculate uptime percentage for the month
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
    const minutesInMonth = daysInMonth * 24 * 60
    const uptimePercent = ((minutesInMonth - totalDowntimeMinutes) / minutesInMonth) * 100

    return {
      uptimePercent: Math.max(0, Math.min(100, uptimePercent)),
      totalIncidents,
      totalDowntimeMinutes,
      avgIncidentDuration,
      longestIncident,
      shortestIncident,
      currentMonthIncidents: totalIncidents
    }
  }, [history])

  const formatDuration = (minutes) => {
    if (minutes < 60) {
      return `${Math.round(minutes)} min`
    }
    const hours = Math.floor(minutes / 60)
    const mins = Math.round(minutes % 60)
    return `${hours}h ${mins}min`
  }

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
                ? `${formatDuration(stats.totalDowntimeMinutes)} de downtime`
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
              {stats.avgIncidentDuration > 0 ? formatDuration(stats.avgIncidentDuration) : '--'}
            </div>
            <div className="text-xs text-gray-600 mt-1">
              Duração Média
            </div>
          </div>

          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-900">
              {stats.longestIncident > 0 ? formatDuration(stats.longestIncident) : '--'}
            </div>
            <div className="text-xs text-gray-600 mt-1">
              Maior Queda
            </div>
          </div>

          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-900">
              {stats.shortestIncident > 0 ? formatDuration(stats.shortestIncident) : '--'}
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
