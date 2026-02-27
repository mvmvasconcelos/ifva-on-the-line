// web/src/components/StatusHeader.jsx
import { useMemo } from "react";
import { CheckCircle2, AlertTriangle, RefreshCw, Wifi, WifiOff } from "lucide-react";

export function StatusHeader({ status, lastSeen }) {
  // Calcula status real baseado no tempo desde o último heartbeat
  const isOnline = useMemo(() => {
    if (!lastSeen) return false;
    const now = new Date();
    const lastSeenDate = new Date(lastSeen);
    const minutesSince = (now - lastSeenDate) / (1000 * 60);
    const TIMEOUT_MINUTES = 7;
    return minutesSince < TIMEOUT_MINUTES;
  }, [lastSeen]);
  
  const statusColor = isOnline ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800";
  
  const formattedDate = lastSeen 
    ? new Date(lastSeen).toLocaleString('pt-BR') 
    : 'Desconhecido';

  return (
    <div className={`relative p-8 rounded-2xl shadow-lg border-2 ${isOnline ? 'border-green-300 bg-gradient-to-br from-green-50 to-green-100' : 'border-red-300 bg-gradient-to-br from-red-50 to-red-100'} flex flex-col md:flex-row items-center justify-between gap-6 transition-all duration-500 overflow-hidden`}>
      
      {/* Background Animation */}
      <div className={`absolute inset-0 ${isOnline ? 'bg-green-400' : 'bg-red-400'} opacity-5 ${isOnline ? 'animate-pulse' : ''}`}></div>
      
      <div className="relative flex items-center gap-4">
        <div className="relative">
          {isOnline ? (
            <Wifi className="w-12 h-12 text-green-600 animate-pulse" />
          ) : (
            <WifiOff className="w-12 h-12 text-red-600 animate-bounce" />
          )}
          <div className={`absolute -top-1 -right-1 w-4 h-4 ${isOnline ? 'bg-green-500' : 'bg-red-500'} rounded-full animate-ping`}></div>
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-3">
            IFSul Venâncio Aires
          </h1>
          <p className="text-gray-600 mt-1 font-medium">Sistema de Monitoramento de Conectividade</p>
        </div>
      </div>

      <div className="relative flex flex-col items-end text-right gap-3">
        <div className={`px-6 py-3 rounded-full font-bold uppercase tracking-wider text-sm flex items-center gap-3 ${statusColor} shadow-md transform transition-all hover:scale-105`}>
          <span className={`w-3 h-3 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-red-500 animate-ping'}`}></span>
          {isOnline ? "✅ OPERACIONAL" : "🚨 OFFLINE"}
        </div>
        <div className="text-sm text-gray-600 flex items-center gap-2 bg-white px-3 py-1.5 rounded-full shadow-sm">
          <RefreshCw className={`w-3.5 h-3.5 ${isOnline ? 'animate-spin-slow' : ''}`} />
          <span className="font-medium">{formattedDate}</span>
        </div>
      </div>
    </div>
  );
}
