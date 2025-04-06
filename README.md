  Run instructions for Android:
    • Have an Android emulator running (quickest way to get started), or a device connected.
    • cd "/Users/pauldong/Desktop/Programming/BikerAlert/biker_alert" && npx react-native run-android
  
  Run instructions for iOS:
    • cd "/Users/pauldong/Desktop/Programming/BikerAlert/biker_alert"
    
    • npx react-native run-ios
    - or -
    • Open biker_alert/ios/biker_alert.xcodeproj in Xcode or run "xed -b ios"
    • Hit the Run button
    
  Run instructions for macOS:
    • See https://aka.ms/ReactNativeGuideMacOS for the latest up-to-date instructions.




I no longer want it to be streaming from a rtsp. I need you to remove all the RTSP handling.

Firstly, when you load into the page on layout, I need you to have two buttons: first saying "Use for Camera", which will direct it to another component called "CameraUsage.tsx", which will begin streaming their phone camera using expo camera. The second button is "Use for Bikers", which will direct it to the 'start button' similar to the one in layout right now.

I need the following procedure to happen: in mapscreen.tsx, after the intersections are loaded in, a function "dataSequence' should be initiatiated in intervals of 125ms. In this funtion, if isNear is false, a socket message "beginStreamingServer", with a boolean 'yolo' as False. This should send it to the server, which will send "beginStreamingClient", boolean 'yolo as False as well. CameraUsage.tsx should have a socket.on for "beginStreamingClient", and start sending the photos to the socket endpoint of "noCarDetection". Similarly, if isNear is true, a socketmessage from mapscreen "beginStreamingServer", with a boolean 'yolo' true will be sent. In this case, the server will perform similarly, and the CameraUsage.tsx should instead start sending photos to socket endpoint of 'getCarDetection'. 