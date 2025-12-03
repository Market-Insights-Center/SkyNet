import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useSearchParams } from 'react-router-dom';
import { PayPalScriptProvider } from "@paypal/react-paypal-js"; 
import { AuthProvider } from './contexts/AuthContext';
import { SkyNetProvider, useSkyNet } from './contexts/SkyNetContext';
import SkyNetOverlay from './components/SkyNetOverlay';

import Layout from './components/Layout';
import LandingPage from './pages/LandingPage';
import PortfolioLab from './pages/PortfolioLab';
import Products from './pages/Products';
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

// --- PayPal Configuration (Safety Mode) ---
const clientId = import.meta.env.VITE_PAYPAL_CLIENT_ID;

const paypalOptions = {
    "client-id": clientId || "test",
    components: "buttons",
    intent: clientId ? "subscription" : "capture",
    vault: !!clientId
};

/**
 * AppContent handles the routes and logic that requires the Router context.
 */
const AppContent = () => {
    const { connect } = useSkyNet();
    const [searchParams] = useSearchParams();

    useEffect(() => {
        // If the URL has ?skynet=true, automatically connect to the Python backend
        if (searchParams.get('skynet') === 'true') {
            connect();
        }
    }, [searchParams, connect]);

    return (
        <Layout>
            <SkyNetOverlay /> {/* The Visual HUD for SkyNet */}
            <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/products" element={<Products />} />
                <Route path="/portfolio-lab" element={<PortfolioLab />} />
                <Route path="/custom" element={<Wizard />} />
                <Route path="/invest" element={<Wizard />} />
                <Route path="/cultivate" element={<Wizard />} />
                <Route path="/tracking" element={<Wizard />} />
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<SignUp />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/forum" element={<Forum />} />
                <Route path="/news" element={<NewsPage />} />
                <Route path="/knowledge-stream" element={<KnowledgeStream />} />
                <Route path="/article/:id" element={<ArticleView />} />
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/chat" element={<Chatbox />} />
                <Route path="/ideas" element={<IdeasPage />} />
                <Route path="/terms" element={<TermsOfService />} />
                <Route path="/privacy" element={<PrivacyPolicy />} />
            </Routes>
        </Layout>
    );
};

function App() {
    const [isLoading, setIsLoading] = useState(true);

    if (!clientId) {
        console.warn("⚠️ VITE_PAYPAL_CLIENT_ID is missing. PayPal features will be in 'Safety Mode'.");
    }

    return (
        <div className="min-h-screen bg-black text-white">
            <PayPalScriptProvider options={paypalOptions}>
                
                {/* Startup Animation runs outside the Router/Providers context */}
                {isLoading && (
                    <div className="fixed inset-0 z-[9999] bg-black">
                        <StartupAnimation onComplete={() => setIsLoading(false)} />
                    </div>
                )}

                {/* CRITICAL FIX: The <Router> must wrap AuthProvider and SkyNetProvider 
                   because they use useNavigate/useSearchParams internally.
                */}
                <div 
                    className={`transition-opacity duration-1000 ease-in-out ${
                        isLoading ? 'opacity-0 pointer-events-none' : 'opacity-100'
                    }`}
                >
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