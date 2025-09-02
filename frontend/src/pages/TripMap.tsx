import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getSessionById } from '../api/routesApi'
import type { Session } from '../types'
import MapSession from '../components/MapSession'
import { calculateSessionDistance, formatDuration, getSessionLocations } from '../utils/tripUtils'

export default function TripMap() {
  const { id, sessionId } = useParams()
  const navigate = useNavigate()
  const userId = id || 'me'
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (sessionId) {
      fetchSession()
    }
  }, [sessionId])

  async function fetchSession() {
    try {
      setLoading(true)
      console.log('Fetching session:', userId, sessionId)
      const res = await getSessionById(userId, sessionId!)
      console.log('Session API response:', res)
      console.log('Session data:', res.data)
      
      // The API returns { date: string, session: Session }
      const sessionData = res.data.session
      
      console.log('Final session data:', sessionData)
      setSession(sessionData)
    } catch (e) {
      console.error('Error fetching session:', e)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading trip details...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Trip not found or failed to load</p>
          <p className="text-sm text-gray-500 mb-4">Session ID: {sessionId}</p>
          <button 
            onClick={() => navigate(`/drivers/${id}`)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Back to Driver
          </button>
        </div>
      </div>
    )
  }

  const distance = calculateSessionDistance(session)
  const duration = formatDuration(session.startTime, session.endTime)
  const { start, end } = getSessionLocations(session)
  
  // Debug logging
  console.log('Session object:', session)
  console.log('Session locations:', session.locations)
  console.log('Calculated distance:', distance)
  console.log('Calculated duration:', duration)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate(`/drivers/${id}`)}
                className="flex items-center text-gray-600 hover:text-gray-900"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Driver
              </button>
              <div className="h-6 w-px bg-gray-300"></div>
              <h1 className="text-xl font-semibold text-gray-900">Trip Details</h1>
            </div>
          </div>
        </div>
      </div>

      {/* Trip Info */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Session ID</h3>
              <p className="text-lg font-semibold text-gray-900">{session.sessionId}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Distance</h3>
              <p className="text-lg font-semibold text-gray-900">{distance.toFixed(2)} km</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Duration</h3>
              <p className="text-lg font-semibold text-gray-900">{duration}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Data Points</h3>
              <p className="text-lg font-semibold text-gray-900">{session.locations?.length || 0}</p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Start Time & Location</h3>
              <p className="text-sm text-gray-900 mb-1">
                {new Date(session.startTime).toLocaleString()}
              </p>
              {start && (
                <p className="text-xs text-gray-600">
                  {start.latitude.toFixed(6)}, {start.longitude.toFixed(6)}
                </p>
              )}
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">End Time & Location</h3>
              <p className="text-sm text-gray-900 mb-1">
                {new Date(session.endTime).toLocaleString()}
              </p>
              {end && (
                <p className="text-xs text-gray-600">
                  {end.latitude.toFixed(6)}, {end.longitude.toFixed(6)}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Map */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold text-gray-900">Route Map</h2>
          </div>
          <div className="h-[600px] w-full">
            <MapSession session={session} />
          </div>
        </div>
      </div>
    </div>
  )
}
