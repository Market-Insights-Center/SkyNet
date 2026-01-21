import React from 'react';
import {
    ComposedChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceDot,
    Area
} from 'recharts';

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        const dateStr = new Date(label).toLocaleDateString([], {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });

        return (
            <div className="bg-black/80 border border-blue-500/30 p-3 rounded-lg backdrop-blur-md shadow-xl">
                <p className="text-gray-400 text-xs mb-2">{dateStr}</p>
                {payload.map((entry, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm font-medium">
                        <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: entry.color }}
                        />
                        <span style={{ color: entry.color }}>{entry.name}:</span>
                        <span className="text-white">
                            ${Number(entry.value).toFixed(2)}
                        </span>
                    </div>
                ))}
            </div>
        );
    }
    return null;
};

const MLForecastChart = ({ historicalData, forecastData, anchors }) => {
    // Merge data for the chart
    // historicalData: [{date, price}]
    // forecastData: [{date, price}] (path)
    // anchors: [{date, price, label}] (key forecast targets)

    // Create a Set of anchor dates for quick lookup
    const anchorDateSet = new Set(anchors.map(a => a.date));

    // Combine into one array for Recharts
    // We need to ensure anchor points are in the data for ReferenceDot to work
    const forecastWithAnchors = [...forecastData];

    // Add anchor points to forecast data if they're not already present
    anchors.forEach(anchor => {
        const exists = forecastData.some(d => d.date === anchor.date);
        if (!exists) {
            forecastWithAnchors.push({ date: anchor.date, price: anchor.price });
        }
    });

    // Sort by date
    forecastWithAnchors.sort((a, b) => new Date(a.date) - new Date(b.date));

    const chartData = [
        ...historicalData.map(d => ({
            date: d.date,
            historicalPrice: d.price,
            forecastPrice: null
        })),
        ...forecastWithAnchors.map(d => ({
            date: d.date,
            historicalPrice: null,
            forecastPrice: d.price
        }))
    ];

    // Custom Dot for Anchors
    const renderAnchorDot = (props) => {
        const { cx, cy, payload } = props;
        // We need to match payload date with anchors
        const anchor = anchors.find(a => a.date === payload.date);
        if (anchor) {
            return (
                <svg x={cx - 6} y={cy - 6} width={12} height={12} fill="#06b6d4" className="drop-shadow-lg">
                    <circle cx="6" cy="6" r="6" stroke="white" strokeWidth="2" />
                    <title>${anchor.price.toFixed(2)} ({anchor.label})</title>
                </svg>
            );
        }
        return null;
    };

    // Min/Max for Y-axis
    const allPrices = [
        ...historicalData.map(d => d.price),
        ...forecastData.map(d => d.price)
    ];
    const minPrice = Math.min(...allPrices) * 0.9;
    const maxPrice = Math.max(...allPrices) * 1.05;

    return (
        <div className="w-full h-[500px] bg-white/5 border border-white/10 rounded-2xl p-4 md:p-6 overflow-hidden relative group hover:border-blue-500/30 transition-all duration-500">
            <div className="absolute top-6 left-6 z-10">
                <h3 className="text-xl font-bold text-blue-400 flex items-center gap-2">
                    AI Projection Path
                </h3>
                <p className="text-sm text-gray-400">Multi-Horizon Price Forecast via Random Forest</p>
            </div>

            <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 60, right: 30, left: 10, bottom: 20 }}>
                    <defs>
                        <linearGradient id="colorHist" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorFore" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                        {/* Pattern for Forecast Line to look dashed/cool */}
                    </defs>

                    <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                    <XAxis
                        dataKey="date"
                        tick={{ fill: '#666', fontSize: 12 }}
                        tickFormatter={(str) => {
                            const d = new Date(str);
                            return `${d.getMonth() + 1}/${d.getFullYear() % 100}`;
                        }}
                        minTickGap={50}
                    />
                    <YAxis
                        domain={[minPrice, maxPrice]}
                        orientation="right"
                        tick={{ fill: '#666', fontSize: 12 }}
                        tickFormatter={(val) => `$${val.toFixed(0)}`}
                        stroke="#333"
                    />
                    <Tooltip content={<CustomTooltip />} />

                    <Area
                        type="monotone"
                        dataKey="historicalPrice"
                        stroke="#94a3b8"
                        strokeWidth={2}
                        fill="url(#colorHist)"
                        name="History"
                    />

                    <Area
                        type="monotone"
                        dataKey="forecastPrice"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        fill="url(#colorFore)"
                        name="Forecast"
                    />

                    {/* Render Anchors as ReferenceDots with Labels */}
                    {anchors.map((anchor, idx) => (
                        <ReferenceDot
                            key={idx}
                            x={anchor.date}
                            y={anchor.price}
                            r={8}
                            fill="#06b6d4"
                            stroke="white"
                            strokeWidth={2}
                            ifOverflow="extendDomain"
                            label={{
                                value: `$${anchor.price.toFixed(0)}`,
                                position: idx % 2 === 0 ? 'top' : 'bottom',
                                fill: '#06b6d4',
                                fontSize: 11,
                                fontWeight: 'bold',
                                offset: 10
                            }}
                        />
                    ))}

                </ComposedChart>
            </ResponsiveContainer>

            {/* Legend / Info */}
            <div className="absolute bottom-6 left-6 flex gap-6 text-xs text-gray-400 pointer-events-none">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-slate-400 rounded-full"></div> History
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div> AI Forecast Path
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-cyan-500 border border-white rounded-full"></div> Key Targets ({anchors.length})
                </div>
            </div>
        </div>
    );
};

export default MLForecastChart;
