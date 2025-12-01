import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Lock, ArrowRight } from 'lucide-react';
import { PayPalButtons } from "@paypal/react-paypal-js";
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

// Get the default plan ID from environment variables as a fallback/default
const DEFAULT_PLAN_ID = import.meta.env.VITE_PAYPAL_DEFAULT_PLAN_ID; //

const SubscriptionCard = ({ title, price, period, planId, features, isPopular, delay }) => {
    const { currentUser, refreshUserProfile } = useAuth();
    const navigate = useNavigate();
    const [error, setError] = useState(null);
    const [showPayment, setShowPayment] = useState(false);

    // Coupon State
    const [promoCode, setPromoCode] = useState('');
    // Use the prop planId, but fall back to the environment variable if the prop is not passed.
    const [activePlanId, setActivePlanId] = useState(planId || DEFAULT_PLAN_ID);
    const [discountLabel, setDiscountLabel] = useState(null);
    const [isVerifyingCode, setIsVerifyingCode] = useState(false);

    const handleApplyCoupon = async () => {
        if (!promoCode) return;
        setIsVerifyingCode(true);
        try {
            const res = await fetch(`/api/coupons/validate?code=${promoCode}`);
            const data = await res.json();
            if (data.valid) {
                setActivePlanId(data.plan_id);
                setDiscountLabel(data.label);
                setError(null);
            } else {
                setError("Invalid coupon code.");
            }
        } catch (err) {
            setError("Could not verify coupon.");
        } finally {
            setIsVerifyingCode(false);
        }
    };

    const handleApprove = async (data) => {
        try {
            const response = await fetch('/api/subscriptions/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subscriptionId: data.subscriptionID,
                    email: currentUser.email
                }),
            });
            const result = await response.json();
            if (result.status === 'success') {
                alert(`Welcome to ${title}! Your subscription is active.`);
                // Refresh profile to update UI immediately
                await refreshUserProfile(currentUser);
                navigate('/profile');
            } else {
                throw new Error(result.message);
            }
        } catch (err) {
            console.error("Verification failed:", err);
            setError("Payment successful, but verification failed. Please contact support.");
        }
    };

    // --- Logic for Button State ---
    const isCurrentPlan = currentUser?.tier === title;

    // Default label based on price
    let buttonLabel = price === "$0" ? "Current Plan" : "Start Free Trial";

    // Override if user is already on this tier
    if (isCurrentPlan) {
        buttonLabel = "You currently are on this tier";
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: delay }}
            className={`relative p-8 rounded-2xl border ${isPopular ? 'border-gold bg-gold/5' : 'border-white/10 bg-white/5'} flex flex-col h-full hover:transform hover:-translate-y-2 transition-all duration-300`}
        >
            {isPopular && (
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-gold text-black px-4 py-1 rounded-full text-sm font-bold">
                    Most Popular
                </div>
            )}

            <h3 className={`text-2xl font-bold mb-2 ${isPopular ? 'text-gold' : 'text-white'}`}>{title}</h3>

            <div className="flex items-baseline mb-2">
                <span className="text-4xl font-bold text-white">{price}</span>
                <span className="text-gray-400 ml-1">{period}</span>
            </div>

            {discountLabel && (
                <div className="mb-4 inline-block bg-green-500/20 text-green-400 text-xs px-2 py-1 rounded border border-green-500/30">
                    Coupon Applied: {discountLabel}
                </div>
            )}

            <ul className="space-y-4 mb-8 flex-grow">
                {features.map((feature, index) => (
                    <li key={index} className="flex items-center text-gray-300">
                        <Check size={18} className="text-gold mr-3 flex-shrink-0" />
                        {feature}
                    </li>
                ))}
            </ul>

            {/* Promo Code Field (Hide if current plan or free) */}
            {price !== "$0" && !isCurrentPlan && (
                <div className="mb-4">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder="Promo Code"
                            value={promoCode}
                            onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                            className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-xs text-white"
                        />
                        <button
                            onClick={handleApplyCoupon}
                            disabled={isVerifyingCode}
                            className="bg-white/10 hover:bg-white/20 text-white text-xs px-3 rounded"
                        >
                            {isVerifyingCode ? '...' : 'Apply'}
                        </button>
                    </div>
                </div>
            )}

            <div className="mt-auto">
                {!currentUser ? (
                    <button
                        onClick={() => navigate('/login')}
                        className="w-full py-3 rounded-lg font-bold bg-white/10 text-white hover:bg-white/20 transition-colors flex items-center justify-center gap-2"
                    >
                        <Lock size={18} /> Login to Subscribe
                    </button>
                ) : isCurrentPlan ? (
                    <button
                        disabled
                        className="w-full py-3 rounded-lg font-bold bg-white/10 text-white/50 cursor-not-allowed border border-white/5"
                    >
                        {buttonLabel}
                    </button>
                ) : !showPayment ? (
                    <button
                        onClick={() => setShowPayment(true)}
                        className="w-full py-3 rounded-lg font-bold bg-gold text-black hover:bg-yellow-500 transition-colors flex items-center justify-center gap-2"
                    >
                        {buttonLabel} <ArrowRight size={18} />
                    </button>
                ) : (
                    <div className="w-full relative z-0 animate-fadeIn bg-black/20 p-2 rounded-xl">
                        <PayPalButtons
                            key={activePlanId}
                            style={{
                                shape: 'pill',
                                color: 'black',
                                layout: 'vertical',
                                label: 'subscribe'
                            }}
                            createSubscription={(data, actions) => {
                                console.log("Creating subscription for Plan ID:", activePlanId);
                                return actions.subscription.create({
                                    plan_id: activePlanId
                                });
                            }}
                            onApprove={handleApprove}
                            onError={(err) => {
                                console.error("PayPal Error:", err);
                                setError("Payment could not be processed. Check console for details.");
                            }}
                        />
                    </div>
                )}
                {error && <p className="text-red-500 text-xs mt-2 text-center">{error}</p>}
            </div>
        </motion.div>
    );
};

export default SubscriptionCard;