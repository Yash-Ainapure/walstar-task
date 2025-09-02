import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getDates, getSessionsByDate, deleteSession, updateSessionName } from '../api/routesApi'
import { getUserById } from '../api/users'
import type { Session, User } from '../types'
import { calculateSessionDistance, formatDuration, getSessionLocations } from '../utils/tripUtils'

// Helper function to get full image URL
function getImageUrl(photoUrl: string | undefined): string | null {
    if (!photoUrl) return null
    
    // If it's already a full URL, return as is
    if (photoUrl.startsWith('http://') || photoUrl.startsWith('https://')) {
        return photoUrl
    }
    
    // Convert relative path to full URL - static files are served from server root, not /api
    const baseUrl = window.location.hostname === 'localhost' 
        ? 'http://localhost:5001' 
        : 'https://walstar-task.onrender.com'
    
    return `${baseUrl}${photoUrl}`
}

export default function DriverDetail() {
    const { id } = useParams()
    const navigate = useNavigate()
    const userId = id || 'me'
    const [dates, setDates] = useState<string[]>([])
    const [selectedDate, setSelectedDate] = useState<string | null>(null)
    const [sessions, setSessions] = useState<Session[]>([])
    const [loading, setLoading] = useState(false)
    const [stats, setStats] = useState({ totalTrips: 0, totalDistance: 0, totalDuration: 0 })
    const [editingTrip, setEditingTrip] = useState<string | null>(null)
    const [tripNames, setTripNames] = useState<{[key: string]: string}>({})
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
    const [driver, setDriver] = useState<User | null>(null)
    const [driverLoading, setDriverLoading] = useState(false)

    useEffect(() => { 
        fetchDates()
        fetchDriverDetails()
    }, [])

    useEffect(() => {
        calculateStats()
    }, [sessions])

    async function fetchDates() {
        try {
            const res = await getDates(userId)
            setDates(res.data.dates)
            // Auto-select most recent date
            if (res.data.dates.length > 0) {
                loadSessions(res.data.dates[0])
            }
        } catch (e) { console.error(e) }
    }

    async function fetchDriverDetails() {
        if (userId === 'me') return // Skip for current user
        
        try {
            setDriverLoading(true)
            const res = await getUserById(userId)
            setDriver(res.data)
        } catch (e) {
            console.error('Failed to fetch driver details:', e)
        } finally {
            setDriverLoading(false)
        }
    }

    async function loadSessions(date: string) {
        try {
            setLoading(true)
            setSelectedDate(date)
            const res = await getSessionsByDate(userId, date)
            setSessions(res.data.sessions)
        } catch (e) { 
            console.error(e)
            setSessions([])
        } finally {
            setLoading(false)
        }
    }

    function calculateStats() {
        const totalTrips = sessions.length
        const totalDistance = sessions.reduce((sum, session) => sum + calculateSessionDistance(session), 0)
        const totalDuration = sessions.reduce((sum, session) => {
            const start = new Date(session.startTime).getTime()
            const end = new Date(session.endTime).getTime()
            return sum + (end - start)
        }, 0)
        
        setStats({ totalTrips, totalDistance, totalDuration: totalDuration / (1000 * 60) }) // duration in minutes
    }

    function handleTripClick(session: Session) {
        navigate(`/drivers/${id}/trip/${session.sessionId}`)
    }

    async function handleDeleteTrip(sessionId: string) {
        try {
            await deleteSession(userId, sessionId)
            setSessions(prev => prev.filter(s => s.sessionId !== sessionId))
            setShowDeleteConfirm(null)
        } catch (error) {
            console.error('Failed to delete trip:', error)
            alert('Failed to delete trip. Please try again.')
        }
    }

    async function handleRenameTrip(sessionId: string, newName: string) {
        try {
            await updateSessionName(userId, sessionId, newName)
            setTripNames(prev => ({ ...prev, [sessionId]: newName }))
            setEditingTrip(null)
        } catch (error) {
            console.error('Failed to rename trip:', error)
            alert('Failed to rename trip. Please try again.')
        }
    }

    function startEditing(sessionId: string, currentName: string) {
        setEditingTrip(sessionId)
        setTripNames(prev => ({ ...prev, [sessionId]: currentName }))
    }

    function cancelEditing() {
        setEditingTrip(null)
        setTripNames({})
    }

    function handleKeyPress(e: React.KeyboardEvent, sessionId: string) {
        if (e.key === 'Enter') {
            handleRenameTrip(sessionId, tripNames[sessionId] || '')
        } else if (e.key === 'Escape') {
            cancelEditing()
        }
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white shadow-sm border-b">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center space-x-4">
                            <button
                                onClick={() => navigate('/drivers')}
                                className="flex items-center text-gray-600 hover:text-gray-900"
                            >
                                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                                Back to Drivers
                            </button>
                            <div className="h-6 w-px bg-gray-300"></div>
                            <h1 className="text-xl font-semibold text-gray-900">Driver Details</h1>
                        </div>
                        <button
                            onClick={() => navigate(`/drivers/${id}/edit`)}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                        >
                            Edit Driver
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Driver Profile Section */}
                <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
                    <div className="flex items-start space-x-6">
                        <div className="flex-shrink-0">
                            {getImageUrl(driver?.photoUrl) ? (
                                <img 
                                    src={getImageUrl(driver?.photoUrl)!} 
                                    alt={driver?.name || 'Driver'}
                                    className="w-20 h-20 rounded-full object-cover border-2 border-gray-200"
                                    onError={(e) => {
                                        // Fallback to default avatar if image fails to load
                                        console.log('Image failed to load:', getImageUrl(driver?.photoUrl))
                                        e.currentTarget.style.display = 'none'
                                        e.currentTarget.nextElementSibling?.classList.remove('hidden')
                                    }}
                                />
                            ) : null}
                            <div className={`w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center ${getImageUrl(driver?.photoUrl) ? 'hidden' : ''}`}>
                                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                            </div>
                        </div>
                        <div className="flex-1">
                            {driverLoading ? (
                                <div className="animate-pulse">
                                    <div className="h-8 bg-gray-200 rounded w-48 mb-2"></div>
                                    <div className="h-4 bg-gray-200 rounded w-64"></div>
                                </div>
                            ) : (
                                <>
                                    <h2 className="text-2xl font-bold text-gray-900 mb-2">
                                        {driver?.name || `Driver ${userId}`}
                                    </h2>
                                    {driver?.username && (
                                        <p className="text-gray-600 mb-2">{driver.username}</p>
                                    )}
                                    {driver?.phone && (
                                        <p className="text-gray-500 text-sm mb-2">Phone: {driver.phone}</p>
                                    )}
                                    {driver?.address && (
                                        <p className="text-gray-500 text-sm mb-2">Address: {driver.address}</p>
                                    )}
                                </>
                            )}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
                                <div className="text-center p-4 bg-gray-50 rounded-lg">
                                    <div className="text-2xl font-bold text-blue-600">{stats.totalTrips}</div>
                                    <div className="text-sm text-gray-600">Total Trips</div>
                                </div>
                                <div className="text-center p-4 bg-gray-50 rounded-lg">
                                    <div className="text-2xl font-bold text-green-600">{stats.totalDistance.toFixed(1)} km</div>
                                    <div className="text-sm text-gray-600">Distance Today</div>
                                </div>
                                <div className="text-center p-4 bg-gray-50 rounded-lg">
                                    <div className="text-2xl font-bold text-purple-600">{Math.round(stats.totalDuration)} min</div>
                                    <div className="text-sm text-gray-600">Drive Time</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Content */}
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    {/* Date Selector */}
                    <div className="lg:col-span-1">
                        <div className="bg-white rounded-lg shadow-sm p-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Travel Dates</h3>
                            <div className="space-y-2">
                                {dates.map(date => (
                                    <button
                                        key={date}
                                        onClick={() => loadSessions(date)}
                                        className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
                                            date === selectedDate 
                                                ? 'bg-blue-100 text-blue-700 font-medium' 
                                                : 'text-gray-700 hover:bg-gray-100'
                                        }`}
                                    >
                                        {new Date(date).toLocaleDateString('en-US', {
                                            weekday: 'short',
                                            month: 'short',
                                            day: 'numeric'
                                        })}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Trips List */}
                    <div className="lg:col-span-3">
                        <div className="bg-white rounded-lg shadow-sm">
                            <div className="px-6 py-4 border-b border-gray-200">
                                <h3 className="text-lg font-semibold text-gray-900">
                                    Recent Trips {selectedDate && `— ${new Date(selectedDate).toLocaleDateString()}`}
                                </h3>
                            </div>
                            
                            {loading ? (
                                <div className="p-8 text-center">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                                    <p className="text-gray-600">Loading trips...</p>
                                </div>
                            ) : sessions.length === 0 ? (
                                <div className="p-8 text-center text-gray-500">
                                    <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                                    </svg>
                                    No trips found for this date
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-200">
                                    {sessions.map(session => {
                                        const distance = calculateSessionDistance(session)
                                        const duration = formatDuration(session.startTime, session.endTime)
                                        const { start, end } = getSessionLocations(session)
                                        const isEditing = editingTrip === session.sessionId
                                        const displayName = tripNames[session.sessionId] || session.name || `Trip ${session.sessionId.slice(-8)}`
                                        
                                        return (
                                            <div key={session.sessionId} className="p-6 hover:bg-gray-50 transition-colors">
                                                <div className="flex items-center justify-between">
                                                    <div 
                                                        className="flex-1 cursor-pointer"
                                                        onClick={() => !isEditing && handleTripClick(session)}
                                                    >
                                                        <div className="flex items-center space-x-3 mb-2">
                                                            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                                                            {isEditing ? (
                                                                <input
                                                                    type="text"
                                                                    value={tripNames[session.sessionId] || ''}
                                                                    onChange={(e) => setTripNames(prev => ({ ...prev, [session.sessionId]: e.target.value }))}
                                                                    onKeyDown={(e) => handleKeyPress(e, session.sessionId)}
                                                                    onBlur={() => handleRenameTrip(session.sessionId, tripNames[session.sessionId] || '')}
                                                                    className="text-lg font-medium text-gray-900 bg-white border border-blue-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                                    autoFocus
                                                                />
                                                            ) : (
                                                                <h4 className="text-lg font-medium text-gray-900">
                                                                    {displayName}
                                                                </h4>
                                                            )}
                                                        </div>
                                                        
                                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                                            <div>
                                                                <span className="text-gray-500">Distance:</span>
                                                                <div className="font-medium text-gray-900">{distance.toFixed(2)} km</div>
                                                            </div>
                                                            <div>
                                                                <span className="text-gray-500">Duration:</span>
                                                                <div className="font-medium text-gray-900">{duration}</div>
                                                            </div>
                                                            <div>
                                                                <span className="text-gray-500">Start:</span>
                                                                <div className="font-medium text-gray-900">
                                                                    {new Date(session.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <span className="text-gray-500">End:</span>
                                                                <div className="font-medium text-gray-900">
                                                                    {new Date(session.endTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        
                                                        {start && end && (
                                                            <div className="mt-3 text-xs text-gray-500">
                                                                <div>From: {start.latitude.toFixed(4)}, {start.longitude.toFixed(4)}</div>
                                                                <div>To: {end.latitude.toFixed(4)}, {end.longitude.toFixed(4)}</div>
                                                            </div>
                                                        )}
                                                    </div>
                                                    
                                                    <div className="ml-4 flex items-center space-x-2">
                                                        {!isEditing && (
                                                            <>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        startEditing(session.sessionId, displayName)
                                                                    }}
                                                                    className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                                                                    title="Rename trip"
                                                                >
                                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                                    </svg>
                                                                </button>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        setShowDeleteConfirm(session.sessionId)
                                                                    }}
                                                                    className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                                                                    title="Delete trip"
                                                                >
                                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                                    </svg>
                                                                </button>
                                                            </>
                                                        )}
                                                        {!isEditing && (
                                                            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                            </svg>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Delete Trip</h3>
                        <p className="text-gray-600 mb-6">
                            Are you sure you want to delete this trip? This action cannot be undone.
                        </p>
                        <div className="flex justify-end space-x-3">
                            <button
                                onClick={() => setShowDeleteConfirm(null)}
                                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleDeleteTrip(showDeleteConfirm)}
                                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}