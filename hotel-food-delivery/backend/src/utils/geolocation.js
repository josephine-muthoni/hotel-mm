/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lon1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lon2 - Longitude of point 2
 * @returns {number} Distance in meters
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distanceKm = R * c;
  
  return distanceKm * 1000; // Convert to meters
}

/**
 * Check if location is within delivery radius
 * @param {number} hotelLat - Hotel latitude
 * @param {number} hotelLon - Hotel longitude
 * @param {number} userLat - User latitude
 * @param {number} userLon - User longitude
 * @param {number} radius - Delivery radius in meters
 * @returns {boolean} True if within radius
 */
function isWithinDeliveryRadius(hotelLat, hotelLon, userLat, userLon, radius) {
  if (!hotelLat || !hotelLon || !userLat || !userLon) {
    return false;
  }
  
  const distance = calculateDistance(hotelLat, hotelLon, userLat, userLon);
  return distance <= radius;
}

/**
 * Convert degrees to radians
 */
function toRad(degrees) {
  return degrees * (Math.PI / 180);
}

/**
 * Calculate estimated delivery time in minutes
 * @param {number} distance - Distance in meters
 * @param {string} traffic - Traffic condition: 'low', 'medium', 'high'
 * @returns {number} Estimated minutes
 */
function estimateDeliveryTime(distance, traffic = 'medium') {
  const baseSpeed = 30; // km/h average speed
  const trafficMultiplier = {
    low: 1.0,
    medium: 1.3,
    high: 1.8,
  };
  
  const speed = baseSpeed / trafficMultiplier[traffic];
  const timeHours = (distance / 1000) / speed;
  const timeMinutes = timeHours * 60;
  
  // Add preparation time (15-25 minutes)
  const prepTime = 20;
  
  return Math.ceil(timeMinutes + prepTime);
}

/**
 * Get bounding box coordinates for searching nearby locations
 * @param {number} lat - Center latitude
 * @param {number} lng - Center longitude
 * @param {number} radius - Radius in meters
 * @returns {Object} Bounding box coordinates
 */
function getBoundingBox(lat, lng, radius) {
  const earthRadius = 6371000; // Earth's radius in meters
  
  // Convert latitude and longitude from degrees to radians
  const latRad = toRad(lat);
  const lngRad = toRad(lng);
  
  // Angular distance in radians
  const angularDistance = radius / earthRadius;
  
  // Calculate min and max latitude
  const minLat = latRad - angularDistance;
  const maxLat = latRad + angularDistance;
  
  // Calculate min and max longitude
  const deltaLng = Math.asin(Math.sin(angularDistance) / Math.cos(latRad));
  const minLng = lngRad - deltaLng;
  const maxLng = lngRad + deltaLng;
  
  // Convert back to degrees
  return {
    minLat: toDegrees(minLat),
    maxLat: toDegrees(maxLat),
    minLng: toDegrees(minLng),
    maxLng: toDegrees(maxLng),
  };
}

function toDegrees(radians) {
  return radians * (180 / Math.PI);
}

module.exports = {
  calculateDistance,
  isWithinDeliveryRadius,
  estimateDeliveryTime,
  getBoundingBox,
  toRad,
  toDegrees,
};