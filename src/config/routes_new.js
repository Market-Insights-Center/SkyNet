import React from 'react';

// Map of Component Factories for lazy loading
// We keep the factories here so we can call them for prefetching
const components = {
    LandingPage: () => import('../pages/LandingPage'),
    PortfolioLab: () => import('../pages/PortfolioLab'),
    Products: () => import('../pages/Products'),
    MarketJunction: () => import('../pages/MarketJunction'),
    Wizard: () => import('../pages/Wizard'),
    Login: () => import('../pages/Login'),
    SignUp: () => import('../pages/SignUp'),
    Profile: () => import('../pages/Profile'),
    Forum: () => import('../pages/Forum'),
    NewsPage: () => import('../pages/NewsPage'),
    KnowledgeStream: () => import('../pages/KnowledgeStream'),
    ArticleView: () => import('../pages/ArticleView'),
    AdminDashboard: () => import('../pages/AdminDashboard'),
    Chatbox: () => import('../pages/Chatbox'),
    IdeasPage: () => import('../pages/IdeasPage'),
    TermsOfService: () => import('../pages/TermsOfService'),
    PrivacyPolicy: () => import('../pages/PrivacyPolicy'),
    AssetEvaluator: () => import('../pages/AssetEvaluator'),
    ComparisonMatrix: () => import('../pages/ComparisonMatrix'),
    ControlsPage: () => import('../pages/ControlsPage'),
    SidebarPage: () => import('../pages/SidebarPage'),
    Help: () => import('../pages/Help'),
    PortfolioNexus: () => import('../pages/PortfolioNexus'),
    Briefing: () => import('../pages/Briefing'),
    PerformanceStream: () => import('../pages/PerformanceStream'),
    SentinelAI: () => import('../pages/SentinelAI'),
    DatabaseNodes: () => import('../pages/DatabaseNodes'),
    StrategyRanking: () => import('../pages/StrategyRanking'),
    MarketPredictions: () => import('../pages/MarketPredictions'),
    About: () => import('../pages/About'),
    WorkflowAutomation: () => import('../pages/WorkflowAutomation'),
    SingularityInterface: () => import('../pages/SingularityInterface'),
};

// Create React Lazy components
export const LazyRoutes = Object.fromEntries(
    Object.entries(components).map(([key, factory]) => [key, React.lazy(factory)])
);

// Helper to prefetch a route by matching the path to the component key
const routeToComponentMap = {
    '/': 'LandingPage',
    '/portfolio-lab': 'PortfolioLab',
    '/products': 'Products',
    '/market-junction': 'MarketJunction',
    '/custom': 'Wizard',
    '/invest': 'Wizard',
    '/cultivate': 'Wizard',
    '/tracking': 'Wizard',
    '/login': 'Login',
    '/signup': 'SignUp',
    '/profile': 'Profile',
    '/forum': 'Forum',
    '/news': 'NewsPage',
    '/knowledge-stream': 'KnowledgeStream',
    '/admin': 'AdminDashboard',
    '/chat': 'Chatbox',
    '/ideas': 'IdeasPage',
    '/terms': 'TermsOfService',
    '/privacy': 'PrivacyPolicy',
    '/asset-evaluator': 'AssetEvaluator',
    '/products/comparison-matrix': 'ComparisonMatrix',
    '/controls': 'ControlsPage',
    '/sidebar': 'SidebarPage',
    '/help': 'Help',
    '/portfolio-nexus': 'PortfolioNexus',
    '/briefing': 'Briefing',
    '/performance-stream': 'PerformanceStream',
    '/sentinel-ai': 'SentinelAI',
    '/database-lab': 'DatabaseNodes',
    '/strategy-ranking': 'StrategyRanking',
    '/market-predictions': 'MarketPredictions',
    '/about': 'About',
    '/workflow-automation': 'WorkflowAutomation',
    '/singularity': 'SingularityInterface',
};

export const prefetchRoute = (path) => {
    try {
        // Handle simple exact matches
        let componentKey = routeToComponentMap[path];

        // Handle dynamic routes (simple prefix check)
        if (!componentKey) {
            if (path.startsWith('/article/')) componentKey = 'ArticleView';
        }

        if (componentKey && components[componentKey]) {
            components[componentKey]();
        }
    } catch (e) {
        console.warn(`Failed to prefetch route: ${path}`, e);
    }
};
