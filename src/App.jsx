import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useSearchParams, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import PageTransition from './components/PageTransition';
import { PayPalScriptProvider } from "@paypal/react-paypal-js";
import { AuthProvider } from './contexts/AuthContext';
import { OrionProvider, useOrion } from './contexts/OrionContext';
import OrionOverlay from './components/OrionOverlay';
import TradingViewWidget from './components/TradingViewWidget';
import UsernameSetupModal from './components/UsernameSetupModal';
import BirthdayPopup from './components/BirthdayPopup';
import { useAuth } from './contexts/AuthContext';
import { CardExpansionProvider } from './contexts/CardExpansionContext';
import CardExpansionOverlay from './components/CardExpansionOverlay';

import Layout from './components/Layout';
import StartupAnimation from './components/StartupAnimation';
import CommandPalette from './components/CommandPalette'; // Import CommandPalette
import { Loader2 } from 'lucide-react';

// Lazy Load Pages
import { LazyRoutes } from './config/routes_new';

// --- PayPal Configuration (Safety Mode) ---
const clientId = import.meta.env.VITE_PAYPAL_CLIENT_ID;

const paypalOptions = {
    "client-id": clientId || "test",
    components: "buttons",
    intent: clientId ? "subscription" : "capture",
    vault: !!clientId
};

/**
 * Dedicated Full Page Chart Component
 */
const ActiveChartPage = () => {
    const [searchParams] = useSearchParams();
    const ticker = searchParams.get('ticker') || "SPY";

    // Auto-connect Orion for this tab if requested AND initialize chart state
    const { connect, setChartTicker } = useOrion();

    useEffect(() => {
        if (searchParams.get('orion') === 'true') {
            connect();
        }
        // CRITICAL: Initialize context with the ticker so Orion knows we are in Chart Mode
        // This enables the specific Zoom/Pan/Click logic for charts instead of navigation.
        if (ticker) {
            setChartTicker(ticker);
        }
    }, [searchParams, connect, ticker, setChartTicker]);

    return (
        <div className="w-screen h-screen bg-black overflow-hidden relative">
            <div className="absolute inset-0 z-0">
                <TradingViewWidget
                    symbol={ticker}
                    theme="dark"
                    autosize
                    hide_side_toolbar={false}
                />
            </div>
            <div className="absolute top-4 right-4 bg-black/50 text-cyan-400 p-2 rounded pointer-events-none z-50 text-xs font-mono border border-cyan-500/30">
                ACTIVE ORION NODE: {ticker}
            </div>
        </div>
    );
};

