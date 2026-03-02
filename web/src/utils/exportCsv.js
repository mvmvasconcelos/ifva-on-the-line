export function exportHistoryToCSV(history) {
    if (!history || history.length === 0) return;

    // Add BOM for better Excel support with UTF-8
    const BOM = '\uFEFF';
    const headers = ['Data/Hora', 'Tipo', 'Duração (Minutos)'];

    const rows = history.map(event => {
        const dateStr = new Date(event.timestamp).toLocaleString('pt-BR');
        const type = event.type;
        const duration = event.duration_minutes || '0 (Em andamento)';
        return [dateStr, type, duration];
    });

    const csvContent = BOM + [
        headers.join(','),
        ...rows.map(row => row.map(v => `"${v}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `historico_incidentes_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
