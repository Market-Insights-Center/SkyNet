import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Layers, Zap, Sprout, Activity, ArrowRight, Database } from 'lucide-react';
import WaveBackground from '../components/WaveBackground';
import TiltCard from '../components/TiltCard';

const Hero = () => {
    return (
        <section className="relative h-[40vh] flex items-center justify-center overflow-hidden bg-transparent">
            {/* Content */}
            <div className="relative z-10 text-center px-4 mt-10">
                <motion.h1
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="text-5xl md:text-7xl font-bold text-white mb-4 tracking-tight drop-shadow-[0_0_20px_rgba(255,255,255,0.3)]"
                >
                    Portfolio Laboratory
                </motion.h1>
                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
                    className="text-xl md:text-2xl text-gray-100 font-light tracking-wide drop-shadow-lg"
                >
                    Design. Test. Execute.
                </motion.p>
            </div>
        </section>
    );
};

const CommandCard = ({ title, desc, icon: Icon, path, delay }) => {
    return (
        <Link to={path} className="block group h-full relative z-20">
            <TiltCard
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: delay }}
                className="h-full p-6 text-left group-hover:border-gold group-hover:shadow-[0_0_20px_rgba(212,175,55,0.6)]"
            >
                {/* Slight internal gold glow layer */}
                <div className="absolute inset-0 bg-gold/0 group-hover:bg-gold/5 transition-colors duration-300 z-0 rounded-2xl" />

                <div className="relative z-10 flex flex-col h-full">
                    <div className="mb-4 p-3 bg-white/5 border border-white/10 rounded-lg w-fit text-gold transition-all duration-300 group-hover:text-white group-hover:bg-gold group-hover:shadow-[0_0_15px_rgba(212,175,55,0.5)]">
                        <Icon size={32} />
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-2 group-hover:text-gold transition-colors duration-300">{title}</h3>
                    <p className="text-gray-400 group-hover:text-gray-200 transition-colors duration-300 flex-grow">{desc}</p>

                    {/* Activate Protocol Arrow that appears on hover */}
                    <div className="mt-4 flex items-center text-gold text-sm font-medium opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-[-10px] group-hover:translate-x-0">
                        Activate Protocol <ArrowRight size={16} className="ml-2" />
                    </div>
                </div>
            </TiltCard>
        </Link>
    );
};

const PortfolioLab = () => {
    const cards = [
        {
            title: "Quick Invest",
            desc: "Rapidly generate weighted allocations for a basket of assets.",
            icon: Zap,
            path: "/invest",
            delay: 0.1
        },
        {
            title: "Custom Builder",
            desc: "Build complex, multi-layered strategies from the ground up.",
            icon: Layers,
            path: "/custom",
            delay: 0.2
        },
        {
            title: "Cultivate",
            desc: "Algorithmic diversification based on market capitalization and volume.",
            icon: Sprout,
            path: "/cultivate",
            delay: 0.3
        },
        {
            title: "Portfolio Tracker",
            desc: "Monitor live performance and drift of saved strategies.",
            icon: Activity,
            path: "/tracking",
            delay: 0.4
        },
        {
            title: "Database Codes",
            desc: "Manage and visualize recursive Nexus and Portfolio structures.",
            icon: Database,
            path: "/database-lab",
            delay: 0.5
        }
    ];

    return (
        <div className="pb-20">
            <Hero />
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-10 relative z-20">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 auto-rows-fr">
                    {cards.map((card, index) => (
                        <CommandCard key={index} {...card} />
                    ))}
                </div>
            </div>
        </div>
    );
};

export default PortfolioLab;