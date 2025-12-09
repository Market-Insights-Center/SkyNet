import React from 'react';
import { Link } from 'react-router-dom';
import { Twitter, Linkedin, Github, Mail, Instagram, MessageCircle } from 'lucide-react';

const Footer = () => {
    return (
        <footer className="bg-black border-t border-white/10 py-12 px-4">
            <div className="max-w-7xl mx-auto">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
                    <div className="col-span-1">
                        <Link to="/" className="text-2xl font-bold tracking-wider text-white flex items-center gap-2 mb-4">
                            M.I.C. <span className="text-gold">SINGULARITY</span>
                        </Link>
                        <p className="text-gray-400 text-sm leading-relaxed mb-6">
                            Advanced AI-driven wealth management for the modern investor.
                            Institutional-grade strategies, democratized for everyone.
                        </p>

                    </div>

                    <div>
                        <h4 className="text-white font-bold mb-6 uppercase tracking-wider text-xs border-b border-white/10 pb-2 inline-block">Platform</h4>
                        <ul className="space-y-3 text-sm">
                            <li><Link to="/products" className="text-gray-400 hover:text-gold transition-colors flex items-center gap-2 hover:translate-x-1 duration-200">Products Suite</Link></li>
                            <li><Link to="/portfolio-lab" className="text-gray-400 hover:text-gold transition-colors flex items-center gap-2 hover:translate-x-1 duration-200">Portfolio Lab</Link></li>
                            <li><Link to="/market-nexus" className="text-gray-400 hover:text-gold transition-colors flex items-center gap-2 hover:translate-x-1 duration-200">Market Nexus</Link></li>
                            <li><Link to="/asset-evaluator" className="text-gray-400 hover:text-gold transition-colors flex items-center gap-2 hover:translate-x-1 duration-200">Asset Evaluator</Link></li>
                            <li><Link to="/products/comparison-matrix" className="text-gray-400 hover:text-gold transition-colors flex items-center gap-2 hover:translate-x-1 duration-200">Comparison Matrix</Link></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="text-white font-bold mb-6 uppercase tracking-wider text-xs border-b border-white/10 pb-2 inline-block">Resources</h4>
                        <ul className="space-y-3 text-sm">
                            <li><Link to="/news" className="text-gray-400 hover:text-gold transition-colors flex items-center gap-2 hover:translate-x-1 duration-200">News Feed</Link></li>
                            <li><Link to="/ideas" className="text-gray-400 hover:text-gold transition-colors flex items-center gap-2 hover:translate-x-1 duration-200">Trade Ideas</Link></li>
                            <li><Link to="/knowledge-stream" className="text-gray-400 hover:text-gold transition-colors flex items-center gap-2 hover:translate-x-1 duration-200">Knowledge Stream</Link></li>
                            <li><Link to="/forum" className="text-gray-400 hover:text-gold transition-colors flex items-center gap-2 hover:translate-x-1 duration-200">Community Forum</Link></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="text-white font-bold mb-6 uppercase tracking-wider text-xs border-b border-white/10 pb-2 inline-block">Support & Legal</h4>
                        <ul className="space-y-3 text-sm">
                            <li><Link to="/help" className="text-gray-400 hover:text-gold transition-colors flex items-center gap-2 hover:translate-x-1 duration-200">Help Center</Link></li>
                            <li><Link to="/chat" className="text-gray-400 hover:text-gold transition-colors flex items-center gap-2 hover:translate-x-1 duration-200">AI Support Chat</Link></li>
                            <li><Link to="/terms" className="text-gray-400 hover:text-gold transition-colors flex items-center gap-2 hover:translate-x-1 duration-200">Terms of Service</Link></li>
                            <li><Link to="/privacy" className="text-gray-400 hover:text-gold transition-colors flex items-center gap-2 hover:translate-x-1 duration-200">Privacy Policy</Link></li>
                        </ul>
                    </div>
                </div>

                <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
                    <p className="text-gray-500 text-sm">
                        &copy; {new Date().getFullYear()} Market Insights Center LLC. All rights reserved.
                    </p>
                    <div className="flex items-center gap-6">
                        {/* SOCIAL LINKS - Update hrefs with actual URLs */}
                        <a href="https://x.com/MarketInsightsC" target="_blank" rel="noreferrer" className="text-gray-400 hover:text-white transition-colors flex items-center gap-2">
                            <Twitter size={20} /> <span className="hidden md:inline">Twitter</span>
                        </a>
                        <a href="https://www.instagram.com/insights.center/" target="_blank" rel="noreferrer" className="text-gray-400 hover:text-white transition-colors flex items-center gap-2">
                            <Instagram size={20} /> <span className="hidden md:inline">Instagram</span>
                        </a>
                        <a href="https://www.reddit.com/r/MarketInsightsCenter/" target="_blank" rel="noreferrer" className="text-gray-400 hover:text-white transition-colors flex items-center gap-2">
                            <MessageCircle size={20} /> <span className="hidden md:inline">Reddit</span>
                        </a>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
