// web/src/components/StatsGrid.jsx
import { Clock, Activity, WifiOff } from "lucide-react";
import { tempoRelativoVerbose, formatDateTimeShort } from "../utils/format";

export function StatsGrid({ history, lastSeen }) {
  const totalIncidents = history?.length || 0;

  const lastIncident = history && history.length > 0 ? history[0] : null;
  const timeSinceLastIncident = lastIncident
    ? tempoRelativoVerbose(lastIncident.timestamp)
    : "Nenhum registro";

  const cards = [
    {
      title: "Último Sinal Recebido",
      value: lastSeen ? new Date(lastSeen).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : "--:--",
      icon: <Clock className="w-5 h-5 text-blue-500" />,
      desc: (
        <>
          <span className="block mt-0.5">em {formatDateTimeShort(lastSeen)}</span>
          Atualizado a cada 5 min
          {lastSeen}
        </>
      )
    },
    {
      title: "Falhas Registradas",
      value: totalIncidents,
      icon: <WifiOff className="w-5 h-5 text-orange-500" />,
      desc: "Total no histórico"
    },
    {
      title: "Última Queda",
      value: timeSinceLastIncident,
      icon: <Activity className="w-5 h-5 text-purple-500" />,
      desc: "Desde o último evento"
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 my-8">
      {cards.map((card, idx) => (
        <div key={idx} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-gray-500 text-sm font-medium uppercase tracking-wide">{card.title}</h3>
            <div className="p-2 bg-gray-50 rounded-lg">
              {card.icon}
            </div>
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1">{card.value}</div>
          <div className="text-xs text-gray-400">{card.desc}</div>
        </div>
      ))}
    </div>
  );
}
