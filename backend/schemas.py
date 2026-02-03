from pydantic import BaseModel
from typing import List, Optional, Dict, Any

# --- Chat Models ---
class ChatCreateRequest(BaseModel):
    creator_email: str
    participants: List[str]
    type: str = "general"
    initial_message: Optional[str] = None

class ChatMessageRequest(BaseModel):
    sender: str
    text: str

class ChatDeleteRequest(BaseModel):
    chat_id: str
    email: str

class ChatReadRequest(BaseModel):
    chat_id: str
    email: str

# --- Auth & User Models ---
class UsernameCheckRequest(BaseModel):
    username: str

class UsernameUpdateRequest(BaseModel):
    email: str
    username: str

class UserUpdateRequest(BaseModel):
    target_email: str
    new_tier: str
    requester_email: str

class UserDeleteRequest(BaseModel):
    target_email: str
    requester_email: str

class HeartbeatRequest(BaseModel):
    email: str

# --- Market Data Models ---
class MarketDataRequest(BaseModel):
    tickers: List[str]

class ChartRequest(BaseModel):
    ticker: str
    range: str = "1d" # 1d, 1w, 1m, 1y

class RobinhoodRequest(BaseModel):
    email: str

class ModRequest(BaseModel):
    email: str
    action: Optional[str] = None # add, remove (Optional because get_mods doesn't use it)
    requester_email: str

# --- Content Models (Articles, Ideas, Comments) ---
class ArticleCreateRequest(BaseModel):
    title: str
    subtitle: Optional[str] = None
    content: str
    author: str
    date: str
    hashtags: List[str] = []
    cover_image: Optional[str] = None

class ArticleDeleteRequest(BaseModel):
    id: str
    requester_email: str

class IdeaCreateRequest(BaseModel):
    ticker: str
    title: str
    description: str
    author: str
    date: str
    hashtags: List[str] = []
    cover_image: Optional[str] = None

class IdeaDeleteRequest(BaseModel):
    id: str
    requester_email: str

class VoteRequest(BaseModel):
    user_id: str
    vote_type: str

class ShareRequest(BaseModel):
    platform: str

class EmailShareRequest(BaseModel):
    email: str
    sender_name: str
    article_link: str
    article_title: str

class CommentCreateRequest(BaseModel):
    idea_id: Optional[int] = None
    article_id: Optional[int] = None 
    user_id: str
    user: str
    email: str
    text: str
    date: str

# --- Coupon Models ---
class CouponCreateRequest(BaseModel):
    code: str
    plan_id: str
    tier: str
    discount_label: str
    requester_email: str

class CouponDeleteRequest(BaseModel):
    code: str
    requester_email: str

# --- System & Automation Models ---
class OrionToggleRequest(BaseModel):
    action: str # "start" or "stop"

class SubscriptionVerifyRequest(BaseModel):
    subscriptionId: str
    email: str

# --- Analysis & AI Models ---
class QuickscoreRequest(BaseModel):
    ticker: str
    email: str

class MarketRequest(BaseModel):
    email: str
    market_type: str = "sp500"
    sensitivity: int = 2

class BreakoutRequest(BaseModel):
    email: str

class BriefingRequest(BaseModel):
    email: str

class FundamentalsRequest(BaseModel):
    ticker: str
    email: str

class AssessRequest(BaseModel):
    email: str
    user_id: Optional[str] = None 
    assess_code: str
    tickers_str: Optional[str] = None
    timeframe_str: Optional[str] = None
    risk_tolerance: Optional[int] = None
    backtest_period_str: Optional[str] = None
    manual_portfolio_holdings: Optional[List[Dict[str, Any]]] = None
    custom_portfolio_code: Optional[str] = None
    value_for_assessment: Optional[float] = None
    cultivate_portfolio_code: Optional[str] = None
    use_fractional_shares: Optional[bool] = None
    portfolio_code: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None

class MLForecastRequest(BaseModel):
    email: str
    ticker: str

class SentimentRequest(BaseModel):
    email: str
    ticker: str

class PowerScoreRequest(BaseModel):
    email: str
    ticker: str
    sensitivity: int = 2

class UsageIncrementRequest(BaseModel):
    key: str
    email: Optional[str] = None

