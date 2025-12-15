/**
 * Generate unique order number
 * Format: ORD-YYYYMMDD-XXXXX
 * Example: ORD-20231215-ABC12
 */
function generateOrderNumber() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  // Generate random alphanumeric string
  const randomChars = Math.random().toString(36).substring(2, 7).toUpperCase();
  
  // Add timestamp milliseconds for extra uniqueness
  const timestamp = Date.now().toString().slice(-4);
  
  return `ORD-${year}${month}${day}-${randomChars}${timestamp}`;
}

/**
 * Generate hotel admin code
 * Format: HOTEL-XXXXX
 */
function generateHotelCode(hotelName) {
  const prefix = hotelName
    .split(' ')
    .map(word => word.charAt(0))
    .join('')
    .toUpperCase()
    .substring(0, 3);
  
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `HOTEL-${prefix}${randomNum}`;
}

/**
 * Generate tracking number for delivery
 */
function generateTrackingNumber() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid similar characters
  let result = '';
  for (let i = 0; i < 10; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `TRK-${result}`;
}

module.exports = {
  generateOrderNumber,
  generateHotelCode,
  generateTrackingNumber,
};