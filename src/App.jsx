import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Layout from './components/Layout';
import PortfolioLab from './pages/PortfolioLab';
import Wizard from './pages/Wizard';
import Login from './pages/Login';
import SignUp from './pages/SignUp';
import Profile from './pages/Profile';

function App() {
    return (
        <AuthProvider>
            <Router>
                <Layout>
                    <Routes>
                        <Route path="/" element={<PortfolioLab />} />
                        <Route path="/custom" element={<Wizard />} />
                        <Route path="/invest" element={<Wizard />} />
                        <Route path="/cultivate" element={<Wizard />} />
                        <Route path="/tracking" element={<Wizard />} />
                        <Route path="/login" element={<Login />} />
                        <Route path="/signup" element={<SignUp />} />
                        <Route path="/profile" element={<Profile />} />
                    </Routes>
                </Layout>
            </Router>
        </AuthProvider>
    );
}

export default App;
