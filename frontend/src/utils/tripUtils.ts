import type { Session } from '../types'

// Calculate distance between two coordinates using Haversine formula
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371 // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  return R * c
}

// Calculate total distance for a session
export function calculateSessionDistance(session: Session): number {
  if (!session || !session.locations || session.locations.length < 2) return 0
  
  let totalDistance = 0
  for (let i = 1; i < session.locations.length; i++) {
    const prev = session.locations[i - 1]
    const curr = session.locations[i]
    if (prev && curr && typeof prev.latitude === 'number' && typeof prev.longitude === 'number' &&
        typeof curr.latitude === 'number' && typeof curr.longitude === 'number') {
      totalDistance += calculateDistance(
        prev.latitude, prev.longitude,
        curr.latitude, curr.longitude
      )
    }
  }
  return totalDistance
}

// Get start and end locations for a session
export function getSessionLocations(session: Session) {
  if (!session || !session.locations || session.locations.length === 0) return { start: null, end: null }
  
  const start = session.locations[0]
  const end = session.locations[session.locations.length - 1]
  
  return { start, end }
}

// Format duration from start to end time
export function formatDuration(startTime: string, endTime: string): string {
  if (!startTime || !endTime) return '0m'
  
  const start = new Date(startTime)
  const end = new Date(endTime)
  
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return '0m'
  
  const diffMs = end.getTime() - start.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
  
  if (diffHours > 0) {
    return `${diffHours}h ${diffMinutes}m`
  }
  return `${diffMinutes}m`
}
