export const PRODUCT_ACCESS = {
    // --- Core Tools ---
    investment_research: { basic: '3/day', pro: '10/day', enterprise: 'NL', singularity: 'NL' },
    cultivate: { basic: '1/week', pro: '3/day', enterprise: '5/day', singularity: 'NL' },
    custom_knowledge: { basic: '1/day', pro: '10/day', enterprise: 'NL', singularity: 'NL' },

    // --- Asset Evaluator Tools ---
    asset_evaluator: { basic: 'NL', pro: 'NL', enterprise: 'NL', singularity: 'NL' }, // Container logic usually separate, but good default
    tracking: { basic: '1/day', pro: '10/day', enterprise: 'NL', singularity: 'NL' },
    risk_analysis: { basic: 'NL', pro: 'NL', enterprise: 'NL', singularity: 'NL' }, // Everyone has access to basic risk? CSV says NL for all?
    history: { basic: 'NA', pro: 'NL', enterprise: 'NL', singularity: 'NL' },

    // --- Advanced Tools ---
    quickscore: { basic: 'NL', pro: '20/day', enterprise: 'NL', singularity: 'NL' },
    market_snapshot: { basic: '3/day', pro: '10/day', enterprise: 'NL', singularity: 'NL' },
    breakout: { basic: 'NA', pro: '3/day', enterprise: '10/day', singularity: 'NL' },

    // --- Singularity / High Tier Exclusives ---
    // Defined as NA for Basic/Pro/Enterprise in older logic, OR restricted now based on user request logic.
    // If strict "Coming Soon" requested for ALL tiers, enable NA here.

    performance_stream: { basic: 'NA', pro: 'NA', enterprise: 'NL', singularity: 'NL' },
    // ^ Historically Enterprise had access. User request implies if "No Access for Basic, Pro, AND Enterprise". 
    // If Enterprise HAS access (NL above), "Coming Soon" logic won't trigger for them. Correct.

    portfolio_nexus: { basic: 'NA', pro: 'NA', enterprise: '5/day', singularity: 'NL' },
    briefing: { basic: 'NA', pro: '3/day', enterprise: '5/day', singularity: 'NL' },

    // --- Future/Testing ---
    // Example of a "Coming Soon" product
    deep_insight: { basic: 'NA', pro: 'NA', enterprise: 'NA', singularity: 'NL' },

    // Sub-tools
    assess: { basic: '3/day', pro: '10/day', enterprise: 'NL', singularity: 'NL' },
    ml_forecast: { basic: 'NA', pro: '5/day', enterprise: '10/day', singularity: 'NL' },
    sentiment: { basic: 'NA', pro: '3/day', enterprise: '5/day', singularity: 'NL' },
    powerscore: { basic: 'NA', pro: 'NA', enterprise: '5/day', singularity: 'NL' }
};

export const TIERS = ['Basic', 'Pro', 'Enterprise', 'Singularity'];

export const checkAccess = (tier, productKey) => {
    const rules = PRODUCT_ACCESS[productKey];
    if (!rules) return { allowed: true, limit: 'NL' }; // Default allow if unknown

    const userTier = tier || 'Basic';
    const limit = rules[userTier.toLowerCase()] || rules[Object.keys(rules).find(k => k.toLowerCase() === userTier.toLowerCase())];

    // Determine if "Coming Soon" applies (Restricted for Basic, Pro, AND Enterprise)
    const isRestrictedForEveryone =
        (rules.basic === 'NA' || rules.basic === '0') &&
        (rules.pro === 'NA' || rules.pro === '0') &&
        (rules.enterprise === 'NA' || rules.enterprise === '0');

    return {
        allowed: limit !== 'NA' && limit !== '0',
        limit: limit,
        isComingSoon: isRestrictedForEveryone
    };
};
