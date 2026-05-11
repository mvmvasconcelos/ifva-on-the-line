import { useState, useEffect } from 'react';

const BASE = 'https://raw.githubusercontent.com/mvmvasconcelos/ifva-on-the-line/main';
const statusUrl  = () => `${BASE}/data/status.json?t=${Date.now()}`;
const incidentsUrl = () => `${BASE}/data/incidents.json?t=${Date.now()}`;

async function fetchJson(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status} em ${url}`);
  return res.json();
}

export function useStatus() {
  const [data, setData] = useState(null);
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [statusData, incidentData] = await Promise.all([
          fetchJson(statusUrl()),
          fetchJson(incidentsUrl()).catch(() => ({ incidents: [] })),
        ]);
        setData(statusData);
        setIncidents(Array.isArray(incidentData?.incidents) ? incidentData.incidents : []);
        setError(null);
      } catch (err) {
        console.error('Erro ao buscar status:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  return { data, incidents, loading, error };
}
