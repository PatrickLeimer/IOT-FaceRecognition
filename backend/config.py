# Confidence threshold — start at 0.75, tune later
CONFIDENCE_THRESHOLD = 0.75

# face_recognition uses "distance" (lower = more similar)
# distance 0.0 = identical, 0.6 = default match threshold
# We convert: confidence = 1 - distance
# So 0.75 confidence = 0.25 distance
DISTANCE_THRESHOLD = 1 - CONFIDENCE_THRESHOLD

# Minimum image quality (brightness check)
MIN_BRIGHTNESS = 40   # 0-255 scale
MAX_BRIGHTNESS = 220

# Firebase
FIREBASE_CREDENTIALS_PATH = "serviceAccountKey.json"
FIREBASE_STORAGE_BUCKET = "face-recognition-b7c76-6e59c.firebasestorage.app"
