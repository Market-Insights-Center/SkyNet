import time
import threading
from datetime import datetime, timedelta
from backend.firebase_admin_setup import get_db
from firebase_admin import firestore
import yfinance as yf # Added for predictions

# Simple background scheduler loop
def start_scheduler():
    thread = threading.Thread(target=run_schedule, daemon=True)
    thread.start()

def run_schedule():
    print("Starting Points Scheduler...")
    while True:
        try:
            process_pending_points()
            process_singularity_refill()
            process_expiring_predictions() # NEW
        except Exception as e:
            print(f"Scheduler Loop Error: {e}")
        
        # Run every 5 minutes
        time.sleep(300)

def process_pending_points():
    """
    Checks all users for pending transactions that have matured ( > 24h).
    Moves them to main points balance.
    """
    try:
        db = get_db()
        # Query users who have pending_transactions field
        # Note: Firestore doesn't easily support "array is not empty" in standard queries easily without composite index or separate field
        # For small userbase, iterating all users or users with 'pending_transactions' field existence check (if possible) is okay.
        # Better: We'll assume we can iterating all users OR just users who have 'pending_transactions' field (requires index usually).
        
        # Let's iterate all users for safety for now (not scalable but reliable for <10k users)
        # OR better: The frontend sets the field.
        
        users_ref = db.collection('users').stream()
        
        for user in users_ref:
            data = user.to_dict()
            pending = data.get('pending_transactions', [])
            if not pending: continue
            
            updated_pending = []
            points_to_release = 0
            now_ts = datetime.utcnow().timestamp()
            
            changed = False
            for txn in pending:
                release_at = txn.get('release_at', 0)
                if now_ts >= release_at:
                    points_to_release += txn.get('amount', 0)
                    changed = True
                else:
                    updated_pending.append(txn)
            
            if changed:
                # Transactional update to ensure safety
                user_ref = db.collection('users').document(user.id)
                
                @firestore.transactional
                def release_txn(transaction, ref):
                    snap = transaction.get(ref)
                    if not snap.exists: return
                    
                    curr_points = snap.get('points') or 0
                    transaction.update(ref, {
                        'points': curr_points + points_to_release,
                        'pending_transactions': updated_pending
                    })
                
                transaction = db.transaction()
                release_txn(transaction, user_ref)
                print(f"Released {points_to_release} points for {user.id}")

    except Exception as e:
        print(f"Error processing pending points: {e}")

def process_singularity_refill():
    """
    Checks Singularity users.
    If points < 1000:
       If refill_due is None: Set refill_due = now + 24h
       If refill_due < now: Add 10000, Clear refill_due
    If points >= 1000:
       Clear refill_due (reset timer if they recovered)
    """
    try:
        db = get_db()
        # Query Singularity Users
        # Requires index on 'tier' potentially, or just iterate all and check tier (slower but works without index)
        # Assuming we can filter by tier if index exists. If not, error.
        # Let's try filtering.
        try:
            users = db.collection('users').where(field_path='tier', op_string='==', value='Singularity').stream()
        except:
            # Fallback if index missing
             users = db.collection('users').stream()
        
        now = datetime.utcnow()
        
        for user in users:
            data = user.to_dict()
            if data.get('tier') != 'Singularity': continue
            
            email = user.id.lower()
            points = data.get('points', 0)
            refill_due_str = data.get('singularity_refill_due') # ISO string
            refill_due = None
            if refill_due_str:
                refill_due = datetime.fromisoformat(refill_due_str)
            
            user_ref = db.collection('users').document(user.id)
            
            # Special Rule for SuperAdmin
            if email == 'marketinsightscenter@gmail.com':
                 if points < 25000:
                    if not refill_due:
                        new_due = now + timedelta(hours=24)
                        user_ref.update({'singularity_refill_due': new_due.isoformat()})
                        print(f"Started SuperAdmin refill timer for {user.id}")
                    elif now >= refill_due:
                        user_ref.update({
                            'points': points + 25000,
                            'singularity_refill_due': firestore.DELETE_FIELD
                        })
                        print(f"Refilled 25k points for SuperAdmin {user.id}")
                 else:
                     if refill_due:
                         user_ref.update({'singularity_refill_due': firestore.DELETE_FIELD})
                 continue # Skip standard logic

            # Standard Singularity Logic
            if points < 1000:
                if not refill_due:
                    # Start Timer
                    new_due = now + timedelta(hours=24)
                    user_ref.update({'singularity_refill_due': new_due.isoformat()})
                    print(f"Started refill timer for {user.id}")
                elif now >= refill_due:
                    # Grant Refill
                    user_ref.update({
                        'points': points + 10000,
                        'singularity_refill_due': firestore.DELETE_FIELD
                    })
                    print(f"Refilled 10k points for {user.id}")
            else:
                # User has > 1000 points, reset timer if it was active
                if refill_due:
                     user_ref.update({'singularity_refill_due': firestore.DELETE_FIELD})
                     
    except Exception as e:
        print(f"Error processing singularity refill: {e}")

