import face_recognition
import numpy as np
from PIL import Image
import io
import config


def check_image_quality(image_bytes: bytes) -> dict:
    """Check if the image is usable (not too dark/bright/blurry)."""
    img = Image.open(io.BytesIO(image_bytes)).convert("L")  # Grayscale
    pixels = np.array(img)
    brightness = pixels.mean()

    if brightness < config.MIN_BRIGHTNESS:
        return {"ok": False, "reason": "Image too dark"}
    if brightness > config.MAX_BRIGHTNESS:
        return {"ok": False, "reason": "Image too bright / washed out"}

    return {"ok": True, "brightness": float(brightness)}


def detect_and_encode(image_bytes: bytes) -> list:
    """
    Detect faces and return their encodings.
    Returns list of 128-d numpy arrays (one per face found).
    """
    img = face_recognition.load_image_file(io.BytesIO(image_bytes))
    face_locations = face_recognition.face_locations(img, model="hog")  # "hog" is faster, "cnn" is more accurate

    if not face_locations:
        return []

    encodings = face_recognition.face_encodings(img, face_locations)
    return encodings


def match_face(unknown_encoding, known_users: list) -> dict:
    """
    Compare an unknown face against all known users.
    Returns the best match with confidence score.

    known_users format:
    [
        {"id": "abc", "name": "Sarah", "faces": [{"encoding": [...], ...}, ...]},
        ...
    ]
    """
    best_match = None
    best_distance = float("inf")

    for user in known_users:
        for face in user["faces"]:
            known_encoding = np.array(face["encoding"])
            distance = face_recognition.face_distance([known_encoding], unknown_encoding)[0]

            if distance < best_distance:
                best_distance = distance
                best_match = {
                    "userId": user["id"],
                    "name": user["name"],
                    "distance": float(distance),
                    "confidence": float(1 - distance)
                }

    if best_match is None:
        return {"status": "unknown", "confidence": 0.0}

    if best_match["confidence"] >= config.CONFIDENCE_THRESHOLD:
        best_match["status"] = "recognized"
    elif best_match["confidence"] >= 0.50:  # Some resemblance
        best_match["status"] = "needs_review"
    else:
        best_match["status"] = "unknown"

    return best_match