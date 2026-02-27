// web/src/components/StatusHeader.jsx
import { CheckCircle2, AlertTriangle, RefreshCw } from "lucide-react";

export function StatusHeader({ status, lastSeen }) {
  const isOnline = status === "online";
  const statusColor = isOnline ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800";
  const icon = isOnline ? <CheckCircle2 className="w-12 h-12 text-green-600" /> : <AlertTriangle className="w-12 h-12 text-red-600" />;

  const formattedDate = lastSeen 
    ? new Date(lastSeen).toLocaleString('pt-BR') 
    : 'Desconhecido';

  return (
    <div className={`p-8 rounded-2xl shadow-sm border ${isOnline ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'} flex flex-col md:flex-row items-center justify-between gap-6 transition-all duration-500`}>
      <div className="flex items-center gap-4">
        {icon}
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            IFSul Venâncio Aires
          </h1>
          <p className="text-gray-500 mt-1">Status do sistema de monitoramento</p>
        </div>
      </div>

      <div className="flex flex-col items-end text-right">
        <div className={`px-4 py-2 rounded-full font-bold uppercase tracking-wider text-sm flex items-center gap-2 ${statusColor}`}>
          <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
          {isOnline ? "OPERACIONAL" : "OFFLINE"}
        </div>
        <div className="mt-3 text-sm text-gray-500 flex items-center gap-1">
          <RefreshCw className="w-3 h-3" />
          Última atualização: {formattedDate}
        </div>
      </div>
    </div>
  );
}
