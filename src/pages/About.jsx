import React from 'react';
import { motion } from 'framer-motion';
import { Shield, Users, TrendingUp, Lock } from 'lucide-react';
import Footer from '../components/Footer';

const About = () => {
    return (
        <div className="min-h-screen bg-black text-white font-sans selection:bg-gold selection:text-black pt-24">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-20"
                >
                    <h1 className="text-5xl md:text-7xl font-bold mb-6">About <span className="text-gold">M.I.C.</span></h1>
                    <p className="text-xl text-gray-400 max-w-3xl mx-auto">
                        We are engineers, traders, and data scientists building the future of retail wealth management.
                    </p>
                </motion.div>

                {/* Mission Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center mb-24">
                    <motion.div
                        initial={{ opacity: 0, x: -50 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                    >
                        <h2 className="text-3xl font-bold mb-6">Our Mission</h2>
                        <div className="w-20 h-1 bg-gold mb-6"></div>
                        <p className="text-gray-300 text-lg leading-relaxed mb-6">
                            For too long, institutional-grade financial strategies have been locked behind closed doors, accessible only to hedge funds and the ultra-wealthy.
                        </p>
                        <p className="text-gray-300 text-lg leading-relaxed">
                            M.I.C. (Market Intelligence Center) was founded in 2024 with a single goal: to democratize access to advanced portfolio algorithms. We believe that technology should level the playing field, giving every investor the tools to complete with Wall Street.
                        </p>
                        <p className="text-gray-300 text-lg leading-relaxed mt-4">
                            Unlike traditional platforms that stop at recommending "top picks", M.I.C. goes further. We simplify wealth management by fully automating the allocation and execution process. This ensures you capture the opportunities we identify without the stress of manual trading or complex rebalancing.
                        </p>
                    </motion.div>
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        className="bg-white/5 p-8 rounded-2xl border border-white/10"
                    >
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-black/40 p-6 rounded-xl text-center">
                                <TrendingUp className="mx-auto text-gold mb-3" size={32} />
                                <div className="font-bold text-2xl text-white">2024</div>
                                <div className="text-sm text-gray-400">Established</div>
                            </div>
                            <div className="bg-black/40 p-6 rounded-xl text-center">
                                <Users className="mx-auto text-gold mb-3" size={32} />
                                <div className="font-bold text-2xl text-white">Global</div>
                                <div className="text-sm text-gray-400">Community</div>
                            </div>
                            <div className="bg-black/40 p-6 rounded-xl text-center col-span-2">
                                <Shield className="mx-auto text-gold mb-3" size={32} />
                                <div className="font-bold text-2xl text-white">Data-First</div>
                                <div className="text-sm text-gray-400">Approach</div>
                            </div>
                        </div>
                    </motion.div>
                </div>

                {/* Values Section */}
                <div className="mb-24">
                    <h2 className="text-3xl font-bold text-center mb-16">Our Core Values</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {[
                            {
                                icon: Shield,
                                title: "Transparency",
                                desc: "We believe in being open about our strategies, risks, and performance. No black boxes, just clear data."
                            },
                            {
                                icon: Lock,
                                title: "Security",
                                desc: "Your trust is everything. We use bank-grade security and never take custody of your funds."
                            },
                            {
                                icon: TrendingUp,
                                title: "Performance",
                                desc: "We are relentless in our pursuit of alpha. Our models are constantly backtested, forward-tested, and refined."
                            }
                        ].map((item, idx) => (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.2 }}
                                viewport={{ once: true }}
                                className="p-8 bg-white/5 rounded-xl border border-white/10 hover:border-gold/30 transition-colors"
                            >
                                <item.icon className="text-gold mb-6" size={40} />
                                <h3 className="text-xl font-bold mb-4">{item.title}</h3>
                                <p className="text-gray-400 leading-relaxed">{item.desc}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>

                {/* Team Placeholder */}
                <div className="mb-24 text-center">
                    <h2 className="text-3xl font-bold mb-12">The Team</h2>
                    <p className="text-gray-400 max-w-2xl mx-auto mb-12">
                        M.I.C. is built by a distributed team of senior software engineers, quantitative analysts, and financial data experts.
                    </p>
                    <div className="flex justify-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-gold/20 to-gold/5 border border-gold/30" />
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500/20 to-blue-500/5 border border-blue-500/30" />
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500/20 to-purple-500/5 border border-purple-500/30" />
                    </div>
                </div>

            </div>
            <Footer />
        </div>
    );
};

export default About;
