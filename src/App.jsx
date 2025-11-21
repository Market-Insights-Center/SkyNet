import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import PortfolioLab from './pages/PortfolioLab';

import Wizard from './pages/Wizard';

function App() {
    return (
        <Router>
            <Layout>
                <Routes>
                    <Route path="/" element={<PortfolioLab />} />
                    <Route path="/custom" element={<Wizard />} />
                    <Route path="/invest" element={<Wizard />} />
                    <Route path="/cultivate" element={<Wizard />} />
                    <Route path="/tracking" element={<Wizard />} />
                </Routes>
            </Layout>
        </Router>
    );
}

export default App;
