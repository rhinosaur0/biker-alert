import base64
import cv2
import numpy as np
import socketio
import socket
from fastapi import FastAPI
from ultralytics import YOLO

# Get local IP address
def get_local_ip():
    try:
        # Create a socket that connects to an external server
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))  # Google's DNS server
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"  # Fallback to localhost

# Create a Socket.IO server with ASGI support
sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*")
app = FastAPI()
sio_app = socketio.ASGIApp(sio, other_asgi_app=app)

# Load the YOLOv8 model
model = YOLO("yolov8n.pt")

@sio.event
async def connect(sid, environ):
    print(f"Client connected: {sid}")

@sio.event
async def disconnect(sid):
    print(f"Client disconnected: {sid}")

@sio.on("beginStreamingServer")
async def handle_stream_request(sid, data):
    """Handle streaming mode changes and relay to camera clients"""
    print('beginStreamingServer', data)
    yolo_mode = data.get("yolo", False)
    await sio.emit("beginStreamingClient", {"yolo": yolo_mode})

@sio.on("getCarDetection")
async def get_car_detection(sid, data):
    """Handle images when YOLO detection is needed"""
    frame = data.get("frame")
    if not frame:
        print("No frame provided")
        return

    # Decode the base64 image
    img_bytes = base64.b64decode(frame)
    nparr = np.frombuffer(img_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    # Get image dimensions
    height, width = img.shape[:2]
    min_box_area_percentage = 0.1  # Box must be at least 5% of image area
    min_box_area = (width * height) * min_box_area_percentage

    # Run detection
    results = model(img)
    
    # Check for car detection with size threshold
    car_detected = False
    for result in results:
        boxes = result.boxes
        for box, cls in zip(boxes.xyxy.cpu().numpy(), boxes.cls.cpu().numpy()):
            if result.names.get(int(cls)) == "car":
                # Calculate box area
                box_width = box[2] - box[0]
                box_height = box[3] - box[1]
                box_area = box_width * box_height
                
                if box_area >= min_box_area:
                    print(f"Car detected with area: {box_area:.2f} pixels² ({(box_area/(width*height))*100:.1f}% of frame)")
                    car_detected = True
                    await sio.emit("receiveStreaming")
                    break
        if car_detected:
            break

@sio.on("noCarDetection")
async def handle_no_detection(sid, data):
    """Handle images when no detection is needed"""
    frame = data.get("frame")
    if not frame:
        print("No frame provided")
        return

    # Simply relay the frame without detection
    await sio.emit("receiveStreaming", {
        "frame": frame,
        "carDetected": False
    })

if __name__ == "__main__":
    import uvicorn
    host_ip = get_local_ip()
    print(f"Server running on: http://{host_ip}:8000")
    uvicorn.run(sio_app, host=host_ip, port=8000)