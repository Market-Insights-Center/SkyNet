import React, { useEffect, useRef, memo } from 'react';

const TradingViewWidget = memo(({ symbol, theme = "dark", autosize = true, height = "100%", width = "100%", interval = "5", timezone = "Etc/UTC", style = "1", locale = "en", toolbar_bg = "#f1f3f6", enable_publishing = false, allow_symbol_change = true, container_id }) => {
    const container = useRef();

    useEffect(() => {
        const script = document.createElement("script");
        script.src = "https://s3.tradingview.com/tv.js";
        script.async = true;
        script.onload = () => {
            if (window.TradingView) {
                new window.TradingView.widget({
                    "width": width,
                    "height": height,
                    "symbol": symbol,
                    "interval": interval,
                    "timezone": timezone,
                    "theme": theme,
                    "style": style,
                    "locale": locale,
                    "toolbar_bg": toolbar_bg,
                    "enable_publishing": enable_publishing,
                    "allow_symbol_change": allow_symbol_change,
                    "container_id": container_id
                });
            }
        };
        container.current.appendChild(script);
        return () => {
            if (container.current) {
                container.current.innerHTML = "";
            }
        };
    }, [symbol]);

    return (
        <div id={container_id} ref={container} className="tradingview-widget-container" style={{ height: "100%", width: "100%" }} />
    );
});

const MiniChartWidget = memo(({ symbol, colorTheme = "dark", width = "100%", height = "100%" }) => {
    const container = useRef();

    useEffect(() => {
        const script = document.createElement("script");
        script.src = "https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js";
        script.async = true;
        script.innerHTML = JSON.stringify({
            "symbol": symbol,
            "width": width,
            "height": height,
            "locale": "en",
            "dateRange": "12M",
            "colorTheme": colorTheme,
            "isTransparent": true,
            "autosize": true,
            "largeChartUrl": ""
        });
        container.current.appendChild(script);
        return () => {
            if (container.current) {
                container.current.innerHTML = "";
            }
        };
    }, [symbol]);

    return (
        <div ref={container} className="tradingview-widget-container" style={{ height: "100%", width: "100%" }}>
            <div className="tradingview-widget-container__widget"></div>
        </div>
    );
});

const MarketDashboard = () => {
    return (
        <section className="py-12 px-4 bg-deep-black">
            <div className="max-w-7xl mx-auto">
                <div className="mb-8 flex items-center gap-4">
                    <div className="h-px flex-grow bg-gradient-to-r from-transparent via-gold/50 to-transparent" />
                    <h2 className="text-3xl font-bold text-gold tracking-widest uppercase">Market Intelligence</h2>
                    <div className="h-px flex-grow bg-gradient-to-r from-transparent via-gold/50 to-transparent" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
                    {/* Primary Chart - SPY */}
                    <div className="lg:col-span-2 bg-white/5 border border-gold/20 rounded-xl overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.5)] h-full">
                        <TradingViewWidget
                            symbol="AMEX:SPY"
                            container_id="tv_chart_spy"
                            theme="dark"
                            autosize
                        />
                    </div>

                    {/* Secondary Charts */}
                    <div className="flex flex-col gap-6 h-full">
                        {/* VIXCLS */}
                        <div className="flex-1 bg-white/5 border border-white/10 rounded-xl overflow-hidden hover:border-gold/30 transition-colors p-4 relative">
                            <h3 className="text-gold font-bold mb-2 flex items-center gap-2 absolute top-4 left-4 z-10 bg-black/50 px-2 rounded">
                                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                Volatility Index (VIXCLS)
                            </h3>
                            <div className="h-full w-full">
                                <TradingViewWidget
                                    symbol="FRED:VIXCLS"
                                    container_id="tv_chart_vix"
                                    theme="dark"
                                    style="1" // Candlesticks
                                    interval="D"
                                    hide_top_toolbar={true}
                                    hide_legend={true}
                                    hide_side_toolbar={true}
                                    allow_symbol_change={false}
                                    save_image={false}
                                    autosize
                                />
                            </div>
                        </div>

                        {/* BTC */}
                        <div className="flex-1 bg-white/5 border border-white/10 rounded-xl overflow-hidden hover:border-gold/30 transition-colors p-4 relative">
                            <h3 className="text-gold font-bold mb-2 flex items-center gap-2 absolute top-4 left-4 z-10 bg-black/50 px-2 rounded">
                                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                Bitcoin (BTCUSD)
                            </h3>
                            <div className="h-full w-full">
                                <TradingViewWidget
                                    symbol="COINBASE:BTCUSD"
                                    container_id="tv_chart_btc"
                                    theme="dark"
                                    style="1" // Candlesticks
                                    interval="60"
                                    hide_top_toolbar={true}
                                    hide_legend={true}
                                    hide_side_toolbar={true}
                                    allow_symbol_change={false}
                                    save_image={false}
                                    autosize
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default MarketDashboard;
