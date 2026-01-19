import os
import csv
import sys

# Constants
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PARENT_DIR = os.path.dirname(CURRENT_DIR)
MODS_FILE = os.path.join(CURRENT_DIR, 'mods.csv')
SUPER_ADMIN_EMAIL = "marketinsightscenter@gmail.com"

def get_mod_list():
    mods = []
    if os.path.exists(MODS_FILE):
        with open(MODS_FILE, 'r') as f:
            reader = csv.reader(f)
            next(reader, None) # Skip header
            for row in reader:
                if row: mods.append(row[0].lower())
    
    # Ensure Super Admin is always in the list
    if SUPER_ADMIN_EMAIL not in mods:
        mods.append(SUPER_ADMIN_EMAIL)
        # Write back to file if missing
        with open(MODS_FILE, 'a', newline='') as f:
            writer = csv.writer(f)
            writer.writerow([SUPER_ADMIN_EMAIL])
            
    return mods
