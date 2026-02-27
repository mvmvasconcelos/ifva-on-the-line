import { useState, useEffect } from 'react';

// Use GitHub API instead of raw.githubusercontent.com to avoid caching issues
const API_URL = 'https://api.github.com/repos/mvmvasconcelos/ifva-on-the-line/contents/data/status.json';

export function useStatus() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchData() {
      try {
        // GitHub API returns base64 encoded content without aggressive caching
        const response = await fetch(API_URL, {
          headers: {
            'Accept': 'application/vnd.github.v3+json',
            // Add cache control headers
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          }
        });
        
        if (!response.ok) {
          throw new Error('Falha ao carregar dados de status');
        }
        
        const apiData = await response.json();
        // Decode base64 content
        const decodedContent = atob(apiData.content);
        const jsonData = JSON.parse(decodedContent);
        
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
