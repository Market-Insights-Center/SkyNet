import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
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
import ArticleView from './pages/ArticleView';
import AdminDashboard from './pages/AdminDashboard';
import CreateArticle from './pages/CreateArticle';

function App() {
    const [isLoading, setIsLoading] = useState(true);

    return (
        <AuthProvider>
            {isLoading && <StartupAnimation onComplete={() => setIsLoading(false)} />}
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
                            <Route path="/news/:id" element={<ArticleView />} />
                            <Route path="/admin" element={<AdminDashboard />} />
                            <Route path="/create-article" element={<CreateArticle />} />
                        </Routes>
                    </Layout>
                </Router>
            )}
        </AuthProvider>
    );
}

export default App;
