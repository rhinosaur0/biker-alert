import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, AppState, AppStateStatus } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import MapView, { Marker } from 'react-native-maps';
import { io, Socket } from 'socket.io-client';
import { loadIntersections, checkNearbyIntersections, getAllIntersections } from '../services/IntersectionService';
import AlertComponent from './AlertComponent';

// --- Constants ---
const SERVER_URL = 'http://100.66.13.84:8000'; // <-- REPLACE WITH YOUR SERVER IP
const LOCATION_UPDATE_INTERVAL = 1000; // ms - How often to check location
const INTERSECTION_CHECK_RADIUS_METERS = 20; // meters
const IS_NEAR_COOLDOWN_DURATION = 5000; // ms
const FRAME_SEND_INTERVAL = 1000; // ms

interface IntersectionPoint {
  coordinates: [number, number];
  id: number;
  description: string;
}

const MapCameraScreen: React.FC = () => {
  // --- Camera Permissions Hook ---
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  // --- State ---
  const [hasLocationPermission, setHasLocationPermission] = useState<boolean | null>(null);
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null);
  const [isNearIntersection, setIsNearIntersection] = useState<boolean>(false);
  const [isNearCooldown, setIsNearCooldown] = useState<boolean>(false);
  const [showAlert, setShowAlert] = useState<boolean>(false);
  const [intersectionPoints, setIntersectionPoints] = useState<IntersectionPoint[]>([]);
  const [intersectionsLoaded, setIntersectionsLoaded] = useState<boolean>(false);
  const [isCameraReady, setIsCameraReady] = useState<boolean>(false);

  // --- Refs ---
  const cameraRef = useRef<CameraView | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const isNearCooldownTimer = useRef<NodeJS.Timeout | null>(null);
  const frameSendIntervalTimer = useRef<NodeJS.Timeout | null>(null);
  const appState = useRef(AppState.currentState);


  // --- Effects ---

  // 1. Permissions, Intersection Loading, Socket Connection, App State
  useEffect(() => {
    let isMounted = true; // Prevent state updates if unmounted

    const setup = async () => {
      // Request Permissions
      console.log("Requesting camera permission...");
      const cameraStatusResult = await requestCameraPermission();
      // State is now managed by the hook, we can check cameraPermission.granted later
      console.log("Camera permission status:", cameraStatusResult.status);

      const { status: locationStatus } = await Location.requestForegroundPermissionsAsync();
      if (isMounted) setHasLocationPermission(locationStatus === 'granted');

      // Load Intersections
      console.log("Loading intersections...");
      const loaded = await loadIntersections();
      if (isMounted) {
          if (loaded) {
              setIntersectionPoints(getAllIntersections());
              setIntersectionsLoaded(true);
              console.log(`Loaded ${getAllIntersections().length} intersections.`);
          } else {
              console.error("Failed to load intersections.");
          }
      }

      // Setup Socket.IO
      console.log(`Attempting to connect to socket server at ${SERVER_URL}...`);
      socketRef.current = io(SERVER_URL, {
        transports: ['websocket'], // Required for some environments
        reconnectionAttempts: 5,
      });

      socketRef.current.on('connect', () => {
        console.log('Socket connected:', socketRef.current?.id);
      });

      socketRef.current.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason);
      });

      socketRef.current.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
      });

      // Listen for the alert trigger from the server
      socketRef.current.on('receiveStreaming', () => {
        console.log('Received receiveStreaming event from server.');
        if (isMounted) {
          setShowAlert(true);
        }
      });
    };

    setup();

    // App State Listener (to potentially restart processes if app comes to foreground)
     const handleAppStateChange = (nextAppState: AppStateStatus) => {
        if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
            console.log('App has come to the foreground!');
            // Potentially re-initiate location tracking or socket connection if needed
            if (!cameraPermission?.granted) {
                console.log("Requesting camera permission from foreground event...");
                requestCameraPermission();
            }
            if (hasLocationPermission && !locationSubscription.current) {
                 startLocationTracking();
            }
            if (!socketRef.current?.connected) {
                 socketRef.current?.connect();
            }
        } else if (nextAppState.match(/inactive|background/)) {
            console.log('App has gone to the background or inactive.');
            // Optional: stop location tracking / frame sending to save battery
             // stopLocationTracking();
             // stopFrameSendingInterval(); // Make sure this function exists if you uncomment
        }
        appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);


    // Cleanup function
    return () => {
      isMounted = false;
      console.log("Cleaning up MapCameraScreen...");
      // Clear timers
      if (isNearCooldownTimer.current) clearTimeout(isNearCooldownTimer.current);
      if (frameSendIntervalTimer.current) clearInterval(frameSendIntervalTimer.current);
      // Stop location updates
      stopLocationTracking();
      // Disconnect socket
      socketRef.current?.disconnect();
      console.log("Socket disconnected on cleanup.");
      // Remove AppState listener
      subscription.remove();
    };
  }, []); // Runs only on mount and unmount


  // Function to start location tracking
  const startLocationTracking = async () => {
      if (locationSubscription.current) {
          console.log("Location tracking already active.");
          return;
      }
      console.log("Starting location tracking...");
      try {
          locationSubscription.current = await Location.watchPositionAsync(
              {
                  accuracy: Location.Accuracy.BestForNavigation,
                  timeInterval: LOCATION_UPDATE_INTERVAL,
                  distanceInterval: 5, // Update if moved 5 meters
              },
              (newLocation) => {
                  // console.log("New location:", newLocation.coords.latitude, newLocation.coords.longitude); // DEBUG
                  setCurrentLocation(newLocation);
              }
          );
          console.log("Location tracking started.");
      } catch (error) {
          console.error("Error starting location tracking:", error);
          setHasLocationPermission(false); // Update state if permission issue occurs
      }
  };

  // Function to stop location tracking
   const stopLocationTracking = () => {
        if (locationSubscription.current) {
            console.log("Stopping location tracking...");
            locationSubscription.current.remove();
            locationSubscription.current = null;
            console.log("Location tracking stopped.");
        }
    };


  // 2. Start Location Tracking when permission is granted
  useEffect(() => {
    if (hasLocationPermission) {
      startLocationTracking();
    } else {
      stopLocationTracking(); // Ensure stopped if permission revoked
    }
    // Cleanup handled by the main mount effect
  }, [hasLocationPermission]);


  // 3. Check for Nearby Intersections when location changes
  useEffect(() => {
    if (!currentLocation || !intersectionsLoaded) return;

    const { latitude, longitude } = currentLocation.coords;
    // console.log(`Checking intersections near: ${latitude}, ${longitude}`); // DEBUG

    const checkResult = checkNearbyIntersections(
      latitude,
      longitude,
      INTERSECTION_CHECK_RADIUS_METERS / 1000 // Convert radius to km
    );

    const currentlyNear = checkResult.isNear;
    // console.log(`Currently near intersection: ${currentlyNear}, Cooldown active: ${isNearCooldown}`); // DEBUG


    // Only update state if the status changed AND not in cooldown

    if (currentlyNear !== isNearIntersection && !isNearCooldown) {
        console.log(`Intersection proximity changed to: ${currentlyNear}. Starting cooldown.`);
        setIsNearIntersection(currentlyNear);
        setIsNearCooldown(true);

        // Clear previous cooldown timer if it exists
        if (isNearCooldownTimer.current) {
            clearTimeout(isNearCooldownTimer.current);
        }

        // Set new cooldown timer
        isNearCooldownTimer.current = setTimeout(() => {
            console.log("Cooldown finished.");
            setIsNearCooldown(false);
            isNearCooldownTimer.current = null; // Clear the ref
        }, IS_NEAR_COOLDOWN_DURATION);
    }

  }, [currentLocation, intersectionsLoaded, isNearIntersection, isNearCooldown]); // Dependencies


  // 4. Send Frames Interval when near intersection and camera is ready
  useEffect(() => {
    // Function to start sending frames
    const startFrameSendingInterval = () => {
        if (frameSendIntervalTimer.current) {
            console.log("Frame sending interval already running.");
            return; // Already running
        }
        console.log("Starting frame sending interval...");
        frameSendIntervalTimer.current = setInterval(async () => {
            if (cameraRef.current && socketRef.current?.connected) {
                 // console.log("Taking picture..."); // DEBUG
                try {
                    const picture = await cameraRef.current.takePictureAsync({
                        quality: 0.5, // Lower quality for faster transmission
                        base64: true,
                        // skipProcessing: true, // Note: skipProcessing might not be available on CameraView
                    });
                    // Check if picture exists before accessing base64
                    if (picture && picture.base64) {
                         // console.log(`Sending frame (${(picture.base64.length * 3/4 / 1024).toFixed(1)} KB)...`); // DEBUG Size
                        socketRef.current.emit('getCarDetection', { frame: picture.base64 });
                    }
                } catch (error) {
                    console.error("Error taking picture:", error);
                    // Consider stopping the interval if errors persist
                }
            } else {
                 // console.log("Camera not ready or socket disconnected, skipping frame send."); // DEBUG
                 // Stop if camera becomes unavailable or socket disconnects?
                 if (!socketRef.current?.connected) {
                     console.warn("Socket disconnected, stopping frame sending.");
                     stopFrameSendingInterval();
                 }
            }
        }, FRAME_SEND_INTERVAL);
    };

    // Function to stop sending frames
    const stopFrameSendingInterval = () => {
        if (frameSendIntervalTimer.current) {
            console.log("Stopping frame sending interval.");
            clearInterval(frameSendIntervalTimer.current);
            frameSendIntervalTimer.current = null;
        }
    };

    // Start or stop the interval based on conditions
    if (isNearIntersection && isCameraReady && socketRef.current?.connected) {
        startFrameSendingInterval();
    } else {
        stopFrameSendingInterval();
    }

    // Cleanup function for this effect
    return () => {
        stopFrameSendingInterval(); // Ensure interval is cleared if dependencies change or component unmounts
    };
  }, [isNearIntersection, isCameraReady]); // Re-run when proximity or camera readiness changes


  // --- Event Handlers ---
  const handleCameraReady = () => {
    console.log("Camera ready.");
    setIsCameraReady(true);
  };

  const handleAlertTimeout = () => {
    console.log("Alert timed out.");
    setShowAlert(false);
  };

  // --- Render Logic ---
  if (!cameraPermission || hasLocationPermission === null) {
    return <View style={styles.center}><Text>Requesting permissions...</Text></View>;
  }
  if (!cameraPermission.granted) {
    return <View style={styles.center}><Text>No access to camera</Text></View>;
  }
  if (hasLocationPermission === false) {
    return <View style={styles.center}><Text>No access to location</Text></View>;
  }
   if (!intersectionsLoaded) {
    return <View style={styles.center}><Text>Loading intersection data...</Text></View>;
  }


  return (
    <View style={styles.container}>
      {/* Top Half: Camera */}
      <View style={styles.cameraContainer}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing={'front'}
          onCameraReady={handleCameraReady}
          animateShutter={false}
        />
         {/* Debug Overlay */}
         <View style={styles.debugOverlay}>
            <Text style={styles.debugText}>Near Intersection: {isNearIntersection ? 'YES' : 'NO'}</Text>
            <Text style={styles.debugText}>Cooldown Active: {isNearCooldown ? 'YES' : 'NO'}</Text>
            <Text style={styles.debugText}>Socket: {socketRef.current?.connected ? 'Connected' : 'Disconnected'}</Text>
            <Text style={styles.debugText}>Location: {currentLocation ? `${currentLocation.coords.latitude.toFixed(4)}, ${currentLocation.coords.longitude.toFixed(4)}` : 'No Fix'}</Text>
         </View>
      </View>

      {/* Bottom Half: Map */}
      <View style={styles.mapContainer}>
        <MapView // Use Google Maps
          style={styles.map}
          showsUserLocation={true}
          followsUserLocation={true} // Map follows user
          initialRegion={currentLocation ? {
            latitude: currentLocation.coords.latitude,
            longitude: currentLocation.coords.longitude,
            latitudeDelta: 0.01, // Adjust zoom level as needed
            longitudeDelta: 0.01,
          } : undefined} // Set initial region only if location is available
          // Optional: Set region dynamically if needed: region={...}
        >
          {/* Render Intersection Markers */}
          {intersectionPoints.map((point, index) => (
            <Marker
              key={`${point.id}-${index}`}
              coordinate={{
                latitude: point.coordinates[1], // Latitude is second element
                longitude: point.coordinates[0] // Longitude is first element
              }}
              title={point.description}
              pinColor={isNearIntersection ? "blue" : "red"} // Example: change color when near any intersection
            />
          ))}
        </MapView>
      </View>

      {/* Alert Overlay */}
      <AlertComponent visible={showAlert} onTimeout={handleAlertTimeout} />
    </View>
  );
};

// --- Styles ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraContainer: {
    flex: 1, // Takes top half
    position: 'relative', // Needed for overlay
  },
  camera: {
    flex: 1,
  },
  mapContainer: {
    flex: 1, // Takes bottom half
  },
  map: {
    ...StyleSheet.absoluteFillObject, // Map fills its container
  },
  debugOverlay: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: 5,
    borderRadius: 5,
  },
   debugText: {
    color: 'white',
    fontSize: 10,
   }
});

export default MapCameraScreen; 