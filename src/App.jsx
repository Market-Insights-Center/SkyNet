import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useSearchParams, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import PageTransition from './components/PageTransition';
import { PayPalScriptProvider } from "@paypal/react-paypal-js";
import { AuthProvider } from './contexts/AuthContext';
import { SkyNetProvider, useSkyNet } from './contexts/SkyNetContext';
import SkyNetOverlay from './components/SkyNetOverlay';
import { TradingViewWidget } from './components/MarketDashboard';
import UsernameSetupModal from './components/UsernameSetupModal';
import { useAuth } from './contexts/AuthContext';

import Layout from './components/Layout';
import LandingPage from './pages/LandingPage';
import PortfolioLab from './pages/PortfolioLab';
import Products from './pages/Products';
import MarketNexus from './pages/MarketNexus';
import Wizard from './pages/Wizard';
import Login from './pages/Login';
import SignUp from './pages/SignUp';
import Profile from './pages/Profile';
import StartupAnimation from './components/StartupAnimation';
import Forum from './pages/Forum';
import NewsPage from './pages/NewsPage';
import KnowledgeStream from './pages/KnowledgeStream';
import ArticleView from './pages/ArticleView';
import AdminDashboard from './pages/AdminDashboard';
import Chatbox from './pages/Chatbox';
import IdeasPage from './pages/IdeasPage';
import TermsOfService from './pages/TermsOfService';
import PrivacyPolicy from './pages/PrivacyPolicy';
import AssetEvaluator from './pages/AssetEvaluator';
import ComparisonMatrix from './pages/ComparisonMatrix';
import ControlsPage from './pages/ControlsPage';
import SidebarPage from './pages/SidebarPage';
import Help from './pages/Help';

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

    // Auto-connect SkyNet for this tab if requested AND initialize chart state
    const { connect, setChartTicker } = useSkyNet();

    useEffect(() => {
        if (searchParams.get('skynet') === 'true') {
            connect();
        }
        // CRITICAL: Initialize context with the ticker so SkyNet knows we are in Chart Mode
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
                ACTIVE CHART NODE: {ticker}
            </div>
        </div>
    );
};

const AppContent = () => {
    const { connect } = useSkyNet();
    const { userProfile } = useAuth();
    const [searchParams] = useSearchParams();
    const [showUsernameModal, setShowUsernameModal] = useState(false);

    useEffect(() => {
        // Only show modal if username is completely missing OR if it is a default "User_..." placeholder
        // This ensures users set a custom username once.
        if (userProfile) {
            if (!userProfile.username || userProfile.username.startsWith("User_")) {
                setShowUsernameModal(true);
            } else {
                setShowUsernameModal(false);
            }
        }
    }, [userProfile]);

    useEffect(() => {
        if (searchParams.get('skynet') === 'true') {
            connect();
        }
    }, [searchParams, connect]);

    const location = useLocation();

    return (
        <>
            <UsernameSetupModal isOpen={showUsernameModal} onClose={() => setShowUsernameModal(false)} />
            <SkyNetOverlay />
            <AnimatePresence mode="wait">
                <Routes location={location} key={location.pathname}>
                    <Route path="/" element={<PageTransition><Layout><LandingPage /></Layout></PageTransition>} />
                    <Route path="/products" element={<PageTransition><Layout><Products /></Layout></PageTransition>} />
                    <Route path="/asset-evaluator" element={<PageTransition><Layout><AssetEvaluator /></Layout></PageTransition>} />
                    <Route path="/products/comparison-matrix" element={<PageTransition><Layout><ComparisonMatrix /></Layout></PageTransition>} />
                    <Route path="/market-nexus" element={<PageTransition><Layout><MarketNexus /></Layout></PageTransition>} />
                    <Route path="/portfolio-lab" element={<PageTransition><Layout><PortfolioLab /></Layout></PageTransition>} />
                    <Route path="/custom" element={<PageTransition><Layout><Wizard /></Layout></PageTransition>} />
                    <Route path="/invest" element={<PageTransition><Layout><Wizard /></Layout></PageTransition>} />
                    <Route path="/cultivate" element={<PageTransition><Layout><Wizard /></Layout></PageTransition>} />
                    <Route path="/tracking" element={<PageTransition><Layout><Wizard /></Layout></PageTransition>} />
                    <Route path="/login" element={<PageTransition><Layout><Login /></Layout></PageTransition>} />
                    <Route path="/signup" element={<PageTransition><Layout><SignUp /></Layout></PageTransition>} />
                    <Route path="/profile" element={<PageTransition><Layout><Profile /></Layout></PageTransition>} />
                    <Route path="/forum" element={<PageTransition><Layout><Forum /></Layout></PageTransition>} />
                    <Route path="/news" element={<PageTransition><Layout><NewsPage /></Layout></PageTransition>} />
                    <Route path="/knowledge-stream" element={<PageTransition><Layout><KnowledgeStream /></Layout></PageTransition>} />
                    <Route path="/article/:id" element={<PageTransition><Layout><ArticleView /></Layout></PageTransition>} />
                    <Route path="/admin" element={<PageTransition><Layout><AdminDashboard /></Layout></PageTransition>} />
                    <Route path="/chat" element={<PageTransition><Layout><Chatbox /></Layout></PageTransition>} />
                    <Route path="/ideas" element={<PageTransition><Layout><IdeasPage /></Layout></PageTransition>} />
                    <Route path="/terms" element={<PageTransition><Layout><TermsOfService /></Layout></PageTransition>} />
                    <Route path="/privacy" element={<PageTransition><Layout><PrivacyPolicy /></Layout></PageTransition>} />
                    <Route path="/social" element={<PageTransition><Layout><Forum /></Layout></PageTransition>} />
                    <Route path="/help" element={<PageTransition><Layout><Help /></Layout></PageTransition>} />

                    {/* --- SKYNET DETACHED CONTROLS & SIDEBAR (No Transition Wrapper needed as they pop up) --- */}
                    <Route path="/controls" element={<ControlsPage />} />
                    <Route path="/sidebar" element={<SidebarPage />} />
                    <Route path="/active-chart" element={<ActiveChartPage />} />
                </Routes>
            </AnimatePresence>
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
                            <SkyNetProvider>
                                <AppContent />
                            </SkyNetProvider>
                        </AuthProvider>
                    </Router>
                </div>
            </PayPalScriptProvider>
        </div>
    );
}

export default App;