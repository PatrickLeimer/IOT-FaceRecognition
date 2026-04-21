import numpy as np
from PIL import Image
from deepface import DeepFace
import io
import config

MODEL_NAME = "ArcFace"  # 512-d embeddings, robust to pose/lighting variation


def check_image_quality(image_bytes: bytes) -> dict:
    """Check if the image is usable (not too dark/bright)."""
    img = Image.open(io.BytesIO(image_bytes)).convert("L")
    pixels = np.array(img)
    brightness = pixels.mean()

    if brightness < config.MIN_BRIGHTNESS:
        return {"ok": False, "reason": "Image too dark"}
    if brightness > config.MAX_BRIGHTNESS:
        return {"ok": False, "reason": "Image too bright / washed out"}

    return {"ok": True, "brightness": float(brightness)}


def detect_and_encode(image_bytes: bytes) -> list:
    """
    Detect faces and return their embeddings + bounding boxes.
    Returns list of dicts: {encoding, facial_area_pct}
    facial_area_pct uses 0.0-1.0 relative coords so frontend can overlay boxes.
    """
    try:
        img = np.array(Image.open(io.BytesIO(image_bytes)).convert("RGB"))
        img_h, img_w = img.shape[:2]
        results = DeepFace.represent(
            img_path=img,
            model_name=MODEL_NAME,
            enforce_detection=True,
            detector_backend="opencv",
        )
        faces = []
        for r in results:
            area = r.get("facial_area", {})
            faces.append({
                "encoding": np.array(r["embedding"]),
                "facial_area_pct": {
                    "x": area.get("x", 0) / img_w,
                    "y": area.get("y", 0) / img_h,
                    "w": area.get("w", img_w) / img_w,
                    "h": area.get("h", img_h) / img_h,
                }
            })
        return faces
    except Exception:
        return []


def match_face(unknown_encoding, known_users: list) -> dict:
    """
    Compare an unknown face against all known users.
    Uses cosine similarity — 1.0 = identical, 0.0 = no match.
    """
    best_match = None
    best_similarity = -1.0

    for user in known_users:
        for face in user["faces"]:
            known_encoding = np.array(face["encoding"])

            # Cosine similarity
            dot = np.dot(unknown_encoding, known_encoding)
            norm = np.linalg.norm(unknown_encoding) * np.linalg.norm(known_encoding)
            similarity = float(dot / norm) if norm > 0 else 0.0

            if similarity > best_similarity:
                best_similarity = similarity
                best_match = {
                    "userId": user["id"],
                    "name": user["name"],
                    "confidence": similarity,
                }

    if best_match is None:
        return {"status": "unknown", "confidence": 0.0}

    if best_match["confidence"] >= config.CONFIDENCE_THRESHOLD:
        best_match["status"] = "recognized"
    elif best_match["confidence"] >= 0.20:
        best_match["status"] = "needs_review"
    else:
        best_match["status"] = "unknown"

    return best_match
