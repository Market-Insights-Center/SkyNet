import React, { useEffect, useRef, memo } from 'react';

const TradingViewWidget = ({
    ticker,
    symbol,
    theme = 'dark',
    autosize = true,
    interval = "D",
    timezone = "Etc/UTC",
    style = "1",
    locale = "en",
    toolbar_bg = "#f1f3f6",
    enable_publishing = false,
    hide_top_toolbar = false,
    hide_legend = false,
    hide_side_toolbar = false,
    allow_symbol_change = true,
    save_image = false,
    width = "100%",
    height = "100%"
}) => {
    const containerRef = useRef(null);
    // Use a stable ID for the container
    const widgetIdRef = useRef(`tv-widget-${Math.random().toString(36).substr(2, 9)}`);
    const activeSymbol = symbol || ticker;

    useEffect(() => {
        if (!activeSymbol) return;

        const initWidget = () => {
            // Clear container first to prevent duplicates
            if (containerRef.current) {
                containerRef.current.innerHTML = '';
            }

            if (window.TradingView) {
                new window.TradingView.widget({
                    "autosize": autosize,
                    "symbol": activeSymbol,
                    "interval": interval,
                    "timezone": timezone,
                    "theme": theme,
                    "style": style,
                    "locale": locale,
                    "toolbar_bg": toolbar_bg,
                    "enable_publishing": enable_publishing,
                    "hide_top_toolbar": hide_top_toolbar,
                    "hide_legend": hide_legend,
                    "hide_side_toolbar": hide_side_toolbar,
                    "allow_symbol_change": allow_symbol_change,
                    "save_image": save_image,
                    "container_id": widgetIdRef.current,
                    "width": width,
                    "height": height
                });
            }
        };

        if (window.TradingView) {
            initWidget();
        } else {
            let script = document.querySelector('script[src="https://s3.tradingview.com/tv.js"]');

            if (!script) {
                script = document.createElement('script');
                script.src = 'https://s3.tradingview.com/tv.js';
                script.async = true;
                script.onload = initWidget;
                document.head.appendChild(script);
            } else {
                script.addEventListener('load', initWidget);
            }
        }

        return () => {
            if (containerRef.current) {
                containerRef.current.innerHTML = '';
            }
        };
    }, [
        activeSymbol, theme, autosize, interval, timezone, style, locale,
        toolbar_bg, enable_publishing, hide_top_toolbar, hide_legend,
        hide_side_toolbar, allow_symbol_change, save_image, width, height
    ]);

    return (
        <div className="tradingview-widget-container" id={widgetIdRef.current} ref={containerRef} style={{ height, width }}>
            <div className="tradingview-widget-container__widget" style={{ height: '100%', width: '100%' }}></div>
        </div>
    );
};

export default memo(TradingViewWidget);
