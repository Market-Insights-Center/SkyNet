import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { PayPalScriptProvider } from "@paypal/react-paypal-js"; // <--- CRITICAL IMPORT
import { AuthProvider } from './contexts/AuthContext';
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
    "client-id": clientId || "test", // Fallback to 'test' to prevent crash if ID is missing
    components: "buttons",
    intent: clientId ? "subscription" : "capture",
    vault: !!clientId // Only enable vault if we have a real ID
};

function App() {
    const [isLoading, setIsLoading] = useState(true);

    // Console warning if ID is missing (helps debugging)
    if (!clientId) {
        console.warn("⚠️ VITE_PAYPAL_CLIENT_ID is missing. PayPal features will be in 'Safety Mode'.");
    }

    return (
        // <--- CRITICAL: Must wrap everything in PayPalScriptProvider
        <PayPalScriptProvider options={paypalOptions}> 
            
            {isLoading && <StartupAnimation onComplete={() => setIsLoading(false)} />}

            <AuthProvider>
                {!isLoading && (
                    <Router>
                        <Layout>
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
                    </Router>
                )}
            </AuthProvider>
        </PayPalScriptProvider>
    );
}

export default App;