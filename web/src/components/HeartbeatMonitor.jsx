// web/src/components/HeartbeatMonitor.jsx
import { useMemo } from 'react'

export function HeartbeatMonitor({ lastSeen, status }) {
  const info = useMemo(() => {
    if (!lastSeen) {
      return {
        timeSince: 'Aguardando primeiro sinal...',
        nextExpected: null,
        health: 'unknown',
        pulseClass: ''
      }
    }

    const now = new Date()
    const lastSeenDate = new Date(lastSeen)
    const diffMs = now - lastSeenDate
    const diffMinutes = Math.floor(diffMs / 60000)
    const diffSeconds = Math.floor((diffMs % 60000) / 1000)

    let timeSince = ''
    if (diffMinutes > 0) {
      timeSince = `${diffMinutes} min ${diffSeconds}s atrás`
    } else {
      timeSince = `${diffSeconds}s atrás`
    }

    // Expected: every 5 minutes
    const nextExpectedMs = 5 * 60 * 1000 - diffMs
    const nextMinutes = Math.floor(nextExpectedMs / 60000)
    const nextSeconds = Math.floor((nextExpectedMs % 60000) / 1000)
    
    let nextExpected = null
    if (nextExpectedMs > 0) {
      if (nextMinutes > 0) {
        nextExpected = `em ~${nextMinutes} min ${nextSeconds}s`
      } else {
        nextExpected = `em ~${nextSeconds}s`
      }
    } else {
      nextExpected = 'Atrasado'
    }

    // Health indicator
    let health = 'healthy'
    let pulseClass = 'animate-pulse-slow'
    if (status === 'offline' || diffMinutes >= 7) {
      health = 'critical'
      pulseClass = 'animate-pulse-fast'
    } else if (diffMinutes >= 5) {
      health = 'warning'
      pulseClass = 'animate-pulse-medium'
    }

    return { timeSince, nextExpected, health, pulseClass }
  }, [lastSeen, status])

  const healthConfig = {
    healthy: {
      icon: '💚',
      text: 'Sistema Saudável',
      color: 'text-green-600',
      bg: 'bg-green-50',
      border: 'border-green-200',
      pulse: 'bg-green-400'
    },
    warning: {
      icon: '💛',
      text: 'Atenção',
      color: 'text-yellow-600',
      bg: 'bg-yellow-50',
      border: 'border-yellow-200',
      pulse: 'bg-yellow-400'
    },
    critical: {
      icon: '💔',
      text: 'Sistema Crítico',
      color: 'text-red-600',
      bg: 'bg-red-50',
      border: 'border-red-200',
      pulse: 'bg-red-400'
    },
    unknown: {
      icon: '⚪',
      text: 'Aguardando Dados',
      color: 'text-gray-600',
      bg: 'bg-gray-50',
      border: 'border-gray-200',
      pulse: 'bg-gray-400'
    }
  }

  const config = healthConfig[info.health]

  return (
    <div className={`bg-white rounded-xl shadow-sm border ${config.border} overflow-hidden`}>
      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
        <h3 className="text-lg font-semibold text-gray-900">💓 Monitor de Heartbeat</h3>
      </div>

      <div className="p-6">
        {/* Health Status */}
        <div className={`p-4 rounded-lg border-2 ${config.border} ${config.bg} mb-4`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <span className="text-3xl">{config.icon}</span>
                {info.health !== 'unknown' && (
                  <span className={`absolute top-0 right-0 w-3 h-3 ${config.pulse} rounded-full ${info.pulseClass}`}></span>
                )}
              </div>
              <div>
                <div className={`text-lg font-semibold ${config.color}`}>
                  {config.text}
                </div>
                <div className="text-sm text-gray-600">
                  Status atual do monitoramento
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Heartbeat Info */}
        <div className="space-y-3">
          <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
            <span className="text-sm font-medium text-gray-600">Último Heartbeat:</span>
            <span className="text-sm font-bold text-gray-900">{info.timeSince}</span>
          </div>

          {info.nextExpected && (
            <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
              <span className="text-sm font-medium text-gray-600">Próximo Esperado:</span>
              <span className="text-sm font-bold text-blue-700">{info.nextExpected}</span>
            </div>
          )}

          {lastSeen && (
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-xs text-gray-500 mb-1">Timestamp Completo:</div>
              <div className="text-xs font-mono text-gray-700">
                {new Date(lastSeen).toLocaleString('pt-BR', { 
                  dateStyle: 'short', 
                  timeStyle: 'medium' 
                })}
              </div>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="text-xs text-gray-500">
            <strong>Intervalo normal:</strong> Heartbeat a cada 5 minutos<br/>
            <strong>Timeout:</strong> Alerta após 7 minutos sem sinal
          </div>
        </div>
      </div>
    </div>
  )
}
