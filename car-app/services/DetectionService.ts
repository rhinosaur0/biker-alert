interface Detection {
    class: string;
    confidence: number;
    box: [number, number, number, number]; // [x1, y1, x2, y2]
  }
  
  export const detectObjects = async (imageBase64: string): Promise<Detection[]> => {
    try {
      // In a real implementation, you would send the image to your Ultralytics API endpoint
      // For now, we'll create a placeholder implementation
      
      const apiEndpoint = 'https://your-ultralytics-api-endpoint.com/detect';
      
      // Mock API call
      // In production, replace with actual API call:
      /*
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: imageBase64,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      return data.detections;
      */
      
      // For development, return mock data
      return [
        { class: 'car', confidence: 0.92, box: [100, 200, 300, 350] },
        { class: 'person', confidence: 0.85, box: [50, 100, 100, 200] },
      ];
    } catch (error) {
      console.error('Detection API error:', error);
      return [];
    }
  };