// web/src/components/StatusHeader.jsx
import { useMemo } from "react";
import { Wifi, WifiOff } from "lucide-react";

const CAUSE_LABELS = {
  externo:           { label: 'Problema externo (internet)',     color: 'bg-orange-100 text-orange-800' },
  interno:           { label: 'Problema interno',               color: 'bg-red-100 text-red-800' },
  interno_firewall:  { label: 'Problema interno (firewall)',     color: 'bg-red-100 text-red-800' },
  interno_servidor:  { label: 'Servidor sem resposta',          color: 'bg-red-100 text-red-800' },
  interno_misto:     { label: 'Problema interno (misto)',       color: 'bg-red-100 text-red-800' },
  unknown:           { label: 'Causa em investigação…',         color: 'bg-yellow-100 text-yellow-800' },
};

const UPLINK_LABELS = {
  lan:  { label: 'LAN',  color: 'bg-blue-100 text-blue-800' },
  wifi: { label: 'WiFi', color: 'bg-purple-100 text-purple-800' },
};

export function StatusHeader({ status, lastSeen, statusDetail, causeProvisional, activeUplink }) {
  // Calcula status real baseado no tempo desde o último heartbeat
  const minutesSinceLastSeen = useMemo(() => {
    if (!lastSeen) return Infinity;
    return (Date.now() - new Date(lastSeen).getTime()) / (1000 * 60);
  }, [lastSeen]);

  const isOnline = minutesSinceLastSeen < 30;
  const isDataStale = minutesSinceLastSeen > 120;

  const statusColor = isOnline ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800";

  const formattedDate = lastSeen
    ? new Date(lastSeen).toLocaleString('pt-BR')
    : 'Desconhecido';

  return (
    <>
    <div className={`relative p-8 rounded-2xl shadow-lg border-2 ${isOnline ? 'border-green-300 bg-gradient-to-br from-green-50 to-green-100' : 'border-red-300 bg-gradient-to-br from-red-50 to-red-100'} flex flex-col md:flex-row items-center justify-between gap-6 transition-all duration-500 overflow-hidden`}>

      <div className="relative flex items-center gap-4">
        <div className="relative">
          {isOnline ? (
            <Wifi className="w-12 h-12 text-green-600" />
          ) : (
            <WifiOff className="w-12 h-12 text-red-600" />
          )}
          <div className={`absolute -top-1 -right-1 w-4 h-4 ${isOnline ? 'bg-green-500' : 'bg-red-500'} rounded-full`}></div>
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
          <span className={`w-3 h-3 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`}></span>
          {isOnline ? "✅ OPERACIONAL" : statusDetail === 'offline_suspeito' ? '⚠️ SUSPEITO' : "🚨 OFFLINE"}
        </div>
        {!isOnline && causeProvisional && causeProvisional !== 'unknown' && (() => {
          const c = CAUSE_LABELS[causeProvisional] || CAUSE_LABELS.unknown;
          return (
            <span className={`text-xs font-semibold px-3 py-1 rounded-full ${c.color}`}>{c.label}</span>
          );
        })()}
        {!isOnline && (!causeProvisional || causeProvisional === 'unknown') && (
          <span className={`text-xs font-semibold px-3 py-1 rounded-full ${CAUSE_LABELS.unknown.color}`}>{CAUSE_LABELS.unknown.label}</span>
        )}
        {(activeUplink === 'lan' || activeUplink === 'wifi') && (() => {
          const u = UPLINK_LABELS[activeUplink];
          return (
            <span className={`text-xs font-semibold px-3 py-1 rounded-full ${u.color}`}>Uplink: {u.label}</span>
          );
        })()}
        {causeProvisional === 'interno_firewall' && activeUplink === 'wifi' && (
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-green-100 text-green-800">✅ confirmado vivo via WiFi</span>
        )}
        <div className="text-sm text-gray-600 flex items-center gap-2 bg-white px-3 py-1.5 rounded-full shadow-sm">
          <span className="font-medium">{formattedDate}</span>
        </div>
      </div>
    </div>
    {isDataStale && (
      <div className="mt-3 px-4 py-2.5 bg-yellow-50 border border-yellow-300 rounded-xl text-yellow-800 text-sm font-medium flex items-center gap-2">
        <span>⚠️</span>
        <span>Dados sem atualização há mais de {isFinite(minutesSinceLastSeen) ? `${Math.floor(minutesSinceLastSeen / 60)} h` : 'um longo período'}. O sistema de coleta pode estar inoperante.</span>
      </div>
    )}
    </>
  );
}
