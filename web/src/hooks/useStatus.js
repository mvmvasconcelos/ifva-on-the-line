import { useState, useEffect } from 'react';

const DATA_URL = 'https://raw.githubusercontent.com/mvmvasconcelos/ifva-on-the-line/main/data/status.json';

export function useStatus() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchData() {
      try {
        // Add cache busting to prevent stale data
        const response = await fetch(`${DATA_URL}?t=${new Date().getTime()}`);
        if (!response.ok) {
          throw new Error('Falha ao carregar dados de status');
        }
        const jsonData = await response.json();
        setData(jsonData);
        setError(null);
      } catch (err) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchData();

    // Poll every 60 seconds to update the UI without refresh
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  return { data, loading, error };
}
