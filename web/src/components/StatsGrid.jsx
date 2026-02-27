// web/src/components/StatsGrid.jsx
import { Clock, Activity, WifiOff } from "lucide-react";

export function StatsGrid({ history, lastSeen }) {
  // Calculate specific metrics
  const totalIncidents = history?.length || 0;
  
  // Example metric: Time since last incident
  const lastIncident = history && history.length > 0 ? history[0] : null;
  let timeSinceLastIncident = "N/A";
  
  if (lastIncident) {
    const lastDate = new Date(lastIncident.timestamp);
    const now = new Date();
    const diffTime = Math.abs(now - lastDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    timeSinceLastIncident = `${diffDays} dias atrás`;
  } else {
    timeSinceLastIncident = "Nenhum registro";
  }

  // Uptime calculation (naive approximation based on history count vs total time could be complex, 
  // so let's stick to simple counts for now)

  const cards = [
    {
      title: "Último Sinal Recebido",
      value: lastSeen ? new Date(lastSeen).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'}) : "--:--",
      icon: <Clock className="w-5 h-5 text-blue-500" />,
      desc: "Autalizado a cada 5 min"
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
          <p className="text-xs text-gray-400">{card.desc}</p>
        </div>
      ))}
    </div>
  );
}
