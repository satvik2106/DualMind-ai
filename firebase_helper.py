import os
import json
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

# Initialize Firebase Admin globally
_firebase_initialized = False

def init_firebase():
    global _firebase_initialized
    if _firebase_initialized:
        return True

    try:
        import firebase_admin
        from firebase_admin import credentials, firestore
        
        service_account_key = os.getenv("FIREBASE_SERVICE_ACCOUNT_KEY")
        if not service_account_key:
            logger.info("FIREBASE_SERVICE_ACCOUNT_KEY not set. Backend Firestore logging disabled.")
            return False

        if service_account_key.startswith("{"):
            # It's a JSON string
            creds_dict = json.loads(service_account_key)
            cred = credentials.Certificate(creds_dict)
        else:
            # Assume it's a file path
            cred = credentials.Certificate(service_account_key)
            
        # Production Hardening: Explicitly target the '(default)' database
        # This prevents 'database not found' errors in environments with multiple databases
        firebase_admin.initialize_app(cred, {
            'databaseURL': os.getenv("FIREBASE_DATABASE_URL")
        })
        _firebase_initialized = True
        logger.info("Firebase Admin initialized successfully (Database: (default)).")
        return True
    except ImportError:
        logger.warning("firebase-admin package not installed. Backend Firestore logging disabled.")
        return False
    except Exception as e:
        err_str = str(e).lower()
        if "database" in err_str and "not found" in err_str:
            logger.error("CRITICAL: Firestore Database '(default)' not found in this project. "
                         "Please ensure Firestore is enabled in the Firebase Console.")
        elif "project_id" in err_str:
            logger.error("CRITICAL: Firebase Project ID mismatch or missing. Check your service account key.")
        else:
            logger.error(f"Failed to initialize Firebase Admin: {e}")
        return False

def get_firestore_client():
    if not _firebase_initialized:
        if not init_firebase():
            return None
            
    from firebase_admin import firestore
    return firestore.client()

def verify_id_token(token: str) -> Optional[Dict[str, Any]]:
    """Verifies a Firebase ID token and returns the decoded claims."""
    if not _firebase_initialized:
        if not init_firebase():
            return None
            
    try:
        from firebase_admin import auth
        return auth.verify_id_token(token)
    except Exception as e:
        logger.error(f"Failed to verify Firebase ID token: {e}")
        return None

from collections import defaultdict
import threading
import time

_event_queues = defaultdict(list)
_write_lock = threading.Lock()
_batch_thread_started = False

def _batch_writer():
    """Background thread that flushes queued events to Firestore every 5 seconds to minimize writes (Free Tier Optimization)."""
    while True:
        time.sleep(5)
        db = get_firestore_client()
        if not db:
            continue
            
        with _write_lock:
            # Take snapshot of current queues and clear them
            queues_to_write = dict(_event_queues)
            _event_queues.clear()
            
        if not queues_to_write:
            continue
            
        try:
            batch = db.batch()
            writes_count = 0
            
            for conv_id, events in queues_to_write.items():
                if not events:
                    continue
                # Create a single document for this batch of events to save writes
                doc_ref = db.collection('orchestrationEvents').document()
                batch.set(doc_ref, {
                    'conversationId': conv_id,
                    'timestamp': firestore.SERVER_TIMESTAMP,
                    'events': events,
                    'count': len(events)
                })
                writes_count += 1
                
                # Firestore batch limit is 500, but we'll commit every 100 for safety
                if writes_count >= 100:
                    batch.commit()
                    batch = db.batch()
                    writes_count = 0
                    
            if writes_count > 0:
                batch.commit()
                
        except Exception as e:
            logger.error(f"Failed to commit batched Firestore writes: {e}")

def log_orchestration_event(conversation_id: str, event_data: Dict[str, Any]):
    """
    Queue orchestration event logging.
    """
    if not _firebase_initialized:
        return # Skip logging if Firestore is not available
        
    global _batch_thread_started
    if not conversation_id:
        return
        
    try:
        # Start the batch writer thread once
        if not _batch_thread_started:
            with _write_lock:
                if not _batch_thread_started:
                    t = threading.Thread(target=_batch_writer, daemon=True)
                    t.start()
                    _batch_thread_started = True

        # Convert non-serializable objects
        clean_data = json.loads(json.dumps(event_data, default=str))
        
        with _write_lock:
            _event_queues[conversation_id].append(clean_data)
            
    except Exception as e:
        logger.error(f"Failed to queue Firestore write: {e}")
