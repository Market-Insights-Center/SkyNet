
import asyncio
import sys
import os

# Add backend to path
sys.path.append(os.getcwd())

# Mock the _resolve_nexus_component extraction logic
def test_extraction_logic():
    print("Testing Nexus Extraction Logic...")
    
    # CASE 1: Old Incorrect Return (Just a list of strings)
    # The logic should NOT pick this as holdings if it checks for dicts
    res_case_1 = (["AAPL", "MSFT"], {"some": "data"}, 1000)
    
    # CASE 2: Correct Return (List of Dicts)
    res_case_2 = ([{"ticker": "AAPL", "shares": 10}], {"some": "data"}, 1000)
    
    # CASE 3: Mixed (List of Strings AND List of Dicts) - Should pick Dicts
    res_case_3 = (["AAPL"], [{"ticker": "NVDA", "shares": 5}], 1000)

    def extract(res):
        sub_holdings = []
        found_list = False
        if isinstance(res, (list, tuple)):
            for item in res:
                # Mod logic
                if isinstance(item, list) and len(item) > 0:
                    first_el = item[0]
                    if isinstance(first_el, dict) and ('ticker' in first_el or 'shares' in first_el):
                        sub_holdings = item
                        found_list = True
                        print(f"  -> Found Dict-List with {len(sub_holdings)} items")
                        break
                elif isinstance(item, list) and len(item) == 0:
                        # Empty list fallback
                        if not found_list: sub_holdings = item
            
            # Fallback
            if not found_list and not sub_holdings:
                 for item in res:
                     if isinstance(item, list):
                         sub_holdings = item
                         found_list = True
                         print("  -> Fallback: Found generic list")
                         break
        return sub_holdings

    print("Case 1 (Strings):", extract(res_case_1))
    print("Case 2 (Dicts):", extract(res_case_2))
    print("Case 3 (Mixed):", extract(res_case_3))

if __name__ == "__main__":
    test_extraction_logic()
