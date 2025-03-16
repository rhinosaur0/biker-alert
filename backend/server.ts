import { Server } from 'socket.io';
import http from 'http';
import * as geolib from 'geolib';

// Define a type for our user.
interface User {
  id: string;
  type: 'driver' | 'biker';
  latitude: number;
  longitude: number;
  warningCooldown: boolean;
  socketId: string;
}

// In-memory dictionary of users.
const users: { [id: string]: User } = {};

// Configuration
const PORT = 8080;
const ALERT_DISTANCE_METERS = 50; // threshold in meters
const COOLDOWN_TIME = 5000; // 5 seconds cooldown

// Create HTTP server
const httpServer = http.createServer();
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.on('update', (message) => {
    try {
      const { id, userType, latitude, longitude } = message;
      
      // If new, add user to dictionary; otherwise update.
      let user: User;
      if (!users[id]) {
        user = {
          id,
          type: userType,
          latitude,
          longitude,
          warningCooldown: false,
          socketId: socket.id,
        };
        users[id] = user;
      } else {
        user = users[id];
        user.latitude = latitude;
        user.longitude = longitude;
        user.socketId = socket.id; // Update socket ID in case of reconnection
      }

      // Check against all other users of opposite type.
      for (const otherId in users) {
        if (otherId === id) continue;
        const otherUser = users[otherId];
        if (otherUser.type === user.type) continue; // only check opposite type

        // Only if neither user is in cooldown.
        if (user.warningCooldown || otherUser.warningCooldown) continue;

        // Calculate distance using geolib
        const distance = geolib.getDistance(
          { latitude: user.latitude, longitude: user.longitude },
          { latitude: otherUser.latitude, longitude: otherUser.longitude }
        );

        if (distance <= ALERT_DISTANCE_METERS) {
          // Create the alert payload.
          const alertPayload = {
            type: 'alert',
            from: user.id,
            fromType: user.type,
            latitude: user.latitude,
            longitude: user.longitude,
            distance,
          };

          // Send alert to both users.
          io.to(user.socketId).emit('alert', alertPayload);
          io.to(otherUser.socketId).emit('alert', {
            type: 'alert',
            from: otherUser.id,
            fromType: otherUser.type,
            latitude: otherUser.latitude,
            longitude: otherUser.longitude,
            distance,
          });

          // Set cooldown for both users.
          user.warningCooldown = true;
          otherUser.warningCooldown = true;
          setTimeout(() => {
            user.warningCooldown = false;
            otherUser.warningCooldown = false;
          }, COOLDOWN_TIME);
        }
      }
    } catch (err) {
      console.error('Error processing message', err);
    }
  });

  // Remove user when connection closes.
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
    for (const id in users) {
      if (users[id].socketId === socket.id) {
        delete users[id];
        console.log(`User ${id} removed`);
      }
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`Socket.IO server started on http://100.66.4.2:${PORT}`);
});