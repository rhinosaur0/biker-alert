import KDBush from 'kdbush';
import * as geokdbush from 'geokdbush';

interface Intersection {
  _id: number;
  INTERSECTION_ID: number;
  INTERSECTION_DESC: string;
  geometry: {
    type: string;
    coordinates: [number, number][];
  };
}

let kdTree: KDBush | null = null;
let intersectionPoints: Array<{
  coordinates: [number, number];
  id: number;
  description: string;
}> = [];

const fetchIntersections = async () => {
  const packageId = "2c83f641-7808-49ba-b80f-7011851d4e27";
  
  try {
    // First get the package metadata
    const getPackage = () => new Promise<any>((resolve, reject) => {
      fetch(`https://ckan0.cf.opendata.inter.prod-toronto.ca/api/3/action/package_show?id=${packageId}`)
        .then(response => response.json())
        .then(data => resolve(data.result))
        .catch(reject);
    });

    // Get the datastore resource with all records
    const getDatastoreResource = (resource: any) => new Promise<Intersection[]>((resolve, reject) => {
      // Add limit=-1 to get all records
      fetch(`https://ckan0.cf.opendata.inter.prod-toronto.ca/api/3/action/datastore_search?id=${resource.id}&limit=50000`)
        .then(response => response.json())
        .then(data => {
          const records = data.result.records;
          console.log('Total records:', data.result.total);
          // Parse the geometry string into an object
          const parsedRecords = records.map((record: any) => ({
            ...record,
            geometry: JSON.parse(record.geometry)
          }));
          resolve(parsedRecords);
        })
        .catch(reject);
    });

    // Execute the sequence
    const pkg = await getPackage();
    const datastoreResources = pkg.resources.filter((r: any) => r.datastore_active);
    const intersections = await getDatastoreResource(datastoreResources[0]);
    
    console.log('Fetched intersections:', intersections.length);
    return intersections;

  } catch (error) {
    console.error('Error fetching intersections:', error);
    throw error;
  }
};

export const loadIntersections = async () => {
  try {
    const intersections = await fetchIntersections();
    
    // Extract coordinates and properties
    intersectionPoints = intersections.map(intersection => ({
      coordinates: [
        intersection.geometry.coordinates[0][0], // longitude
        intersection.geometry.coordinates[0][1]  // latitude
      ],
      id: intersection.INTERSECTION_ID,
      description: intersection.INTERSECTION_DESC
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
  radius: number // radius in kilometers
): { isNear: boolean; nearbyIntersections?: Array<{ id: number; description: string }> } => {
  if (!kdTree) return { isNear: false };
  
  // Use geokdbush.around to find nearby points
  const nearbyIndices = geokdbush.around(
    kdTree,
    longitude,
    latitude,
    1,  // maxResults: maximum number of points to return
    radius // kilometers
  ) as number[];
  
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