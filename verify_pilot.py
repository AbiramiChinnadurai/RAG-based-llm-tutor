import os
import sys

# Add project root to sys.path
sys.path.append(os.path.abspath("."))

# Manually set the DATABASE_URL for verification (from backend/.env)
os.environ["DATABASE_URL"] = "postgresql://postgres.fqbkhnpeseeobvvbpkky:abiramisupa2004@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres"

from database.db import init_db, log_error_topic, get_error_topics, log_seem_attempt, get_connection, create_profile

def verify():
    print("🚀 Starting Pilot Architecture Verification...")
    init_db()
    
    uid = 1 
    subject = "Python"
    topic = "Loops"
    
    conn = get_connection()
    c = conn.cursor()
    
    # Ensure profile 1 exists or create a test one
    c.execute("SELECT uid FROM learner_profile WHERE uid=1")
    if not c.fetchone():
        print("Creating test profile...")
        c.execute("INSERT INTO learner_profile (uid, name) VALUES (1, 'Test User') ON CONFLICT DO NOTHING")
    
    # 1. Check initial error state
    c.execute("DELETE FROM error_topics WHERE uid=%s AND subject=%s AND topic=%s", (uid, subject, topic))
    c.execute("DELETE FROM seem_attempts WHERE uid=%s AND subject=%s AND topic=%s", (uid, subject, topic))
    conn.commit()
    
    print(f"--- Testing SEEM -> Error Topics Loop ---")
    # 2. Simulate a SEEM score of 6/10 (4 missed points)
    score = 6
    total = 10
    print(f"Simulating SEEM score: {score}/{total} for topic '{topic}'")
    missed = log_seem_attempt(uid, subject, topic, score, total)
    print(f"Logged SEEM attempt. Missed points: {missed}")
    
    # 3. Verify error_topics increment
    c.execute("SELECT count FROM error_topics WHERE uid=%s AND subject=%s AND topic=%s", (uid, subject, topic))
    row = c.fetchone()
    if row and row['count'] == 4:
        print("✅ SUCCESS: Error count correctly incremented by 4 missed points.")
    else:
        print(f"❌ FAILURE: Error count is {row['count'] if row else 0}, expected 4.")
    
    # 4. Verify Heatmap Logging
    print(f"\n--- Testing Heatmap Logging ---")
    from database.db import log_heatmap_interaction
    log_heatmap_interaction(uid, subject, topic, "Moderate")
    c.execute("SELECT * FROM heatmap_interactions WHERE uid=%s AND subject=%s AND topic_clicked=%s", (uid, subject, topic))
    row = c.fetchone()
    if row:
        print("✅ SUCCESS: Heatmap interaction logged.")
    else:
        print("❌ FAILURE: Heatmap interaction not found.")
        
    conn.close()
    print("\n🏁 Verification Complete.")

if __name__ == "__main__":
    verify()
