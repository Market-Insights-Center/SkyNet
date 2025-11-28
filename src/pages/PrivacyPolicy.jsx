import React from 'react';
import { motion } from 'framer-motion';

const PrivacyPolicy = () => {
    return (
        <div className="min-h-screen bg-black text-white pt-24 pb-12 px-4">
            <div className="max-w-4xl mx-auto">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    <h1 className="text-4xl md:text-5xl font-bold mb-8 text-gold">Privacy Policy</h1>
                    <p className="text-gray-400 mb-8">Last Updated: {new Date().toLocaleDateString()}</p>

                    <div className="space-y-8 text-gray-300 leading-relaxed">
                        <section>
                            <h2 className="text-2xl font-bold text-white mb-4">1. Introduction</h2>
                            <p>
                                M.I.C. Singularity ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website and use our services.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-bold text-white mb-4">2. Information We Collect</h2>
                            <p className="mb-2">We may collect information about you in a variety of ways. The information we may collect on the Platform includes:</p>
                            <ul className="list-disc pl-6 space-y-2">
                                <li><strong>Personal Data:</strong> Personally identifiable information, such as your name, email address, and telephone number, that you voluntarily give to us when you register with the Platform or when you choose to participate in various activities related to the Platform.</li>
                                <li><strong>Derivative Data:</strong> Information our servers automatically collect when you access the Platform, such as your IP address, your browser type, your operating system, your access times, and the pages you have viewed directly before and after accessing the Platform.</li>
                                <li><strong>Financial Data:</strong> We do not store your credit card numbers or bank account information. All financial transactions are processed through third-party payment processors who adhere to strict security standards.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-2xl font-bold text-white mb-4">3. Use of Your Information</h2>
                            <p>
                                Having accurate information about you permits us to provide you with a smooth, efficient, and customized experience. Specifically, we may use information collected about you via the Platform to:
                            </p>
                            <ul className="list-disc pl-6 mt-2 space-y-2">
                                <li>Create and manage your account.</li>
                                <li>Email you regarding your account or order.</li>
                                <li>Generate a personal profile about you to make future visits to the Platform more personalized.</li>
                                <li>Monitor and analyze usage and trends to improve your experience with the Platform.</li>
                                <li>Prevent fraudulent transactions, monitor against theft, and protect against criminal activity.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-2xl font-bold text-white mb-4">4. Disclosure of Your Information</h2>
                            <p>
                                We may share information we have collected about you in certain situations. Your information may be disclosed as follows:
                            </p>
                            <ul className="list-disc pl-6 mt-2 space-y-2">
                                <li><strong>By Law or to Protect Rights:</strong> If we believe the release of information about you is necessary to respond to legal process, to investigate or remedy potential violations of our policies, or to protect the rights, property, and safety of others, we may share your information as permitted or required by any applicable law, rule, or regulation.</li>
                                <li><strong>Third-Party Service Providers:</strong> We may share your information with third parties that perform services for us or on our behalf, including payment processing, data analysis, email delivery, hosting services, customer service, and marketing assistance.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-2xl font-bold text-white mb-4">5. Security of Your Information</h2>
                            <p>
                                We use administrative, technical, and physical security measures to help protect your personal information. While we have taken reasonable steps to secure the personal information you provide to us, please be aware that despite our efforts, no security measures are perfect or impenetrable, and no method of data transmission can be guaranteed against any interception or other type of misuse.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-bold text-white mb-4">6. Contact Us</h2>
                            <p>
                                If you have questions or comments about this Privacy Policy, please contact us at marketinsightscenter@gmail.com.
                            </p>
                        </section>
                    </div>
                </motion.div>
            </div>
        </div>
    );
};

export default PrivacyPolicy;
