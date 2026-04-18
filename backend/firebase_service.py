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


def enroll_face(user_id: str, encoding: list, image_url: str, source: str = "manual") -> str:
    """Add a face encoding to a user's profile. Returns the face doc ID."""
    _, face_ref = db.collection("users").document(user_id).collection("faces").add({
        "encoding": encoding,
        "imageUrl": image_url,
        "addedAt": firestore.SERVER_TIMESTAMP,
        "source": source
    })
    db.collection("users").document(user_id).update({
        "updatedAt": firestore.SERVER_TIMESTAMP
    })
    return face_ref.id


def delete_face(user_id: str, face_id: str):
    """Remove a face doc from a user's profile."""
    db.collection("users").document(user_id).collection("faces").document(face_id).delete()
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


def get_event(event_id: str) -> dict:
    """Fetch a single event by ID."""
    doc = db.collection("events").document(event_id).get()
    if doc.exists:
        data = doc.to_dict()
        data["id"] = doc.id
        return data
    return None


def correct_event(event_id: str, corrected_user_id: str, corrected_name: str):
    """Update an event with the correction."""
    db.collection("events").document(event_id).update({
        "correctedUserId": corrected_user_id,
        "correctedName": corrected_name,
        "status": "corrected",
        "reviewed": True
    })


def update_lcd_display(name: str, status: str):
    """Overwrite the single document ESP32 LCD polls for the latest result."""
    db.collection("display").document("current").set({
        "name": name,
        "status": status,
        "timestamp": firestore.SERVER_TIMESTAMP
    })