class SummaryRequest(BaseModel):
    ticker: str
    email: Optional[str] = "guest"

# --- Nexus & Execution ---
class NexusRequest(BaseModel):
    email: str
    nexus_code: str
    create_new: Optional[bool] = False
    components: Optional[List[Dict[str, Any]]] = None
    total_value: Optional[float] = None
    use_fractional_shares: Optional[bool] = False
    execute_rh: Optional[bool] = False
    rh_user: Optional[str] = None
    rh_pass: Optional[str] = None
    send_email: Optional[bool] = False
    email_to: Optional[str] = None
    overwrite: Optional[bool] = False
    connected_commands: Optional[List[str]] = []

class ExecuteTradesRequest(BaseModel):
    trades: List[Dict[str, Any]]
    rh_username: Optional[str] = None
    rh_password: Optional[str] = None
    email_to: Optional[str] = None
    portfolio_code: Optional[str] = "Unknown"

# --- Banners ---
class BannerCreateRequest(BaseModel):
    text: str
    link: Optional[str] = None
    countdown_target: Optional[str] = None
    type: str  # info, sale, launch
    active: bool = True
    requester_email: str

class BannerUpdateRequest(BaseModel):
    id: int
    text: str
    link: Optional[str] = None
    countdown_target: Optional[str] = None
    type: str # info, sale, launch
    active: bool
    requester_email: str

class BannerDeleteRequest(BaseModel):
    id: int
    requester_email: str

# --- Sentinel ---
class SentinelRequest(BaseModel):
    user_prompt: str
    email: str
    plan: Optional[List[Dict[str, Any]]] = None
    execution_mode: Optional[str] = "auto" # "plan_and_review", "quick_execute", "auto"

# --- Prometheus ---
class PrometheusRequest(BaseModel):
    prompt: str
    email: str
    mode: Optional[str] = "ANALYST" # ANALYST or GOVERNOR

# --- Predictions ---
class PredictionCreateRequest(BaseModel):
    title: str
    stock: str
    end_date: str
    market_condition: str
    wager_logic: str = "binary_odds"
    creator_email: str = "" # Consolidated: optional in some, req in others, setting default to avoid break
    email: Optional[str] = None # Handling dual naming in original file
    category: Optional[str] = "Stocks"

    def __init__(self, **data):
        # Handle email aliasing from the duplicated classes
        if 'email' in data and 'creator_email' not in data:
            data['creator_email'] = data['email']
        super().__init__(**data)

class PredictionDeleteRequest(BaseModel):
    id: str
    email: str

class BetRequest(BaseModel):
    email: str
    prediction_id: str
    choice: str 
    amount: int

class BetPlaceRequest(BaseModel):
    prediction_id: str
    email: str
    amount: int
    choice: str 

# --- Referrals & Points ---
class ReferralRedeemRequest(BaseModel):
    email: str
    code: str
    
class PointsRequest(BaseModel):
    email: str

# --- Automation Storage ---
class AutomationSaveRequest(BaseModel):
    id: str
    name: str = "Untitled"
    active: bool = False
    nodes: List[Dict[str, Any]] = []
    edges: List[Dict[str, Any]] = []
    user_email: str = "guest"
    description: Optional[str] = ""
    last_run: Optional[str] = None
    next_run: Optional[str] = None

class AutomationToggleRequest(BaseModel):
    id: str
    active: bool

class AutomationDeleteRequest(BaseModel):
    id: str

class ShareAutomationRequest(BaseModel):
    automation: Dict[str, Any]
    username: str

class CopyAutomationRequest(BaseModel):
    shared_id: str

# --- Strategy Ranking ---
class RankingSubmitRequest(BaseModel):
    user_email: str
    portfolio_code: str
    interval: str 
    execution_time: Optional[str] = "09:30" 
    timezone: Optional[str] = "UTC" 
    starting_value: Optional[float] = 10000.0

class RankingRemoveRequest(BaseModel):
    user_email: str
    portfolio_code: str

# --- Database Lab ---
class DatabaseSaveRequest(BaseModel):
    type: str 
    data: Dict[str, Any]
    email: str 
    original_id: Optional[str] = None 

class DatabaseDeleteRequest(BaseModel):
    type: str
    id: str
