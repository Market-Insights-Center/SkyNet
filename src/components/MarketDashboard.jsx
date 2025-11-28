import React, { useEffect, useRef, memo } from 'react';

// Singleton script loader
let tvScriptLoadingPromise;

const loadTradingViewScript = () => {
    if (!tvScriptLoadingPromise) {
        tvScriptLoadingPromise = new Promise((resolve) => {
            if (window.TradingView) {
                resolve();
                return;
            }
            const script = document.createElement('script');
            script.src = 'https://s3.tradingview.com/tv.js';
            script.async = true;
            script.onload = resolve;
            document.head.appendChild(script);
        });
    }
    return tvScriptLoadingPromise;
};

export const TradingViewWidget = memo(({
    symbol,
    theme = "dark",
    autosize = true,
    height = "100%",
    width = "100%",
    interval = "D",
    timezone = "Etc/UTC",
    style = "1",
    locale = "en",
    toolbar_bg = "#f1f3f6",
    enable_publishing = false,
    allow_symbol_change = true,
    container_id,
    hide_top_toolbar = false,
    hide_legend = false,
    hide_side_toolbar = false,
    save_image = false
}) => {
    const uniqueId = useRef(`tv_widget_${Math.random().toString(36).substring(7)}`).current;

    useEffect(() => {
        let widget = null;

        loadTradingViewScript().then(() => {
            // Render delay to ensure DOM is painted
            setTimeout(() => {
                const containerElement = document.getElementById(uniqueId);
                
                if (containerElement && window.TradingView) {
                    containerElement.innerHTML = '';

                    widget = new window.TradingView.widget({
                        "container_id": uniqueId,
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
                        "hide_top_toolbar": hide_top_toolbar,
                        "hide_legend": hide_legend,
                        "hide_side_toolbar": hide_side_toolbar,
                        "save_image": save_image
                    });
                }
            }, 50); 
        });

        return () => {
            const containerElement = document.getElementById(uniqueId);
            if (containerElement) {
                containerElement.innerHTML = '';
            }
        };
    }, [symbol, theme, interval, width, height, timezone, style, hide_top_toolbar, hide_legend, hide_side_toolbar]);

    return (
        <div
            id={uniqueId}
            className="tradingview-widget-container"
            style={{ height: height, width: width }}
        />
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
                    <div className="lg:col-span-2 bg-white/5 border border-gold/20 rounded-xl overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.5)] flex flex-col">
                        <div className="flex-grow relative w-full h-full">
                            <TradingViewWidget
                                symbol="AMEX:SPY"
                                theme="dark"
                                autosize
                            />
                        </div>
                    </div>

                    {/* Secondary Charts */}
                    <div className="flex flex-col gap-6 h-full">
                        {/* VIXCLS */}
                        <div className="flex-1 bg-white/5 border border-white/10 rounded-xl overflow-hidden hover:border-gold/30 transition-colors p-4 relative flex flex-col">
                            <h3 className="text-gold font-bold mb-2 flex items-center gap-2 z-10 bg-black/50 px-2 rounded w-fit">
                                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                VIXCLS (CBOE Volatility Index)
                            </h3>
                            <div className="flex-grow relative w-full h-full">
                                <TradingViewWidget
                                    symbol="FRED:VIXCLS" // Changed to FRED:VIXCLS
                                    theme="dark"
                                    style="1"
                                    interval="D" // Must be 'D' for FRED data
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
                        <div className="flex-1 bg-white/5 border border-white/10 rounded-xl overflow-hidden hover:border-gold/30 transition-colors p-4 relative flex flex-col">
                            <h3 className="text-gold font-bold mb-2 flex items-center gap-2 z-10 bg-black/50 px-2 rounded w-fit">
                                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                Bitcoin (BTCUSD)
                            </h3>
                            <div className="flex-grow relative w-full h-full">
                                <TradingViewWidget
                                    symbol="COINBASE:BTCUSD"
                                    theme="dark"
                                    style="1"
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