import firebase_admin
from firebase_admin import credentials, firestore, storage
from datetime import datetime
import config

# Initialize Firebase
cred = credentials.Certificate(config.FIREBASE_CREDENTIALS_PATH)
firebase_admin.initialize_app(cred, {
    "storageBucket": config.FIREBASE_STORAGE_BUCKET
})

db = firestore.client()
bucket = storage.bucket()


def upload_image(image_bytes: bytes, path: str) -> str:
    """Upload image to Firebase Storage, return public URL."""
    blob = bucket.blob(path)
    blob.upload_from_string(image_bytes, content_type="image/jpeg")
    blob.make_public()
    return blob.public_url


def get_all_users_with_faces():
    """Load all users and their face encodings from Firestore."""
    users = []
    users_ref = db.collection("users").stream()

    for user_doc in users_ref:
        user_data = user_doc.to_dict()
        user_data["id"] = user_doc.id

        # Get face encodings from subcollection
        faces_ref = db.collection("users").document(user_doc.id) \
                      .collection("faces").stream()
        user_data["faces"] = []
        for face_doc in faces_ref:
            face_data = face_doc.to_dict()
            face_data["id"] = face_doc.id
            user_data["faces"].append(face_data)

        if user_data["faces"]:  # Only include users with enrolled faces
            users.append(user_data)

    return users


def log_event(event_data: dict) -> str:
    """Write a recognition event to Firestore."""
    event_data["timestamp"] = firestore.SERVER_TIMESTAMP
    event_data["reviewed"] = False
    doc_ref = db.collection("events").add(event_data)
    return doc_ref[1].id


def enroll_face(user_id: str, encoding: list, image_url: str, source: str = "manual"):
    """Add a face encoding to a user's profile."""
    db.collection("users").document(user_id).collection("faces").add({
        "encoding": encoding,
        "imageUrl": image_url,
        "addedAt": firestore.SERVER_TIMESTAMP,
        "source": source
    })
    # Update the user's updatedAt timestamp
    db.collection("users").document(user_id).update({
        "updatedAt": firestore.SERVER_TIMESTAMP
    })


def create_user(name: str) -> str:
    """Create a new user profile, return user ID."""
    doc_ref = db.collection("users").add({
        "name": name,
        "createdAt": firestore.SERVER_TIMESTAMP,
        "updatedAt": firestore.SERVER_TIMESTAMP
    })
    return doc_ref[1].id




def serialize_firestore_value(value):
    """Convert Firestore types into JSON-safe values."""
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return value


def get_recent_events(limit_count: int = 50):
    """Return recent events ordered newest-first."""
    docs = db.collection("events").order_by("timestamp", direction=firestore.Query.DESCENDING).limit(limit_count).stream()
    events = []
    for event_doc in docs:
        data = event_doc.to_dict()
        data["id"] = event_doc.id
        for key, value in list(data.items()):
            data[key] = serialize_firestore_value(value)
        events.append(data)
    return events


def get_dashboard_stats():
    """Summarize dashboard counters from Firestore."""
    users = get_all_users_with_faces()
    events = get_recent_events(200)
    today = datetime.utcnow().date()
    today_events = []
    for event in events:
        ts = event.get("timestamp")
        if not ts:
            continue
        try:
            event_date = datetime.fromisoformat(ts.replace("Z", "+00:00")).date()
        except ValueError:
            continue
        if event_date == today:
            today_events.append(event)

    recognized = sum(1 for event in today_events if event.get("status") in {"recognized", "corrected"})
    accuracy = round((recognized / len(today_events)) * 100) if today_events else None
    return {
        "people": len(users),
        "today": len(today_events),
        "accuracy": accuracy,
    }


def confirm_event(event_id: str):
    """Mark an event as reviewed and recognized."""
    db.collection("events").document(event_id).update({
        "status": "recognized",
        "reviewed": True
    })

def correct_event(event_id: str, corrected_user_id: str, corrected_name: str):
    """Update an event with the correction."""
    db.collection("events").document(event_id).update({
        "correctedUserId": corrected_user_id,
        "correctedName": corrected_name,
        "status": "corrected",
        "reviewed": True
    })