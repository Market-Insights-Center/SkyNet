const API_URL = 'http://localhost:8000/api';

/**
 * Tracks usage for a specific metric.
 * @param {string} metric - The metric key to increment (e.g., 'cultivate', 'assess', 'ml_forecast', 'briefing', 'fundamentals').
 */
export const trackUsage = async (metric) => {
    try {
        await fetch(`${API_URL}/usage/increment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ metric })
        });
    } catch (error) {
        console.error(`Failed to track usage for ${metric}:`, error);
        // Fail silently to not disrupt user experience
    }
};

/**
 * Fetches current usage stats.
 */
export const getUsageStats = async () => {
    try {
        const res = await fetch(`${API_URL}/usage`);
        if (!res.ok) throw new Error('Failed to fetch stats');
        return await res.json();
    } catch (error) {
        console.error("Failed to fetch usage stats:", error);
        return {};
    }
};
