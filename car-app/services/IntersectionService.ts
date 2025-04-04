import KDBush from 'kdbush';
import * as geokdbush from 'geokdbush';

interface GeoJSONFeature {
  type: string;
  geometry: {
    type: string;
    coordinates: [number, number][];
  };
  properties: {
    INTERSECTION_ID: number;
    INTERSECTION_DESC: string;
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
    
    // Extract coordinates and properties
    intersectionPoints = geojsonData.features.map(feature => ({
      coordinates: feature.geometry.coordinates[0] as [number, number],
      id: feature.properties.INTERSECTION_ID,
      description: feature.properties.INTERSECTION_DESC
    }));

    // Initialize KDBush with the number of points
    kdTree = new KDBush(intersectionPoints.length);
    
    // Add points to the index (longitude first, latitude second)
    intersectionPoints.forEach(point => {
      kdTree!.add(point.coordinates[0], point.coordinates[1]);
    });
    
    // Build the index
    kdTree.finish();
    
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
  radius: number // radius in meters
): { isNear: boolean; nearbyIntersections?: Array<{ id: number; description: string }> } => {
  if (!kdTree) return { isNear: false };
  
  // Use geokdbush.around to find nearby points
  const nearbyIndices = geokdbush.around(
    kdTree,
    longitude,
    latitude,
    radius,
    5,
    100
  ) as number[];  // Add type assertion here
  
  if (nearbyIndices.length === 0) return { isNear: false };
  
  // Get intersection details for nearby points
  const nearbyIntersections = nearbyIndices.map((index: number) => ({
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