def process_expiring_predictions():
    """
    Checks active predictions. If end_date < now:
    1. Check Price (Mocked or Real if yfinance available)
    2. Determine Winner
    3. Distribute Payouts
    4. Mark Ended
    """
    # print("Checking expiring predictions...") # verbose
    try:
        db = get_db()
        # Get all Active Predictions
        docs = db.collection('predictions').where(field_path='status', op_string='==', value='active').stream()
        
        now = datetime.utcnow()
        
        for doc in docs:
            data = doc.to_dict()
            pid = doc.id
            end_date_str = data.get('end_date')
            if not end_date_str: continue
            
            end_date = datetime.fromisoformat(end_date_str)
            
            if now > end_date:
                print(f"Resolving prediction {pid}: {data.get('title')}")
                
                # 1. Get Market Price
                stock = data.get('stock')
                condition = data.get('market_condition') # e.g. "Price > 140"
                
                final_price = 0
                winner = 'draw'
                
                try:
                    ticker = yf.Ticker(stock)
                    # Get fast price
                    hist = ticker.history(period="1d")
                    if not hist.empty:
                        final_price = hist['Close'].iloc[-1]
                    else:
                        print(f"Could not get price for {stock}")
                        continue 
                        
                    # 2. Evaluate Condition (Robust Regex Parser)
                    import re
                    clean_cond = condition.lower().strip()
                    
                    # Regex to find number
                    match = re.search(r'([><])\s*\$?([\d\.]+)', clean_cond)
                    
                    winner = 'draw' # Default
                    if match:
                        operator = match.group(1)
                        val_str = match.group(2)
                        try:
                             val = float(val_str)
                             if operator == '>':
                                 winner = 'yes' if final_price > val else 'no'
                             elif operator == '<':
                                 winner = 'yes' if final_price < val else 'no'
                        except ValueError:
                            print(f"Could not parse value {val_str}")
                    else:
                        print(f"Unknown condition format (no operator/val found): {condition}")
                        continue 
                        
                except Exception as e:
                    print(f"Error fetching price/evaluating {stock}: {e}")
                    continue

                print(f"Result for {stock} (${final_price:.2f}): {winner.upper()}")
                
                # 3. Payouts
                pool_yes = data.get('total_pool_yes', 0)
                pool_no = data.get('total_pool_no', 0)
                total_pool = pool_yes + pool_no
                
                winning_pool = pool_yes if winner == 'yes' else pool_no
                
                bets = db.collection('bets').where(field_path='prediction_id', op_string='==', value=pid)\
                         .where(field_path='status', op_string='==', value='pending').stream()
                
                batch = db.batch()
                payout_count = 0
                
                for bet in bets:
                    b_data = bet.to_dict()
                    b_amount = b_data.get('amount', 0)
                    b_choice = b_data.get('choice')
                    
                    payout = 0
                    if b_choice == winner:
                        if winning_pool > 0:
                            share = b_amount / winning_pool
                            payout = int(share * total_pool)
                    elif winning_pool == 0:
                        # Refund if nobody won side
                        payout = b_amount
                    
                    # Credit User
                    if payout > 0:
                        u_ref = db.collection('users').document(b_data.get('user'))
                        u_doc = u_ref.get()
                        if u_doc.exists:
                            curr_points = u_doc.get('points') or 0
                            u_ref.update({'points': curr_points + payout})
                            
                    # Mark Bet Resolved
                    batch.update(db.collection('bets').document(bet.id), {
                        'status': 'resolved',
                        'outcome': 'win' if b_choice == winner else 'loss',
                        'payout': payout
                    })
                    payout_count += 1
                
                batch.commit()
                
                # 4. Close Prediction
                db.collection('predictions').document(pid).update({
                    'status': 'ended',
                    'winner': winner,
                    'final_price': final_price,
                    'resolved_at': datetime.utcnow().isoformat()
                })
                
                print(f"Resolved {pid}. Payouts processed: {payout_count}")
                
    except Exception as e:
        print(f"Error in process_expiring_predictions: {e}")
