import React from 'react';
import { motion } from 'framer-motion';

const TermsOfService = () => {
    return (
        <div className="min-h-screen bg-black text-white pt-24 pb-12 px-4">
            <div className="max-w-4xl mx-auto">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    <h1 className="text-4xl md:text-5xl font-bold mb-8 text-gold">Terms and Conditions</h1>
                    <p className="text-gray-400 mb-8">Last Updated: {new Date().toLocaleDateString()}</p>

                    <div className="space-y-8 text-gray-300 leading-relaxed">
                        <section>
                            <h2 className="text-2xl font-bold text-white mb-4">1. Acceptance of Terms</h2>
                            <p>
                                By accessing and using the M.I.C. Singularity platform ("the Platform"), you accept and agree to be bound by the terms and provision of this agreement. In addition, when using this Platform's particular services, you shall be subject to any posted guidelines or rules applicable to such services.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-bold text-white mb-4">2. Financial Disclaimer</h2>
                            <p className="mb-4">
                                <strong>M.I.C. Singularity is not a registered investment advisor, broker-dealer, or financial analyst.</strong>
                            </p>
                            <p>
                                The content provided on this Platform, including but not limited to AI-generated signals, portfolio simulations, and community discussions, is for informational and educational purposes only. It does not constitute financial advice, investment recommendations, or an offer to buy or sell any securities.
                            </p>
                            <p className="mt-2">
                                Trading in financial markets involves a high degree of risk and may not be suitable for all investors. You should carefully consider your investment objectives, level of experience, and risk appetite before making any investment decisions. You could sustain a loss of some or all of your initial investment.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-bold text-white mb-4">3. User Conduct</h2>
                            <p>
                                You agree to use the Platform only for lawful purposes. You are prohibited from posting or transmitting any unlawful, threatening, libelous, defamatory, obscene, scandalous, inflammatory, pornographic, or profane material.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-bold text-white mb-4">4. Intellectual Property</h2>
                            <p>
                                All content included on this site, such as text, graphics, logos, button icons, images, audio clips, digital downloads, data compilations, and software, is the property of M.I.C. Singularity or its content suppliers and protected by international copyright laws.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-bold text-white mb-4">5. Limitation of Liability</h2>
                            <p>
                                In no event shall M.I.C. Singularity be liable for any direct, indirect, incidental, special, exemplary, or consequential damages (including, but not limited to, procurement of substitute goods or services; loss of use, data, or profits; or business interruption) however caused and on any theory of liability, whether in contract, strict liability, or tort (including negligence or otherwise) arising in any way out of the use of this Platform.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-bold text-white mb-4">6. Modifications to Terms</h2>
                            <p>
                                We reserve the right to change these terms at any time. Your continued use of the Platform following the posting of changes will mean that you accept and agree to the changes.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-bold text-white mb-4">7. Contact Information</h2>
                            <p>
                                If you have any questions about these Terms, please contact us at marketinsightscenter@gmail.com.
                            </p>
                        </section>
                    </div>
                </motion.div>
            </div>
        </div>
    );
};

export default TermsOfService;
