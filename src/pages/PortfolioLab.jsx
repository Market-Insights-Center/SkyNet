import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Layers, Zap, Sprout, Activity, ArrowRight } from 'lucide-react';
import WaveBackground from '../components/WaveBackground';

const Hero = () => {
    return (
        <section className="relative h-[50vh] flex items-center justify-center overflow-hidden bg-[#2D1B4E]">
            {/* Complex Fluid Background Animation */}
            <div className="absolute inset-0 w-full h-full overflow-hidden z-0 pointer-events-none">
                <WaveBackground />
            </div>

            {/* Overlay for readability - Reduced opacity */}
            <div className="absolute inset-0 bg-black/10 z-0 backdrop-blur-[0px]" />

            {/* Content */}
            <div className="relative z-10 text-center px-4">
                <motion.h1
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="text-5xl md:text-7xl font-bold text-white mb-4 tracking-tight drop-shadow-2xl"
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

            {/* Fade gradient to next section */}
            <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-deep-black to-transparent z-10" />
        </section>
    );
};

const CommandCard = ({ title, desc, icon: Icon, path, delay }) => {
    return (
        <Link to={path} className="block group h-full relative z-20">
            <motion.div
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: delay }}
                whileHover={{ scale: 1.02, translateY: -5 }}
                // UPDATED: Removed bg-white/5 to eliminate the "shaded box" effect
                className="relative h-full p-6 bg-transparent border border-white/10 rounded-xl overflow-hidden transition-all duration-300 group-hover:border-gold group-hover:shadow-[0_0_20px_rgba(212,175,55,0.6)]"
            >
                {/* Slight internal gold glow layer */}
                <div className="absolute inset-0 bg-gold/0 group-hover:bg-gold/5 transition-colors duration-300 z-0" />

                <div className="relative z-10 flex flex-col h-full">
                    <div className="mb-4 p-3 bg-transparent border border-white/10 rounded-lg w-fit text-gold transition-all duration-300 group-hover:text-white group-hover:bg-gold group-hover:shadow-[0_0_15px_rgba(212,175,55,0.5)]">
                        <Icon size={32} />
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-2 group-hover:text-gold transition-colors duration-300">{title}</h3>
                    <p className="text-gray-400 group-hover:text-gray-200 transition-colors duration-300 flex-grow">{desc}</p>

                    {/* Activate Protocol Arrow that appears on hover */}
                    <div className="mt-4 flex items-center text-gold text-sm font-medium opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-[-10px] group-hover:translate-x-0">
                        Activate Protocol <ArrowRight size={16} className="ml-2" />
                    </div>
                </div>
            </motion.div>
        </Link>
    );
};

const PortfolioLab = () => {
    const cards = [
        {
            title: "Custom Builder",
            desc: "Build complex, multi-layered strategies from the ground up.",
            icon: Layers,
            path: "/custom",
            delay: 0.1
        },
        {
            title: "Quick Invest",
            desc: "Rapidly generate weighted allocations for a basket of assets.",
            icon: Zap,
            path: "/invest",
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