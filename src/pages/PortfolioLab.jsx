import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Layers, Zap, Sprout, Activity } from 'lucide-react';

const Hero = () => {
    return (
        <section className="relative h-[40vh] flex items-center justify-center overflow-hidden">
            {/* Placeholder for Video Background */}
            <div className="absolute inset-0 bg-gradient-to-b from-black via-deep-black/50 to-deep-black z-0">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-royal-purple/30 via-transparent to-transparent opacity-50" />
            </div>

            <div className="relative z-10 text-center px-4">
                <motion.h1
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="text-5xl md:text-7xl font-bold text-gold mb-4 tracking-tight"
                >
                    Portfolio Laboratory
                </motion.h1>
                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
                    className="text-xl md:text-2xl text-white/80 font-light tracking-wide"
                >
                    Design. Test. Execute.
                </motion.p>
            </div>

            {/* Fade transition to next section */}
            <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-deep-black to-transparent" />
        </section>
    );
};

const CommandCard = ({ title, desc, icon: Icon, path, delay }) => {
    return (
        <Link to={path} className="block group">
            <motion.div
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: delay }}
                whileHover={{ scale: 1.02 }}
                className="relative h-full p-6 bg-white/5 border border-white/10 rounded-xl overflow-hidden transition-all duration-300 hover:border-gold/50 hover:shadow-[0_0_30px_-10px_rgba(212,175,55,0.3)]"
            >
                <div className="absolute inset-0 bg-gradient-to-br from-royal-purple/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                <div className="relative z-10 flex flex-col h-full">
                    <div className="mb-4 p-3 bg-white/5 rounded-lg w-fit text-gold group-hover:text-white group-hover:bg-gold transition-colors duration-300">
                        <Icon size={32} />
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-2 group-hover:text-gold transition-colors duration-300">{title}</h3>
                    <p className="text-gray-400 group-hover:text-gray-200 transition-colors duration-300 flex-grow">{desc}</p>
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {cards.map((card, index) => (
                        <CommandCard key={index} {...card} />
                    ))}
                </div>
            </div>
        </div>
    );
};

export default PortfolioLab;
