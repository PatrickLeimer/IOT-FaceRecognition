# Confidence threshold for DeepFace Facenet cosine similarity
# Cosine similarity: 1.0 = identical, 0.0 = no relation, negative = opposite
# DeepFace's default same-person threshold is ~0.40
# Raise to reduce false positives, lower to reduce "needs review" on real matches
CONFIDENCE_THRESHOLD = 0.32  # ArcFace cosine similarity threshold (DeepFace default = 1 - 0.68)

DISTANCE_THRESHOLD = 1 - CONFIDENCE_THRESHOLD

# Minimum image quality (brightness check)
MIN_BRIGHTNESS = 40   # 0-255 scale
MAX_BRIGHTNESS = 220

# Firebase
FIREBASE_CREDENTIALS_PATH = "serviceAccountKey.json"
FIREBASE_STORAGE_BUCKET = "face-recognition-b7c76.firebasestorage.app"