const AppContent = () => {
    const { connect } = useOrion();
    const { userProfile, currentUser } = useAuth();
    const [searchParams] = useSearchParams();
    const [showUsernameModal, setShowUsernameModal] = useState(false);
    const [showBirthdayModal, setShowBirthdayModal] = useState(false);
    const [accountYears, setAccountYears] = useState(0);

    useEffect(() => {
        // Only show modal if username is completely missing OR if it is a default "User_..." placeholder
        // This ensures users set a custom username once.
        if (userProfile) {
            if (!userProfile.username || userProfile.username.startsWith("User_")) {
                setShowUsernameModal(true);
            } else {
                setShowUsernameModal(false);
            }

            // Check Birthday / Anniversary
            const checkAnniversary = () => {
                const createdAt = userProfile.created_at?.toDate ? userProfile.created_at.toDate() : new Date(userProfile.created_at || currentUser?.metadata?.creationTime);
                if (!createdAt) return;

                const today = new Date();
                const isAnniversaryMonth = today.getMonth() === createdAt.getMonth();
                const isAnniversaryDay = today.getDate() === createdAt.getDate();

                // For testing/demo logic: check if it's the exact day.
                // In production, might want 'isAnniversaryMonth' or similar.
                // Let's stick to exact day + year check to avoid spam.

                if (isAnniversaryMonth && isAnniversaryDay) {
                    const years = today.getFullYear() - createdAt.getFullYear();
                    if (years > 0) {
                        const lastShownYear = localStorage.getItem(`birthday_popup_shown_year_${currentUser.uid}`);
                        if (lastShownYear !== String(today.getFullYear())) {
                            setAccountYears(years);
                            setShowBirthdayModal(true);
                        }
                    }
                }
            };
            checkAnniversary();
        }
    }, [userProfile, currentUser]);

    const handleCloseBirthday = () => {
        setShowBirthdayModal(false);
        if (currentUser) {
            localStorage.setItem(`birthday_popup_shown_year_${currentUser.uid}`, new Date().getFullYear().toString());
        }
    };

    useEffect(() => {
        if (searchParams.get('orion') === 'true') {
            connect();
        }
    }, [searchParams, connect]);

    const location = useLocation();

    return (
        <>
            <UsernameSetupModal isOpen={showUsernameModal} onClose={() => setShowUsernameModal(false)} />
            <BirthdayPopup isOpen={showBirthdayModal} onClose={handleCloseBirthday} years={accountYears} />
            <OrionOverlay />
            <CardExpansionOverlay />
            <CommandPalette /> {/* Mount Global Command Palette */}
            <React.Suspense fallback={
                <div className="h-screen w-full bg-black flex items-center justify-center">
                    <Loader2 className="animate-spin text-gold" size={48} />
                </div>
            }>
                <AnimatePresence mode="popLayout">
                    <Routes location={location} key={location.pathname}>
                        <Route path="/" element={<PageTransition><Layout><LazyRoutes.LandingPage /></Layout></PageTransition>} />
                        <Route path="/products" element={<PageTransition><Layout><LazyRoutes.Products /></Layout></PageTransition>} />
                        {/* <Route path="/asset-evaluator" element={<PageTransition><Layout><LazyRoutes.AssetEvaluator /></Layout></PageTransition>} /> */}
                        <Route path="/products/comparison-matrix" element={<PageTransition><Layout><LazyRoutes.ComparisonMatrix /></Layout></PageTransition>} />
                        <Route path="/performance-stream" element={<PageTransition><Layout><LazyRoutes.PerformanceStream /></Layout></PageTransition>} />
                        <Route path="/market-junction" element={<PageTransition><Layout><LazyRoutes.MarketJunction /></Layout></PageTransition>} />
                        <Route path="/portfolio-lab" element={<PageTransition><Layout><LazyRoutes.PortfolioLab /></Layout></PageTransition>} />
                        <Route path="/database-lab" element={<PageTransition><Layout><LazyRoutes.DatabaseNodes /></Layout></PageTransition>} />
                        <Route path="/custom" element={<PageTransition><Layout><LazyRoutes.Wizard /></Layout></PageTransition>} />
                        <Route path="/invest" element={<PageTransition><Layout><LazyRoutes.Wizard /></Layout></PageTransition>} />
                        <Route path="/cultivate" element={<PageTransition><Layout><LazyRoutes.Wizard /></Layout></PageTransition>} />
                        <Route path="/tracking" element={<PageTransition><Layout><LazyRoutes.Wizard /></Layout></PageTransition>} />
                        <Route path="/login" element={<PageTransition><Layout><LazyRoutes.Login /></Layout></PageTransition>} />
                        <Route path="/signup" element={<PageTransition><Layout><LazyRoutes.SignUp /></Layout></PageTransition>} />
                        <Route path="/profile" element={<PageTransition><Layout><LazyRoutes.Profile /></Layout></PageTransition>} />
                        <Route path="/forum" element={<PageTransition><Layout><LazyRoutes.Forum /></Layout></PageTransition>} />
                        <Route path="/news" element={<PageTransition><Layout><LazyRoutes.NewsPage /></Layout></PageTransition>} />
                        <Route path="/knowledge-stream" element={<PageTransition><Layout><LazyRoutes.KnowledgeStream /></Layout></PageTransition>} />
                        <Route path="/article/:id" element={<PageTransition><Layout><LazyRoutes.ArticleView /></Layout></PageTransition>} />
                        <Route path="/admin" element={<PageTransition><Layout><LazyRoutes.AdminDashboard /></Layout></PageTransition>} />
                        <Route path="/chat" element={<PageTransition><Layout><LazyRoutes.Chatbox /></Layout></PageTransition>} />
                        <Route path="/ideas" element={<PageTransition><Layout><LazyRoutes.IdeasPage /></Layout></PageTransition>} />
                        <Route path="/terms" element={<PageTransition><Layout><LazyRoutes.TermsOfService /></Layout></PageTransition>} />
                        <Route path="/privacy" element={<PageTransition><Layout><LazyRoutes.PrivacyPolicy /></Layout></PageTransition>} />
                        <Route path="/social" element={<PageTransition><Layout><LazyRoutes.Forum /></Layout></PageTransition>} />
                        <Route path="/help" element={<PageTransition><Layout><LazyRoutes.Help /></Layout></PageTransition>} />
                        <Route path="/about" element={<PageTransition><Layout><LazyRoutes.About /></Layout></PageTransition>} />

                        {/* --- ORION DETACHED CONTROLS & SIDEBAR (No Transition Wrapper needed as they pop up) --- */}
                        {/* Note: lazy loaded components work fine here too */}
                        <Route path="/controls" element={<LazyRoutes.ControlsPage />} />
                        <Route path="/sidebar" element={<LazyRoutes.SidebarPage />} />
                        <Route path="/briefing" element={<LazyRoutes.Briefing />} />
                        <Route path="/portfolio-nexus" element={<LazyRoutes.PortfolioNexus />} />
                        <Route path="/sentinel-ai" element={<PageTransition><Layout><LazyRoutes.SentinelAI /></Layout></PageTransition>} />
                        <Route path="/asset-evaluator" element={<LazyRoutes.AssetEvaluator />} />
                        <Route path="/active-chart" element={<ActiveChartPage />} />
                        <Route path="/active-chart" element={<ActiveChartPage />} />
                        <Route path="/strategy-ranking" element={<PageTransition><Layout><LazyRoutes.StrategyRanking /></Layout></PageTransition>} />
                        <Route path="/market-predictions" element={<PageTransition><Layout><LazyRoutes.MarketPredictions /></Layout></PageTransition>} />

                        <Route path="/workflow-automation" element={<PageTransition><Layout><LazyRoutes.WorkflowAutomation /></Layout></PageTransition>} />
                    </Routes>
                </AnimatePresence>
            </React.Suspense>
        </>
    );
};

function App() {
    // Skip animation for detached windows (controls, sidebar, active-chart)
    const [isLoading, setIsLoading] = useState(() => {
        const path = window.location.pathname;
        const skipPaths = ['/controls', '/sidebar', '/active-chart'];
        return !skipPaths.includes(path);
    });

    if (!clientId) {
        console.warn("⚠️ VITE_PAYPAL_CLIENT_ID is missing. PayPal features will be in 'Safety Mode'.");
    }

    return (
        <div className="min-h-screen bg-black text-white">
            <PayPalScriptProvider options={paypalOptions}>
                {isLoading && (
                    <div className="fixed inset-0 z-[9999] bg-black">
                        <StartupAnimation onComplete={() => setIsLoading(false)} />
                    </div>
                )}

                <div className={`transition-opacity duration-1000 ease-in-out ${isLoading ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                    <Router>
                        <AuthProvider>
                            <OrionProvider>
                                <CardExpansionProvider>
                                    <AppContent />
                                </CardExpansionProvider>
                            </OrionProvider>
                        </AuthProvider>
                    </Router>
                </div>
            </PayPalScriptProvider>
        </div>
    );
}

export default App;