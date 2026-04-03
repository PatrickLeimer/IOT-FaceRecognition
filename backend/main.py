from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from google.api_core.exceptions import GoogleAPIError, NotFound
import face_engine
import firebase_service
import uuid

app = FastAPI(title="Face Recognition IoT Backend")

# Allow React dev server and ESP32 to call this
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Cache known users in memory — reload periodically
known_users = []


def raise_storage_error(exc: Exception):
    """Convert storage/provider failures into readable API errors."""
    if isinstance(exc, NotFound):
        raise HTTPException(
            status_code=500,
            detail="Firebase Storage bucket was not found. Check FIREBASE_STORAGE_BUCKET in backend/config.py."
        ) from exc

    if isinstance(exc, GoogleAPIError):
        raise HTTPException(
            status_code=500,
            detail=f"Firebase request failed: {exc.message if hasattr(exc, 'message') else str(exc)}"
        ) from exc

    raise exc


@app.on_event("startup")
async def load_faces():
    """Load all known face encodings from Firebase on startup."""
    global known_users
    known_users = firebase_service.get_all_users_with_faces()
    print(f"Loaded {len(known_users)} users with face data.")


@app.post("/reload")
async def reload_faces():
    """Manually trigger a reload of face encodings from Firebase."""
    global known_users
    try:
        known_users = firebase_service.get_all_users_with_faces()
    except Exception as exc:
        raise_storage_error(exc)
    return {"message": f"Reloaded {len(known_users)} users"}


@app.post("/recognize")
async def recognize(image: UploadFile = File(...)):
    """
    Main endpoint — ESP32 sends an image here.
    Returns: name, confidence, status
    """
    image_bytes = await image.read()

    # Step 1: Check image quality
    quality = face_engine.check_image_quality(image_bytes)
    if not quality["ok"]:
        return {"status": "error", "message": quality["reason"]}

    # Step 2: Detect and encode faces
    encodings = face_engine.detect_and_encode(image_bytes)

    if not encodings:
        # Log the event even if no face found
        firebase_service.log_event({
            "status": "no_face",
            "detectedName": None,
            "confidence": 0.0
        })
        return {"status": "no_face", "message": "No face detected in image"}

    # Step 3: Use the largest face (closest to camera)
    # For simplicity, just use the first face detected
    unknown_encoding = encodings[0]

    # Step 4: Match against known faces
    result = face_engine.match_face(unknown_encoding, known_users)

    # Step 5: Upload the captured image to Firebase Storage
    image_path = f"events/{uuid.uuid4().hex}.jpg"
    try:
        image_url = firebase_service.upload_image(image_bytes, image_path)
    except Exception as exc:
        raise_storage_error(exc)

    # Step 6: Log the event
    event_data = {
        "detectedName": result.get("name"),
        "detectedUserId": result.get("userId"),
        "confidence": result.get("confidence", 0.0),
        "status": result["status"],
        "imageUrl": image_url,
        "correctedName": None,
        "correctedUserId": None
    }
    try:
        event_id = firebase_service.log_event(event_data)
    except Exception as exc:
        raise_storage_error(exc)

    # Step 7: If high confidence, auto-enroll this encoding (more data = better)
    if result["status"] == "recognized" and result["confidence"] >= 0.85:
        try:
            firebase_service.enroll_face(
                user_id=result["userId"],
                encoding=unknown_encoding.tolist(),
                image_url=image_url,
                source="auto"
            )
        except Exception as exc:
            raise_storage_error(exc)

    return {
        "status": result["status"],
        "name": result.get("name", "Unknown"),
        "confidence": round(result.get("confidence", 0.0), 3),
        "eventId": event_id
    }


@app.post("/enroll")
async def enroll(
    name: str = Form(...),
    user_id: str = Form(None),
    image: UploadFile = File(...)
):
    """
    Enroll a new face. If user_id is provided, add to existing user.
    Otherwise, create a new user.
    """
    image_bytes = await image.read()

    # Detect face
    encodings = face_engine.detect_and_encode(image_bytes)
    if not encodings:
        raise HTTPException(status_code=400, detail="No face detected in image")
    if len(encodings) > 1:
        raise HTTPException(status_code=400, detail="Multiple faces detected — use a photo with one person")

    encoding = encodings[0]

    # Upload image
    image_path = f"faces/{uuid.uuid4().hex}.jpg"
    try:
        image_url = firebase_service.upload_image(image_bytes, image_path)
    except Exception as exc:
        raise_storage_error(exc)

    # Create user or add to existing
    try:
        if user_id is None:
            user_id = firebase_service.create_user(name)

        firebase_service.enroll_face(
            user_id=user_id,
            encoding=encoding.tolist(),
            image_url=image_url,
            source="manual"
        )

        # Reload known faces so recognition immediately includes this person
        global known_users
        known_users = firebase_service.get_all_users_with_faces()
    except Exception as exc:
        raise_storage_error(exc)

    return {
        "message": f"Enrolled face for {name}",
        "userId": user_id
    }


@app.post("/confirm/{event_id}")
async def confirm_event(event_id: str):
    """Mark a review event as confirmed recognized."""
    try:
        firebase_service.confirm_event(event_id)
    except Exception as exc:
        raise_storage_error(exc)
    return {"message": f"Event {event_id} confirmed"}


@app.post("/correct/{event_id}")
async def correct_event(
    event_id: str,
    correct_user_id: str = Form(...),
    correct_name: str = Form(...)
):
    """
    Correct a misidentified event.
    Also enrolls the face under the correct user for future improvement.
    """
    # Update the event
    firebase_service.correct_event(event_id, correct_user_id, correct_name)

    # TODO: Optionally re-encode the event image and enroll under correct user
    # This would require storing/retrieving the event image and re-encoding it

    return {"message": f"Event {event_id} corrected to {correct_name}"}


@app.get("/users")
async def list_users():
    """List all known users (for dropdown menus in the UI)."""
    try:
        users = firebase_service.get_all_users_with_faces()
    except Exception as exc:
        raise_storage_error(exc)
    return [
        {
            "id": u["id"],
            "name": u["name"],
            "faceCount": len(u["faces"])
        }
        for u in users
    ]


@app.get("/dashboard")
async def dashboard_data():
    """Return dashboard counters and recent events for the web app."""
    try:
        return {
            "stats": firebase_service.get_dashboard_stats(),
            "events": firebase_service.get_recent_events(),
        }
    except Exception as exc:
        raise_storage_error(exc)


@app.get("/health")
async def health():
    return {"status": "ok", "usersLoaded": len(known_users)}