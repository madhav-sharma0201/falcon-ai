import { useNavigate } from "react-router-dom";
import { BsStars } from "react-icons/bs";
import PricingCard from "../components/PricingCard";

import { FiMenu, FiX } from "react-icons/fi";
import { useState } from "react";

import axios from "axios";
import api from "../utils/axios";
function Coin() {
    return <BsStars className="text-yellow-400" size={14} />;
}

const plans = [
    {
        title: "Free",
        price: "Free",
        coins: 150,
        button: "Claimed Coins",
        popular: false,
        disabled: true,
        features: [
            "150 Interview Coins",
            "Resume Builder",
            "Resume Scorer",
            "Roadmap Generator",
        ],
    },
    {
        title: "Starter",
        price: "199",
        coins: 300,
        button: "Buy Now",
        popular: true,
        disabled: false,
        features: [
            "300 Interview Coins",
            "Unlimited Resume Score",
            "Unlimited Roadmaps",
            "Priority AI Response",
        ],
    },
];


export default function Pricing({ user, setUser }) {
    const navigate = useNavigate();
    const [showMenu, setShowMenu] = useState(false);


    const handlePayment = async (plan) => {
        if (plan.disabled) return;

        try {

            const result = await api.post(
                "/api/billing/create",
                {
                    planId: plan.title.toLowerCase(),
                }
               
            );

            const options = {
                key: import.meta.env.VITE_RAZORPAY_KEY_ID,
                amount: result.data.order.amount,
                currency: result.data.order.currency,
                name: "Fresher.AI",
                description: `${plan.title} - ${plan.coins} Interview Coins`,
                order_id: result.data.order.id,

               handler: async function (response) {
    try {
        // Verify the payment. The server credits the coins itself once the
        // Razorpay signature checks out — the client no longer asks for them,
        // because anything the client can ask for, it can ask for without paying.
        const verifyRes = await api.post("/api/billing/verify", response);

        if (verifyRes.data?.interviewCoin !== undefined && verifyRes.data?.interviewCoin !== null) {
            setUser((prev) => ({
                ...prev,
                interviewCoin: verifyRes.data.interviewCoin,
            }));
        }

        alert(
            verifyRes.data?.coinsCredited === false
                ? verifyRes.data.message
                : "Payment Successful 🎉"
        );
        navigate("/dashboard");

    } catch (error) {
        console.log(error);

        alert(
            error?.response?.data?.message ||
            "Payment verification failed"
        );
    }
},

                theme: {
                    color: "#000000",
                },
            };

            const razorpay = new window.Razorpay(options);
            razorpay.open();

        } catch (err) {
            console.log(err);
        }
    };


    return (
        <div className="min-h-screen bg-white text-[#0A0A0A]">

            {/* Navbar */}
            <nav className="sticky top-0 z-20 border-b border-black/8 bg-white/80 backdrop-blur-xl">
                <div className="mx-auto flex h-12 max-w-7xl items-center justify-between px-3 sm:px-5">

                    <div
                        onClick={() => navigate("/dashboard")}
                        className="flex cursor-pointer items-center gap-1.5"
                    >
                        <span className="text-base font-extrabold tracking-tight text-[#0A0A0A]">
                            Fresher.AI
                        </span>

                        <span className="hidden rounded bg-black/5 px-1.5 py-0.5 text-[10px] text-black/50 sm:block">
                            Interview Coins
                        </span>
                    </div>

                    <div className="relative">

                        <button
                            onClick={() => setShowMenu(!showMenu)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-black/15 text-black/60 transition hover:border-black/35 hover:text-[#0A0A0A]"
                        >
                            {showMenu ? <FiX size={16} /> : <FiMenu size={16} />}
                        </button>

                        {showMenu && (
                            <>
                                {/* Mobile Backdrop */}
                                <div
                                    onClick={() => setShowMenu(false)}
                                    className="fixed inset-0 z-30 bg-black/20 lg:hidden"
                                />

                                {/* Popup — black glass */}
                                <div className="absolute right-0 top-10 z-40 w-[240px] max-w-[calc(100vw-24px)] rounded-xl overflow-hidden bg-[#000000]/90 backdrop-blur-2xl border border-white/10 p-3.5 shadow-[0_8px_32px_rgba(0,0,0,0.25)]">

                                    {/* glass sheen */}
                                    <div className="absolute inset-0 bg-gradient-to-br from-white/[0.08] via-transparent to-transparent pointer-events-none" />

                                    {/* Coins */}
                                    <div className="relative flex items-center gap-2 border-b border-white/10 pb-3">
                                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-yellow-500/15 border border-yellow-400/20">
                                            <BsStars className="text-yellow-400 text-sm" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-white/40">
                                                Available Coins
                                            </p>
                                            <h2 className="text-lg font-bold text-white">
                                                {user?.interviewCoin}
                                            </h2>
                                        </div>
                                    </div>

                                    {/* Coin Usage */}
                                    <div className="relative mt-3.5 space-y-1.5">
                                        {[
                                            { title: "Resume Builder", coin: "-10" },
                                            { title: "Resume Scorer", coin: "-10" },
                                            { title: "Roadmap Generator", coin: "-20" },
                                            { title: "AI Interview", coin: "-50" },
                                        ].map((item) => (
                                            <div
                                                key={item.title}
                                                className="flex items-center justify-between rounded-lg bg-white/5 border border-white/8 px-2.5 py-1.5"
                                            >
                                                <span className="text-xs text-white/70">
                                                    {item.title}
                                                </span>
                                                <span className="text-xs font-bold text-red-400">
                                                    {item.coin}
                                                </span>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Bottom Info */}
                                    <div className="relative mt-3.5 rounded-lg border border-violet-400/20 bg-violet-500/10 p-2.5">
                                        <p className="text-[10px] leading-4 text-violet-300">
                                            Every AI feature uses Interview Coins.
                                            Buy more coins anytime to continue using
                                            Resume Builder, Resume Scorer,
                                            AI Interview and Roadmap Generator.
                                        </p>
                                    </div>

                                </div>
                            </>
                        )}

                    </div>

                </div>
            </nav>

            <div className="mx-auto max-w-4xl px-4 py-6">

                <div className="text-center">
                    <h1 className="text-3xl font-bold text-[#0A0A0A]">
                        Interview Coins
                    </h1>
                    <p className="mt-2 text-sm text-black/45">
                        Use coins for Resume Scoring, Resume Builder, AI Interviews, and Roadmap Generation.
                    </p>
                </div>

                <div className="mt-8 grid place-items-center gap-3 md:grid-cols-2">
                    {plans.map((plan) => (
                        <PricingCard
                            key={plan.title}
                            {...plan}
                            onBuy={() => handlePayment(plan)}
                        />
                    ))}
                </div>

            </div>
        </div>

    );
}