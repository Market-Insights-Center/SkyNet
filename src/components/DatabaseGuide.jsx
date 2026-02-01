import React, { useState } from 'react';
import { X, BookOpen, Layers, Cpu, Activity, ArrowRight, Info } from 'lucide-react';
import nexusDiagram from '../assets/guide/nexus_structure.png';
import portfolioDiagram from '../assets/guide/portfolio_hierarchy.png';
import commandDiagram from '../assets/guide/command_flow.png';

const DatabaseGuide = ({ isOpen, onClose }) => {
    const [activeTab, setActiveTab] = useState('overview');

    if (!isOpen) return null;

    const tabs = [
        { id: 'overview', label: 'Overview', icon: BookOpen },
        { id: 'portfolios', label: 'Portfolios', icon: Layers },
        { id: 'nexus', label: 'Nexus Codes', icon: Cpu },
        { id: 'commands', label: 'Commands', icon: Activity },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-gray-900 border border-gray-700 w-full max-w-5xl h-[85vh] rounded-2xl shadow-2xl flex overflow-hidden flex-col md:flex-row">

                {/* Sidebar Navigation */}
                <div className="w-full md:w-64 bg-black/50 border-r border-gray-800 p-6 flex flex-col gap-2">
                    <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                        <BookOpen className="text-cyan-400" /> Guide
                    </h2>
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${activeTab === tab.id
                                ? 'bg-cyan-900/30 text-cyan-300 border border-cyan-700/50'
                                : 'text-gray-400 hover:bg-white/5 hover:text-white'
                                }`}
                        >
                            <tab.icon size={18} />
                            {tab.label}
                        </button>
                    ))}
                    <div className="mt-auto">
                        <button onClick={onClose} className="w-full px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors">
                            Close Guide
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-8 relative">
                    <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white">
                        <X size={24} />
                    </button>

                    {activeTab === 'overview' && (
                        <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
                            <h1 className="text-3xl font-bold text-white mb-2">Mastering the Database</h1>
                            <p className="text-gray-300 text-lg leading-relaxed">
                                The Database is the central nervous system of SkyNet. It allows you to define complex
                                <span className="text-yellow-400 font-bold"> Portfolios</span> and
                                <span className="text-purple-400 font-bold"> Nexus Codes</span> that drive your trading strategies,
                                tracking, and analysis.
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                                <div className="bg-gray-800/50 p-6 rounded-xl border border-gray-700">
                                    <Layers className="text-yellow-400 mb-4" size={32} />
                                    <h3 className="text-xl font-bold text-white mb-2">Portfolios</h3>
                                    <p className="text-gray-400">
                                        Collections of assets or other portfolios. Build hierarchies like "Tech" containing "Semiconductors" and "Software".
                                    </p>
                                </div>
                                <div className="bg-gray-800/50 p-6 rounded-xl border border-gray-700">
                                    <Cpu className="text-purple-400 mb-4" size={32} />
                                    <h3 className="text-xl font-bold text-white mb-2">Nexus Codes</h3>
                                    <p className="text-gray-400">
                                        Logic gates. Nexus codes combine portfolios with executable <strong>Commands</strong> to make decisions (e.g., "Invest in top 5 breakout stocks").
                                    </p>
                                </div>
                            </div>

                            <div className="mt-8 border-t border-gray-800 pt-8">
                                <h3 className="text-lg font-bold text-white mb-4">Quick Start</h3>
                                <ul className="space-y-3 text-gray-300">
                                    <li className="flex items-start gap-2">
                                        <ArrowRight className="text-cyan-400 mt-1 shrink-0" size={16} />
                                        <span>Click <strong>New Portfolio</strong> to create a list of tickers.</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <ArrowRight className="text-cyan-400 mt-1 shrink-0" size={16} />
                                        <span>Click <strong>New Nexus</strong> to wrap that portfolio with logic.</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <ArrowRight className="text-cyan-400 mt-1 shrink-0" size={16} />
                                        <span>Use these codes in the <strong>Terminal</strong> (e.g., <code>/invest my_nexus_code</code>).</span>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    )}

                    {activeTab === 'portfolios' && (
                        <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
                            <h2 className="text-3xl font-bold text-yellow-400 flex items-center gap-3">
                                <Layers /> Portfolios
                            </h2>
                            <p className="text-gray-300">
                                Portfolios are the building blocks. They hold the "what" — the assets you want to track or trade.
                            </p>

                            <div className="bg-black/30 rounded-xl overflow-hidden border border-yellow-900/30">
                                <img src={portfolioDiagram} alt="Portfolio Hierarchy" className="w-full h-auto object-cover opacity-90 hover:opacity-100 transition-opacity" />
                                <div className="p-4 bg-gray-900/80">
                                    <p className="text-sm text-yellow-200/80 italic">Figure 1: Recursive Portfolio Hierarchy</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h3 className="text-xl font-bold text-white">Features</h3>
                                <div className="space-y-4">
                                    <div className="flex gap-4 p-4 bg-gray-800/30 rounded-lg">
                                        <div className="bg-yellow-500/10 p-2 rounded h-fit"><Layers size={20} className="text-yellow-400" /></div>
                                        <div>
                                            <h4 className="font-bold text-white">Sub-Portfolios</h4>
                                            <p className="text-gray-400 text-sm">You can add existing portfolios into a new one. This allows you to build a "Master Portfolio" composed of smaller sector-specific portfolios.</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-4 p-4 bg-gray-800/30 rounded-lg">
                                        <div className="bg-yellow-500/10 p-2 rounded h-fit"><Info size={20} className="text-yellow-400" /></div>
                                        <div>
                                            <h4 className="font-bold text-white">Cycle Prevention</h4>
                                            <p className="text-gray-400 text-sm">The system prevents you from adding a parent portfolio into its own child, avoiding infinite loops.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-6 border-t border-gray-800 pt-6">
                                <h3 className="text-xl font-bold text-white mb-4">How to Create a Portfolio</h3>
                                <ol className="list-decimal pl-6 space-y-2 text-gray-300">
                                    <li>Click the <strong className="text-yellow-400">New Portfolio</strong> button in the top right.</li>
                                    <li>Enter a unique <strong>Code Name</strong> (e.g., 'TECH_LEADERS').</li>
                                    <li>Click <strong>Add Component</strong>.</li>
                                    <li>Select <strong>Ticker</strong> to add individual stocks (e.g., AAPL) or <strong>Portfolio</strong> to nest another collection.</li>
                                    <li>Assign a <strong>Weight</strong> (0-100%) to each item. Total must be 100%.</li>
                                    <li>Click <strong className="text-green-400">Save</strong> to store your code.</li>
                                </ol>
                            </div>
                        </div>
                    )}

                    {activeTab === 'nexus' && (
                        <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
                            <h2 className="text-3xl font-bold text-purple-400 flex items-center gap-3">
                                <Cpu /> Nexus Codes
                            </h2>
                            <p className="text-gray-300">
                                Nexus Codes are the "brain". They define <strong>how</strong> needed assets are selected and acted upon.
                            </p>

                            <div className="bg-black/30 rounded-xl overflow-hidden border border-purple-900/30">
                                <img src={nexusDiagram} alt="Nexus Structure" className="w-full h-auto object-cover opacity-90 hover:opacity-100 transition-opacity" />
                                <div className="p-4 bg-gray-900/80">
                                    <p className="text-sm text-purple-200/80 italic">Figure 2: Nexus Code Structure</p>
                                </div>
                            </div>

                            <p className="text-gray-300">
                                A Nexus Code is a sequence of items. Items can be:
                            </p>
                            <ul className="list-disc pl-6 space-y-2 text-gray-300">
                                <li><strong className="text-white">Direct Tickers:</strong> Specific stocks (e.g., TSLA).</li>
                                <li><strong className="text-yellow-400">Portfolios:</strong> References to your defined portfolios.</li>
                                <li><strong className="text-cyan-400">Commands:</strong> Logic instructions (Breakout, Market, Cultivate).</li>
                            </ul>

                            <div className="mt-6 border-t border-gray-800 pt-6">
                                <h3 className="text-xl font-bold text-white mb-4">How to Create a Nexus Code</h3>
                                <ol className="list-decimal pl-6 space-y-2 text-gray-300">
                                    <li>Click the <strong className="text-purple-400">New Nexus</strong> button in the top right.</li>
                                    <li>Enter a unique <strong>Code Name</strong> (e.g., 'SMART_V1').</li>
                                    <li>Click <strong>Add Node</strong>.</li>
                                    <li>Choose your building blocks:
                                        <ul className="list-disc pl-6 mt-1 space-y-1 text-gray-400">
                                            <li><strong>Portfolio:</strong> Import a basket of stocks.</li>
                                            <li><strong>Command:</strong> Apply logic (e.g., /breakout) to the items above.</li>
                                        </ul>
                                    </li>
                                    <li>Use <strong>/cultivate</strong> if you want to create an A/B split. Click the 'Code A' / 'Code B' buttons to toggle specific logic for each path.</li>
                                    <li>Click <strong className="text-green-400">Save</strong>.</li>
                                </ol>
                            </div>
                        </div>
                    )}

                    {activeTab === 'commands' && (
                        <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
                            <h2 className="text-3xl font-bold text-cyan-400 flex items-center gap-3">
                                <Activity /> Commands & Logic
                            </h2>
                            <p className="text-gray-300">
                                Commands are special nodes embedded in a Nexus Code that process the tickers/portfolios listed before them.
                            </p>

                            <div className="bg-black/30 rounded-xl overflow-hidden border border-cyan-900/30">
                                <img src={commandDiagram} alt="Command Flow" className="w-full h-auto object-cover opacity-90 hover:opacity-100 transition-opacity" />
                                <div className="p-4 bg-gray-900/80">
                                    <p className="text-sm text-cyan-200/80 italic">Figure 3: Cultivate Command Logic Flow</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-4 mt-4">
                                <div className="border-l-2 border-cyan-500 pl-4 py-2">
                                    <h4 className="font-bold text-white">/breakout</h4>
                                    <p className="text-gray-400 text-sm">Analyzes preceding assets and selects only those showing strong breakout momentum (QuickScore &gt; 80).</p>
                                </div>
                                <div className="border-l-2 border-purple-500 pl-4 py-2">
                                    <h4 className="font-bold text-white">/market</h4>
                                    <p className="text-gray-400 text-sm">Treats the assets as a "Market" index, buying the top performer to capture broad sector movement.</p>
                                </div>
                                <div className="border-l-2 border-pink-500 pl-4 py-2">
                                    <h4 className="font-bold text-white">/cultivate (A/B)</h4>
                                    <p className="text-gray-400 text-sm">
                                        An advanced manual A/B testing tool. It allows you to define two distinct strategies ('Code A' and 'Code B') within one Nexus Code.
                                        <br /><br />
                                        <span className="text-pink-300 font-bold">Important:</span> This is not an automatic AI optimization. You explicitly choose which path (A or B) to execute when running the command. This gives you control to manually toggle between a "Safe" strategy and a "Risky" strategy without rewriting your code.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DatabaseGuide;
