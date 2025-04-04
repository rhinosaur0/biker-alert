import KDBush from 'kdbush';
import * as geokdbush from 'geokdbush';

interface GeoJSONFeature {
  type: string;
  properties: {
    INTERSECTION_ID: number;
    coordinates: [number, number][];  // Updated to match your data structure
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

export const loadIntersections = async () => {
  try {
    // Import the JSON file directly
    const geojsonData: GeoJSONData = {
      type: 'FeatureCollection',
      name: 'intersections',
      features: [
        {
          "type": "Feature",
          "properties": {
            "INTERSECTION_ID": 13465273,
            "coordinates": [[-79.393484525472203, 43.659199931529699]]
          }
        },
        {
          "type": "Feature",
          "properties": {
            "INTERSECTION_ID": 13465293,
            "coordinates": [[-79.394065813944195, 43.659077999362097]]
          }
        },
      ]
    };
    
    // Extract coordinates and properties
    intersectionPoints = geojsonData.features.map(feature => ({
      coordinates: feature.properties.coordinates[0] as [number, number],
      id: feature.properties.INTERSECTION_ID,
      description: '' // Add fallback for missing description
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
  // Parameters: index, longitude, latitude, maxResults, maxDistance in kilometers
  const nearbyIndices = geokdbush.around(
    kdTree,
    longitude,
    latitude,
    5,  // maxResults: maximum number of points to return
    radius // meters
  ) as number[];
  
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