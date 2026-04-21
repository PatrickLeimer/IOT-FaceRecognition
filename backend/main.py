from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
import face_engine
import firebase_service
import uuid
import cv2
import numpy as np

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
    known_users = firebase_service.get_all_users_with_faces()
    return {"message": f"Reloaded {len(known_users)} users"}


@app.post("/recognize")
async def recognize(image: UploadFile = File(...)):
    """
    Main endpoint — ESP32 sends an image here.
    Returns: name, confidence, status
    """
    image_bytes = await image.read()

    # Rotate 90 degrees clockwise
    img = cv2.imdecode(np.frombuffer(image_bytes, np.uint8), cv2.IMREAD_COLOR)
    image_bytes = cv2.imencode('.jpg', cv2.rotate(img, cv2.ROTATE_90_CLOCKWISE))[1].tobytes()

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

    # Step 3: Use first detected face
    unknown_face = encodings[0]
    unknown_encoding = unknown_face["encoding"]
    facial_area = unknown_face.get("facial_area_pct")

    # Step 4: Match against known faces
    result = face_engine.match_face(unknown_encoding, known_users)

    # Step 5: Upload the captured image to Firebase Storage
    image_path = f"events/{uuid.uuid4().hex}.jpg"
    image_url = firebase_service.upload_image(image_bytes, image_path)

    # Step 6: Enroll the capture into the matched person's profile so the model
    # improves over time. "needs_review" captures are marked "pending" and will
    # be removed from the wrong person if the user later corrects the event.
    enrolled_face_id = None
    if result["status"] in ("recognized", "needs_review") and result.get("userId"):
        source = "auto" if result["status"] == "recognized" else "pending"
        enrolled_face_id = firebase_service.enroll_face(
            user_id=result["userId"],
            encoding=unknown_encoding.tolist(),
            image_url=image_url,
            source=source,
        )

    # Step 7: Log the event. Store enrolled face reference so corrections can
    # delete the photo from the wrong person's profile.
    event_data = {
        "detectedName": result.get("name"),
        "detectedUserId": result.get("userId"),
        "confidence": result.get("confidence", 0.0),
        "status": result["status"],
        "imageUrl": image_url,
        "facialArea": facial_area,
        "correctedName": None,
        "correctedUserId": None,
        "enrolledFaceId": enrolled_face_id,
        "enrolledUserId": result.get("userId") if enrolled_face_id else None,
    }
    event_id = firebase_service.log_event(event_data)

    firebase_service.update_lcd_display(
        name=result.get("name", "Unknown"),
        status=result["status"]
    )

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

    encoding = encodings[0]["encoding"]

    # Upload image
    image_path = f"faces/{uuid.uuid4().hex}.jpg"
    image_url = firebase_service.upload_image(image_bytes, image_path)

    # Create user or add to existing
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

    return {
        "message": f"Enrolled face for {name}",
        "userId": user_id
    }


@app.post("/enroll-from-event/{event_id}")
async def enroll_from_event(
    event_id: str,
    name: str = Form(...),
    user_id: str = Form(None),
):
    """
    Enroll a face using an existing event's stored image.
    Avoids CORS issues by fetching the image server-side.
    """
    import urllib.request

    event = firebase_service.get_event(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    image_url = event.get("imageUrl")
    if not image_url:
        raise HTTPException(status_code=400, detail="Event has no image")

    # Fetch image server-side
    with urllib.request.urlopen(image_url) as response:
        image_bytes = response.read()

    encodings = face_engine.detect_and_encode(image_bytes)
    if not encodings:
        raise HTTPException(status_code=400, detail="No face detected in event image")

    if user_id is None:
        user_id = firebase_service.create_user(name)

    # Remove the photo from the wrong person's profile if it was auto-enrolled
    wrong_face_id = event.get("enrolledFaceId")
    wrong_user_id = event.get("enrolledUserId")
    if wrong_face_id and wrong_user_id and wrong_user_id != user_id:
        firebase_service.delete_face(wrong_user_id, wrong_face_id)

    firebase_service.enroll_face(
        user_id=user_id,
        encoding=encodings[0]["encoding"].tolist(),
        image_url=image_url,
        source="correction",
    )

    firebase_service.correct_event(event_id, user_id, name)

    global known_users
    known_users = firebase_service.get_all_users_with_faces()

    return {"message": f"Enrolled {name}", "user_id": user_id}


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
    users = firebase_service.get_all_users_with_faces()
    return [
        {
            "id": u["id"],
            "name": u["name"],
            "faceCount": len(u["faces"])
        }
        for u in users
    ]


@app.get("/health")
async def health():
    return {"status": "ok", "usersLoaded": len(known_users)}