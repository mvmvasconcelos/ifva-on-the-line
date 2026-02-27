// web/src/App.jsx
import { StatusHeader } from './components/StatusHeader'
import { StatsGrid } from './components/StatsGrid'
import { IncidentsChart } from './components/IncidentsChart'
import { UptimeStats } from './components/UptimeStats'
import { HeartbeatMonitor } from './components/HeartbeatMonitor'
import { useStatus } from './hooks/useStatus'

function App() {
  const { data, loading, error } = useStatus()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50 text-red-600">
        Error: {error}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 text-gray-900 font-sans">
      <div className="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        
        {/* Header Section */}
        <StatusHeader status={data?.status} lastSeen={data?.last_seen} />

        {/* Two Column Layout for Key Metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
          {/* Heartbeat Monitor */}
          <HeartbeatMonitor lastSeen={data?.last_seen} status={data?.status} />
          
          {/* Uptime Stats */}
          <UptimeStats history={data?.history} lastSeen={data?.last_seen} />
        </div>

        {/* Stats Grid */}
        <StatsGrid history={data?.history} lastSeen={data?.last_seen} />

        {/* Chart Section */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-8">
          <IncidentsChart history={data?.history || []} />
        </div>

        {/* History Log Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
            <h3 className="tex-lg font-semibold text-gray-900">Histórico de Eventos</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data/Hora</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duração Aprox.</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data?.history?.length === 0 ? (
                  <tr>
                    <td colSpan="3" className="px-6 py-4 text-center text-sm text-gray-500">
                      Nenhum incidente registrado.
                    </td>
                  </tr>
                ) : (
                  data?.history?.slice(0, 10).map((event, idx) => (
                    <tr key={idx}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(event.timestamp).toLocaleString('pt-BR')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                          {event.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {event.duration_minutes > 0
                          ? `${Math.round(event.duration_minutes)} min`
                          : <span className="text-orange-400 italic">Em andamento...</span>
                        }
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
      
      <footer className="mt-12 text-center text-gray-400 text-sm pb-8">
        &copy; {new Date().getFullYear()} IFSul Venâncio Aires - Sistema de Monitoramento | Atualização automática a cada 30s
      </footer>
    </div>
  )
}

export default App
