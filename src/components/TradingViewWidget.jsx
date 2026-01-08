import React, { useEffect, useRef, memo } from 'react';

const TradingViewWidget = ({ ticker, theme = 'dark', autosize = true }) => {
    const containerRef = useRef(null);

    useEffect(() => {
        // Ensure ticker is valid
        if (!ticker) return;

        // Clean up previous script if any (though React handles unmount, the script appends global variables sometimes)
        // We'll just clear the container.
        if (containerRef.current) {
            containerRef.current.innerHTML = '';
        }

        const script = document.createElement('script');
        script.src = 'https://s3.tradingview.com/tv.js';
        script.async = true;
        script.onload = () => {
            if (window.TradingView) {
                new window.TradingView.widget({
                    "autosize": autosize,
                    "symbol": ticker,
                    "interval": "D",
                    "timezone": "Etc/UTC",
                    "theme": theme,
                    "style": "1",
                    "locale": "en",
                    "toolbar_bg": "#f1f3f6",
                    "enable_publishing": false,
                    "hide_top_toolbar": false,
                    "hide_legend": false,
                    "save_image": false,
                    "container_id": containerRef.current.id
                });
            }
        };

        containerRef.current.appendChild(script);

        // Cleanup function not strictly necessary for the script tag itself as it's inside the container which gets cleared,
        // but good practice.
    }, [ticker, theme, autosize]);

    const containerId = `tv-widget-${ticker}-${Math.random().toString(36).substr(2, 9)}`;

    return (
        <div className="tradingview-widget-container h-full w-full" ref={containerRef} id={containerId}>
            <div className="tradingview-widget-container__widget h-full w-full"></div>
        </div>
    );
};

export default memo(TradingViewWidget);
