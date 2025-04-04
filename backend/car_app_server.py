import base64
import cv2
import numpy as np
import socketio
from fastapi import FastAPI
from ultralytics import YOLO

# Create a Socket.IO server with ASGI support
sio = socketio.AsyncServer(async_mode="asgi")
app = FastAPI()
sio_app = socketio.ASGIApp(sio, other_asgi_app=app)

# Load the YOLOv8 model (using a pretrained model such as yolov8n.pt)
model = YOLO("yolov8n.pt")

@sio.event
async def connect(sid, environ):
    print(f"Client connected: {sid}")

@sio.event
async def disconnect(sid):
    print(f"Client disconnected: {sid}")

@sio.on("getCarDetection")
async def get_car_detection(sid, data):
    """
    Expects data to be a dictionary with key 'image' containing the base64-encoded image.
    """
    image_data = data.get("image")
    if not image_data:
        print("No image provided.")
        return

    # Decode the base64 image string into image bytes
    img_bytes = base64.b64decode(image_data)
    # Convert bytes data to a NumPy array
    nparr = np.frombuffer(img_bytes, np.uint8)
    # Decode the image from the NumPy array
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    # Run detection on the image using the YOLOv8 model
    results = model(img)

    # Initialize detection flag
    detected_car = False

    # YOLOv8 returns a list of result objects.
    # Each result contains .boxes (with .cls representing the detected class indices)
    # and a names dictionary mapping indices to class names.
    for result in results:
        boxes = result.boxes
        # Loop through all detected class indices
        for cls in boxes.cls.cpu().numpy():
            # Check if the detected class is 'car'
            if result.names.get(int(cls)) == "car":
                detected_car = True
                break
        if detected_car:
            break

    # Emit the result back to the client via 'receiveCarDetection'
    # Here, we send True if a car is detected; otherwise, you might choose to send False.
    await sio.emit("receiveCarDetection", detected_car, to=sid)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(sio_app, host="127.0.0.1", port=8000)
