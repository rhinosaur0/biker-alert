import KDBush from 'kdbush';

interface GeoJSONFeature {
  type: string;
  geometry: {
    type: string;
    coordinates: [number, number][];
  };
  properties: {
    INTERSECTION_ID: number;
    INTERSECTION_DESC: string;
    // Add other properties as needed
  };
}

interface GeoJSONData {
  type: string;
  name: string;
  features: GeoJSONFeature[];
}

let kdTree: KDBush | null = null;
let intersectionPoints: Array<{
  coordinates: [number, number];
  id: number;
  description: string;
}> = [];

export const loadIntersections = async (filePath: string) => {
  try {
    const response = await fetch(filePath);
    const geojsonData: GeoJSONData = await response.json();
    
    // Extract just the coordinates and relevant properties from features
    intersectionPoints = geojsonData.features.map(feature => ({
      coordinates: feature.geometry.coordinates[0] as [number, number],
      id: feature.properties.INTERSECTION_ID,
      description: feature.properties.INTERSECTION_DESC
    }));

    // Create points array for KDBush
    const points = intersectionPoints.map(point => point.coordinates);
    
    // Initialize KDBush index
    kdTree = new KDBush(points);
    
    console.log(`Loaded ${intersectionPoints.length} intersections`);
    return true;
  } catch (error) {
    console.error('Error loading intersections:', error);
    return false;
  }
};

export const checkNearbyIntersections = (
  latitude: number,
  longitude: number,
  radius: number
): { isNear: boolean; nearbyIntersections?: Array<{ id: number; description: string }> } => {
  if (!kdTree) return { isNear: false };
  
  // Convert radius from meters to approximate degrees
  const radiusInDegrees = radius / 111000; // 1 degree is approximately 111km
  
  // Find points within the radius
  const nearbyIndices = kdTree.within(latitude, longitude, radiusInDegrees);
  
  if (nearbyIndices.length === 0) return { isNear: false };
  
  // Get intersection details for nearby points
  const nearbyIntersections = nearbyIndices.map(index => ({
    id: intersectionPoints[index].id,
    description: intersectionPoints[index].description
  }));
  
  return {
    isNear: true,
    nearbyIntersections
  };
};

export const getAllIntersections = () => {
  return intersectionPoints;
};