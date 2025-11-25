import json
import os
import random
from datetime import datetime, timedelta

# --- Paths ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
USERS_FILE = os.path.join(BASE_DIR, 'backend', 'users.json')
ARTICLES_FILE = os.path.join(BASE_DIR, 'backend', 'articles.json')
COMMENTS_FILE = os.path.join(BASE_DIR, 'backend', 'comments.json')

# Ensure backend dir exists (it should)
if not os.path.exists(os.path.join(BASE_DIR, 'backend')):
    os.makedirs(os.path.join(BASE_DIR, 'backend'))

# --- Data Generators ---

def generate_users():
    users = []
    plans = ["Free", "Pro", "Enterprise"]
    
    # Super Admin
    users.append({
        "email": "marketinsightscenter@gmail.com",
        "subscription_plan": "Enterprise",
        "subscription_cost": 99.99
    })

    # Mock Users
    names = ["Alice", "Bob", "Charlie", "David", "Eve", "Frank", "Grace", "Heidi", "Ivan", "Judy"]
    for name in names:
        plan = random.choice(plans)
        cost = 0.0 if plan == "Free" else (29.99 if plan == "Pro" else 99.99)
        users.append({
            "email": f"{name.lower()}@example.com",
            "subscription_plan": plan,
            "subscription_cost": cost
        })
    return users

def generate_articles():
    articles = [
        {
            "id": 1,
            "title": "The Future of AI in Quantitative Trading",
            "subheading": "How machine learning is reshaping market strategies.",
            "content": "Artificial Intelligence is no longer just a buzzword in the financial sector; it's a fundamental driver of change. From predictive analytics to automated execution, AI is enabling traders to process vast amounts of data at speeds previously unimaginable. In this deep dive, we explore the specific algorithms transforming hedge funds and how retail investors can leverage similar tools...",
            "author": "Dr. Elena Vance",
            "date": (datetime.now() - timedelta(days=2)).strftime("%Y-%m-%d"),
            "category": "Technology",
            "hashtags": ["#AI", "#Trading", "#FinTech"],
            "cover_image": "https://images.unsplash.com/photo-1639322537228-f710d846310a?auto=format&fit=crop&q=80&w=1000",
            "likes": 124,
            "dislikes": 5,
            "shares": 30
        },
        {
            "id": 2,
            "title": "Market Volatility: A Strategic Opportunity?",
            "subheading": "Navigating the choppy waters of the current economic climate.",
            "content": "Volatility is often feared, but for the astute investor, it presents unique opportunities. By understanding the underlying causes of market swings—be it geopolitical tension or interest rate adjustments—one can position their portfolio to not just survive, but thrive. We analyze historical volatility patterns and suggest defensive yet profitable postures...",
            "author": "Marcus Thorne",
            "date": (datetime.now() - timedelta(days=5)).strftime("%Y-%m-%d"),
            "category": "Strategy",
            "hashtags": ["#Volatility", "#Investing", "#Strategy"],
            "cover_image": "https://images.unsplash.com/photo-1611974765270-ca1258634369?auto=format&fit=crop&q=80&w=1000",
            "likes": 89,
            "dislikes": 12,
            "shares": 15
        },
        {
            "id": 3,
            "title": "Crypto Regulation: What to Expect in 2025",
            "subheading": "Global governments are tightening the net. Here's what it means for you.",
            "author": "Jessica Bloom",
            "date": datetime.now().strftime("%Y-%m-%d"),
            "category": "Education",
            "hashtags": ["#Options", "#RetailTrading", "#Education"],
            "cover_image": "https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?auto=format&fit=crop&q=80&w=1000",
            "likes": 305,
            "dislikes": 2,
            "shares": 120
        }
    ]
    return articles

def generate_comments():
    comments = [
        {
            "id": 101,
            "article_id": 1,
            "user": "alice@example.com",
            "text": "Great insights! I've been using simple ML models for my portfolio, but the institutional tools described here are on another level.",
            "date": (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d %H:%M"),
            "likes": 5,
            "dislikes": 0,
            "replies": [
                {
                    "user": "bob@example.com",
                    "text": "Totally agree. The barrier to entry is lowering, though.",
                    "date": (datetime.now() - timedelta(hours=20)).strftime("%Y-%m-%d %H:%M")
                }
            ]
        },
        {
            "id": 102,
            "article_id": 1,
            "user": "charlie@example.com",
            "text": "I'm skeptical about AI completely replacing human intuition. There are nuances in the market that algos miss.",
            "date": (datetime.now() - timedelta(hours=5)).strftime("%Y-%m-%d %H:%M"),
            "likes": 2,
            "dislikes": 1,
            "replies": []
        },
        {
            "id": 103,
            "article_id": 3,
            "user": "dave@example.com",
            "text": "Regulation is necessary for mass adoption. We can't have the Wild West forever.",
            "date": (datetime.now() - timedelta(minutes=30)).strftime("%Y-%m-%d %H:%M"),
            "likes": 10,
            "dislikes": 2,
            "replies": []
        },
        {
            "id": 104,
            "article_id": 5,
            "user": "eve@example.com",
            "text": "Covered calls are my bread and butter. Glad to see them mentioned!",
            "date": datetime.now().strftime("%Y-%m-%d %H:%M"),
            "likes": 8,
            "dislikes": 0,
            "replies": [
                {
                    "user": "frank@example.com",
                    "text": "What delta do you usually sell at?",
                    "date": datetime.now().strftime("%Y-%m-%d %H:%M")
                }
            ]
        }
    ]
    return comments

# --- Main Execution ---

def main():
    print("Generating data...")
    
    users = generate_users()
    with open(USERS_FILE, 'w') as f:
        json.dump(users, f, indent=2)
    print(f"Saved {len(users)} users to {USERS_FILE}")

    articles = generate_articles()
    with open(ARTICLES_FILE, 'w') as f:
        json.dump(articles, f, indent=2)
    print(f"Saved {len(articles)} articles to {ARTICLES_FILE}")

    comments = generate_comments()
    with open(COMMENTS_FILE, 'w') as f:
        json.dump(comments, f, indent=2)
    print(f"Saved {len(comments)} comments to {COMMENTS_FILE}")

    print("Data population complete.")

if __name__ == "__main__":
    main()
