import { useState, useEffect } from 'react';

// Using raw.githubusercontent.com with a cache-busting query parameter
// avoids the rigid 60 requests/hour limit of the unauthenticated GitHub API.
const getApiUrl = () => `https://raw.githubusercontent.com/mvmvasconcelos/ifva-on-the-line/main/data/status.json?t=${Date.now()}`;

export function useStatus() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch(getApiUrl(), {
          headers: {
            'Accept': 'application/json'
          },
          // Some browsers also respect cache directives:
          cache: 'no-store'
        });

        if (!response.ok) {
          throw new Error('Falha ao carregar dados de status: ' + response.status);
        }

        const jsonData = await response.json();

        setData(jsonData);
        setError(null);
      } catch (err) {
        console.error('Erro ao buscar status:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchData();

    // Poll every 30 seconds for more real-time updates
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  return { data, loading, error };
}
