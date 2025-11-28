import React from 'react';
import { Link } from 'react-router-dom';
import { Twitter, Linkedin, Github, Mail } from 'lucide-react';

const Footer = () => {
    return (
        <footer className="bg-black border-t border-white/10 py-12 px-4">
            <div className="max-w-7xl mx-auto">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
                    <div className="col-span-1 md:col-span-2">
                        <Link to="/" className="text-2xl font-bold tracking-wider text-white flex items-center gap-2 mb-4">
                            M.I.C. <span className="text-gold">SINGULARITY</span>
                        </Link>
                        <p className="text-gray-400 max-w-sm">
                            Advanced AI-driven wealth management for the modern investor. 
                            Institutional-grade strategies, democratized.
                        </p>
                    </div>
                    
                    <div>
                        <h4 className="text-white font-bold mb-4 uppercase tracking-wider text-sm">Platform</h4>
                        <ul className="space-y-2">
                            <li><Link to="/portfolio-lab" className="text-gray-400 hover:text-gold transition-colors">Portfolio Lab</Link></li>
                            <li><Link to="/products" className="text-gray-400 hover:text-gold transition-colors">Products</Link></li>
                            <li><Link to="/forum" className="text-gray-400 hover:text-gold transition-colors">Community</Link></li>
                            <li><Link to="/news" className="text-gray-400 hover:text-gold transition-colors">News Feed</Link></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="text-white font-bold mb-4 uppercase tracking-wider text-sm">Legal</h4>
                        <ul className="space-y-2">
                            <li><Link to="/terms" className="text-gray-400 hover:text-gold transition-colors">Terms & Conditions</Link></li>
                            <li><Link to="/privacy" className="text-gray-400 hover:text-gold transition-colors">Privacy Policy</Link></li>
                        </ul>
                    </div>
                </div>

                <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
                    <p className="text-gray-500 text-sm">
                        &copy; {new Date().getFullYear()} M.I.C. Singularity. All rights reserved.
                    </p>
                    <div className="flex items-center gap-6">
                        <a href="#" className="text-gray-400 hover:text-white transition-colors"><Twitter size={20} /></a>
                        <a href="#" className="text-gray-400 hover:text-white transition-colors"><Linkedin size={20} /></a>
                        <a href="#" className="text-gray-400 hover:text-white transition-colors"><Github size={20} /></a>
                        <a href="#" className="text-gray-400 hover:text-white transition-colors"><Mail size={20} /></a>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
