import React from 'react';
import { Link } from 'react-router-dom';
import { Twitter, Linkedin, Github, Mail, Instagram, MessageCircle } from 'lucide-react';
import LogoLoop from './LogoLoop';

const Footer = () => {
    return (
        <footer className="bg-black border-t border-white/10 py-12 px-4">
            <div className="max-w-7xl mx-auto">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
                    <div className="col-span-1">
                        <Link to="/" className="text-2xl font-bold tracking-wider text-white flex items-center gap-2 mb-4">
                            M.I.C.
                        </Link>
                        <p className="text-gray-400 text-sm leading-relaxed mb-6">
                            Advanced AI-driven wealth management for the modern investor.
                            Institutional-grade strategies, democratized for everyone.
                        </p>

                    </div>

                    <div>
                        <h4 className="text-white font-bold mb-6 uppercase tracking-wider text-xs border-b border-white/10 pb-2 inline-block">Company</h4>
                        <ul className="space-y-3 text-sm">
                            <li><Link to="/about" className="text-gray-400 hover:text-gold transition-colors flex items-center gap-2 hover:translate-x-1 duration-200">About Us</Link></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="text-white font-bold mb-6 uppercase tracking-wider text-xs border-b border-white/10 pb-2 inline-block">Platform</h4>
                        <ul className="space-y-3 text-sm">
                            <li><Link to="/products" className="text-gray-400 hover:text-gold transition-colors flex items-center gap-2 hover:translate-x-1 duration-200">Products Suite</Link></li>
                            <li><Link to="/portfolio-lab" className="text-gray-400 hover:text-gold transition-colors flex items-center gap-2 hover:translate-x-1 duration-200">Portfolio Lab</Link></li>
                            <li><Link to="/market-junction" className="text-gray-400 hover:text-cyan-400 transition-colors flex items-center gap-2 hover:translate-x-1 duration-200">Market Junction</Link></li>
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
                            <li><Link to="/chat?action=contact_support" className="text-gray-400 hover:text-gold transition-colors flex items-center gap-2 hover:translate-x-1 duration-200">Support Chat</Link></li>
                            <li><Link to="/terms" className="text-gray-400 hover:text-gold transition-colors flex items-center gap-2 hover:translate-x-1 duration-200">Terms of Service</Link></li>
                            <li><Link to="/privacy" className="text-gray-400 hover:text-gold transition-colors flex items-center gap-2 hover:translate-x-1 duration-200">Privacy Policy</Link></li>
                        </ul>
                    </div>
                </div>

                <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
                    <p className="text-gray-500 text-sm">
                        &copy; 2024-{new Date().getFullYear()} Market Insights Center LLC. All rights reserved.
                    </p>
                    <div className="w-full md:w-1/2 overflow-hidden">
                        <LogoLoop
                            speed={50}
                            gap={80}
                            logoHeight={32}
                            pauseOnHover={true}
                            fadeOut={false}
                            logos={[
                                {
                                    node: (
                                        <a href="https://x.com/MarketInsightsC" target="_blank" rel="noreferrer" className="text-gray-400 hover:text-white transition-colors flex items-center gap-2">
                                            <Twitter size={20} /> <span className="font-mono text-xs uppercase tracking-wider">Twitter</span>
                                        </a>
                                    ),
                                    title: "Twitter"
                                },
                                {
                                    node: (
                                        <a href="https://www.instagram.com/insights.center/" target="_blank" rel="noreferrer" className="text-gray-400 hover:text-white transition-colors flex items-center gap-2">
                                            <Instagram size={20} /> <span className="font-mono text-xs uppercase tracking-wider">Instagram</span>
                                        </a>
                                    ),
                                    title: "Instagram"
                                },
                                {
                                    node: (
                                        <a href="https://www.reddit.com/r/MarketInsightsCenter/" target="_blank" rel="noreferrer" className="text-gray-400 hover:text-white transition-colors flex items-center gap-2">
                                            <RedditIcon size={20} /> <span className="font-mono text-xs uppercase tracking-wider">Reddit</span>
                                        </a>
                                    ),
                                    title: "Reddit"
                                },
                                // Repeat for visual density if needed, or rely on component copy logic.
                                // Adding duplicates here to ensure immediate fullness if container is wide
                                {
                                    node: (
                                        <a href="https://x.com/MarketInsightsC" target="_blank" rel="noreferrer" className="text-gray-400 hover:text-white transition-colors flex items-center gap-2">
                                            <Twitter size={20} /> <span className="font-mono text-xs uppercase tracking-wider">Twitter</span>
                                        </a>
                                    ),
                                    title: "Twitter_Copy"
                                },
                                {
                                    node: (
                                        <a href="https://www.instagram.com/insights.center/" target="_blank" rel="noreferrer" className="text-gray-400 hover:text-white transition-colors flex items-center gap-2">
                                            <Instagram size={20} /> <span className="font-mono text-xs uppercase tracking-wider">Instagram</span>
                                        </a>
                                    ),
                                    title: "Instagram_Copy"
                                },
                                {
                                    node: (
                                        <a href="https://www.reddit.com/r/MarketInsightsCenter/" target="_blank" rel="noreferrer" className="text-gray-400 hover:text-white transition-colors flex items-center gap-2">
                                            <RedditIcon size={20} /> <span className="font-mono text-xs uppercase tracking-wider">Reddit</span>
                                        </a>
                                    ),
                                    title: "Reddit_Copy"
                                }
                            ]}
                        />
                    </div>
                </div>
            </div>
        </footer>
    );
};

// Custom Reddit Icon
const RedditIcon = ({ size = 20, className = "" }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="currentColor"
        className={className}
        xmlns="http://www.w3.org/2000/svg"
    >
        <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z" />
    </svg>
);

export default Footer;
