#!/usr/bin/env python3
import os, shutil, json, sys, traceback
from datetime import datetime
from atproto import Client

# --- CONFIG ---
BASE_PATH = os.path.dirname(os.path.abspath(__file__))
TO_POST = os.path.join(BASE_PATH, "images_to_post")
POSTED = os.path.join(BASE_PATH, "images_posted")
CAPTIONS_FILE = os.path.join(BASE_PATH, "captions.json")

HANDLE = os.getenv("BLUESKY_HANDLE")       # from GitHub Secrets
APP_PASSWORD = os.getenv("BLUESKY_APP_PW") # from GitHub Secrets

# --- LOGGING ---
def log(msg):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{ts}] {msg}")

try:
    # --- Ensure folders exist ---
    os.makedirs(TO_POST, exist_ok=True)
    os.makedirs(POSTED, exist_ok=True)

    # --- Load captions JSON ---
    if not os.path.exists(CAPTIONS_FILE):
        log(f"Captions JSON not found at {CAPTIONS_FILE}. Exiting.")
        sys.exit(0)

    with open(CAPTIONS_FILE, "r") as f:
        captions = json.load(f)

    # --- Bluesky login ---
    client = Client()
    client.login(HANDLE, APP_PASSWORD)
    log("Logged in to Bluesky.")

    # --- Find images ---
    files = [f for f in os.listdir(TO_POST) if f.lower().endswith(('.jpg','.jpeg','.png'))]
    if not files:
        log("No images left to post. Exiting.")
        sys.exit(0)

    # --- Pick first image (sorted by name) ---
    filename = sorted(files)[0]
    img_path = os.path.join(TO_POST, filename)

    # --- Get caption from JSON, fallback ---
    caption = captions.get(filename, "Image of the day")
    log(f"Posting {filename} with caption: {caption}")

    # --- Upload image to Bluesky ---
    with open(img_path, "rb") as img_file:
        client.send_image(text=caption, image=img_file.read(), image_alt=" ")

    # --- Move posted image ---
    shutil.move(img_path, os.path.join(POSTED, filename))

    # --- Remove used caption from JSON ---
    if filename in captions:
        del captions[filename]
        with open(CAPTIONS_FILE, "w") as f:
            json.dump(captions, f, indent=2)

    log(f"Posted and moved {filename}. Caption removed from JSON if it existed.")

except Exception as e:
    log("ERROR: " + str(e))
    traceback.print_exc()
    sys.exit(1)