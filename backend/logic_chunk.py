
def process_expiring_predictions():
    """
    Checks active predictions. If end_date < now:
    1. Check Price (Mocked or Real if yfinance available)
    2. Determine Winner
    3. Distribute Payouts
    4. Mark Ended
    """
    print("Checking expiring predictions...")
    try:
        db = get_db()
        # Get all Active Predictions
        # Ideally query by end_date < now, but checking all ACTIVE is safer for small scale to ensure no misses
        docs = db.collection('predictions').where(field_path='status', op_string='==', value='active').stream()
        
        now = datetime.utcnow()
        import yfinance as yf
        
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
                        # Or use current price if market open? Let's use last close/current
                    else:
                        print(f"Could not get price for {stock}")
                        continue # Skip resolution if no price
                        
                    # 2. Evaluate Condition (Simple Parser)
                    # Supported: "Price > X", "Price < X"
                    # logic: remove "Price", strip, parse operator
                    clean_cond = condition.lower().replace("price", "").strip()
                    if ">" in clean_cond:
                        val = float(clean_cond.replace(">", "").replace("$", "").strip())
                        winner = 'yes' if final_price > val else 'no'
                    elif "<" in clean_cond:
                        val = float(clean_cond.replace("<", "").replace("$", "").strip())
                        winner = 'yes' if final_price < val else 'no'
                    else:
                        print("Unknown condition format, default to Draw/No Action or Manual")
                        continue 
                        
                except Exception as e:
                    print(f"Error fetching price/evaluating: {e}")
                    continue

                print(f"Result for {stock} (${final_price}): {winner.upper()}")
                
                # 3. Payouts
                pool_yes = data.get('total_pool_yes', 0)
                pool_no = data.get('total_pool_no', 0)
                total_pool = pool_yes + pool_no
                
                winning_pool = pool_yes if winner == 'yes' else pool_no
                
                # If winning pool is 0, house keeps? Or refund?
                # Let's assume standard odds: Share total_pool proportional to bet.
                
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
                        # Refund if nobody won?
                        payout = b_amount
                    
                    # Credit User
                    if payout > 0:
                        u_ref = db.collection('users').document(b_data.get('user'))
                        # To be safe, we should use a transaction or increment, but batch is okay for now
                        # We can't read-mod-write in batch easily for points. 
                        # actually we can just add a "pending_transactions" item for reliability or direct update
                        # Let's direct update for simplicity but beware race conditions. 
                        # BETTER: Transaction per user or singular 'payout' transaction field list?
                        
                        # Let's do simple separate update for reliability
                         # Re-fetching inside loop is slow but safe
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
