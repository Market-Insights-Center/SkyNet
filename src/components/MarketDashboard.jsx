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
                {/* UPDATED: Flex-col for mobile (stacked), Grid for Desktop */}
                <div className="flex flex-col lg:grid lg:grid-cols-3 gap-6 lg:h-[600px]">

                    {/* Primary Chart - SPY */}
                    <div className="lg:col-span-2 glass-panel glass-panel-hover rounded-xl overflow-hidden relative group flex flex-col h-[500px] lg:h-auto">
                        {/* Decorative Corner Accents */}
                        <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-gold/30 rounded-tl-lg z-20" />
                        <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-gold/30 rounded-tr-lg z-20" />
                        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-gold/30 rounded-bl-lg z-20" />
                        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-gold/30 rounded-br-lg z-20" />

                        <div className="flex-grow relative w-full h-full">
                            <TradingViewWidget
                                symbol="AMEX:SPY"
                                theme="dark"
                                autosize
                            />
                        </div>
                    </div>

                    {/* Secondary Charts Container */}
                    <div className="flex flex-col gap-6 h-auto lg:h-full">
                        {/* VIXCLS */}
                        <div className="flex-1 glass-panel glass-panel-hover rounded-xl overflow-hidden p-1 relative flex flex-col h-[400px] lg:h-auto group">
                            <div className="absolute inset-0 bg-gradient-to-b from-red-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                            <div className="absolute top-2 left-4 z-10 flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                <span className="text-xs font-bold text-gold tracking-wider">VOLATILITY INDEX</span>
                            </div>

                            <div className="flex-grow relative w-full h-full rounded-lg overflow-hidden bg-black/20">
                                <TradingViewWidget
                                    symbol="FRED:VIXCLS"
                                    theme="dark"
                                    style="1"
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
                        <div className="flex-1 glass-panel glass-panel-hover rounded-xl overflow-hidden p-1 relative flex flex-col h-[400px] lg:h-auto group">
                            <div className="absolute inset-0 bg-gradient-to-b from-green-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                            <div className="absolute top-2 left-4 z-10 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                                <span className="text-[10px] font-bold text-green-500 tracking-wider uppercase">Bitcoin Market</span>
                            </div>

                            <div className="flex-grow relative w-full h-full rounded-lg overflow-hidden bg-black/20">
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