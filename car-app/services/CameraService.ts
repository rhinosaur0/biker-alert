const RTSP_URL = "rtsp://oscar:oscar123@100.67.151.47:8080/h264.sdp";
let streamActive = false;
let currentStream: any = null;

interface StreamConfig {
  onFrame?: (frame: any) => void;
  onError?: (error: Error) => void;
}

// Function to start RTSP stream
export const startCameraStream = async (config?: StreamConfig) => {
  try {
    if (streamActive) {
      console.warn('Stream already active');
      return false;
    }

    console.log('Starting RTSP stream from:', RTSP_URL);
    
    currentStream = {
      uri: RTSP_URL,
      type: 'rtsp',
      isNetwork: true,
      autoplay: true,
      initOptions: ['--no-audio', '--rtsp-tcp'],
    };

    streamActive = true;
    return true;
  } catch (error) {
    console.error('Failed to start RTSP stream:', error);
    streamActive = false;
    throw error;
  }
};

export const stopCameraStream = () => {
  if (streamActive) {
    console.log('Stopping RTSP stream');
    streamActive = false;
    currentStream = null;
  }
};

export const getCurrentStream = () => {
  return currentStream;
};

export const isStreamActive = () => {
  return streamActive;
};

export const getCameraFrame = async (): Promise<string | null> => {
  // In a real implementation, this would grab a frame from the RTSP stream
  // For now, return a placeholder
  return "base64encodedframedata";
};