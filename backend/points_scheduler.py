import time
import threading
from datetime import datetime, timedelta
from backend.firebase_admin_setup import get_db
from firebase_admin import firestore

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
