import json
import os
import random
from datetime import datetime, timedelta

# --- Paths ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
USERS_FILE = os.path.join(BASE_DIR, 'users.json')
ARTICLES_FILE = os.path.join(BASE_DIR, 'articles.json')
COMMENTS_FILE = os.path.join(BASE_DIR, 'comments.json')

# Ensure backend dir exists
if not os.path.exists(BASE_DIR):
    os.makedirs(BASE_DIR)

def generate_real_articles():
    articles = [
        {
            "id": 1,
            "title": "AI Power Crunch: The Nuclear Data Center Play",
            "subheading": "Tech giants are buying nuclear plants to fuel the AI arms race.",
            "content": """
                <p>The AI revolution has hit a physical wall: electricity. Training a single large language model uses as much energy as 100 homes do in a year. With the US power grid already strained, Big Tech is turning to the only source of carbon-free, 24/7 baseload power available: Nuclear.</p>
                
                <p><strong>The Investment Thesis:</strong></p>
                <p>We are witnessing a structural repricing of power generation assets. The recent deal to restart Three Mile Island for Microsoft is just the first domino. Investors should watch independent power producers (IPPs) like <strong>Vistra (VST)</strong> and <strong>Constellation Energy (CEG)</strong>, which control unregulated nuclear fleets that can sell power at premium data-center rates.</p>
                
                <h3>Key Data Points</h3>
                <ul>
                    <li>Data center power demand is projected to triple by 2030.</li>
                    <li>New Small Modular Reactor (SMR) stocks like Oklo are speculative but represent the long-term solution.</li>
                    <li>Uranium miners (CCJ) provide the raw fuel for this renaissance.</li>
                </ul>
            """,
            "author": "M.I.C. Research",
            "date": datetime.now().strftime("%Y-%m-%d"),
            "category": "Energy",
            "hashtags": ["#Nuclear", "#AI", "#Energy", "#Stocks"],
            "cover_image": "https://images.unsplash.com/photo-1569000972-921b92a92793?auto=format&fit=crop&q=80&w=1000",
            "likes": 142,
            "dislikes": 3,
            "shares": 56,
            "liked_by": [],
            "disliked_by": []
        },
        {
            "id": 2,
            "title": "Interest Rates 2026: Higher for Longer is Real",
            "subheading": "Why the 10-year Treasury yield refuses to break below 4%.",
            "content": """
                <p>Wall Street's consensus for 2025 was aggressive rate cuts. The reality has been a resilient economy and sticky inflation known as the 'No Landing' scenario. As we look toward 2026, the bond market is signaling that the 'neutral rate' of interest has structurally shifted higher.</p>
                
                <p><strong>What this means for your portfolio:</strong></p>
                <p>The era of free money is over. Companies with high debt loads and no profit (zombie companies) will face a refinancing cliff in 2026. Conversely, cash-rich companies earning 5% on their balance sheet cash are in a prime position.</p>
                
                <ul>
                    <li><strong>Actionable Advice:</strong> Keep duration short in fixed income (T-Bills).</li>
                    <li><strong>Sector Watch:</strong> Avoid regional banks heavily exposed to commercial real estate refinancing.</li>
                </ul>
            """,
            "author": "Sarah Connor",
            "date": (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d"),
            "category": "Macro",
            "hashtags": ["#Fed", "#Rates", "#Bonds", "#Economy"],
            "cover_image": "https://images.unsplash.com/photo-1611974765270-ca1258634369?auto=format&fit=crop&q=80&w=1000",
            "likes": 89,
            "dislikes": 15,
            "shares": 23,
            "liked_by": [],
            "disliked_by": []
        },
        {
            "id": 3,
            "title": "Market Breadth: The Rotation Has Begun",
            "subheading": "Moving beyond the Magnificent 7 to the 'S&P 493'.",
            "content": """
                <p>For two years, the S&P 500's gains were driven almost entirely by NVIDIA, Microsoft, and Apple. Q3 2025 marked a turning point. While big tech growth is normalizing, earnings for the rest of the index (the 'S&P 493') are accelerating.</p>
                
                <p><strong>The Rotation Trade:</strong></p>
                <p>Smart money is cycling out of overextended tech winners into undervalued cyclical sectors. We are seeing breakouts in:</p>
                <ul>
                    <li><strong>Industrials:</strong> Fueled by infrastructure spending and onshoring.</li>
                    <li><strong>Financials:</strong> Benefiting from the steepening yield curve.</li>
                    <li><strong>Healthcare:</strong> A defensive play with attractive valuations.</li>
                </ul>
                <p>Diversification is no longer a drag on performance—it's the safety net for 2026.</p>
            """,
            "author": "Dr. A. I. Architect",
            "date": (datetime.now() - timedelta(days=2)).strftime("%Y-%m-%d"),
            "category": "Strategy",
            "hashtags": ["#SP500", "#Rotation", "#Investing", "#Tech"],
            "cover_image": "https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?auto=format&fit=crop&q=80&w=1000",
            "likes": 210,
            "dislikes": 4,
            "shares": 88,
            "liked_by": [],
            "disliked_by": []
        }
    ]
    return articles

def main():
    print("Resetting Database with Real Content...")
    
    # 1. Users (Preserve admin, mock others)
    users = [
        {"email": "marketinsightscenter@gmail.com", "subscription_plan": "Enterprise", "subscription_cost": 99.99},
        {"email": "trader_joe@example.com", "subscription_plan": "Pro", "subscription_cost": 29.99},
        {"email": "quant_algo@example.com", "subscription_plan": "Free", "subscription_cost": 0.0}
    ]
    with open(USERS_FILE, 'w') as f:
        json.dump(users, f, indent=2)
    print(f"Saved {len(users)} users.")

    # 2. Articles
    articles = generate_real_articles()
    with open(ARTICLES_FILE, 'w') as f:
        json.dump(articles, f, indent=2)
    print(f"Saved {len(articles)} articles.")

    # 3. Comments (Wipe)
    with open(COMMENTS_FILE, 'w') as f:
        json.dump([], f, indent=2)
    print("Wiped comments.")

    print("Done.")

if __name__ == "__main__":
    main()