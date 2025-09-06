import { useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, Polyline, Marker, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import type { LatLngExpression } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Session } from '../types'

// ===== Utils =====

// Make sure timestamps are strictly increasing
function sanitizeTimestamps(raw: number[]): number[] {
    if (!raw.length) return []
    const fixed: number[] = []
    let last = raw[0]

    fixed.push(last)
    for (let i = 1; i < raw.length; i++) {
        let t = raw[i]
        if (!t || isNaN(t)) {
            t = last + 1
        }
        if (t <= last) {
            t = last + 1
        }
        fixed.push(t)
        last = t
    }
    return fixed
}

// Fit map to polyline bounds
function FitBounds({ positions }: { positions: LatLngExpression[] }) {
    const map = useMap()
    useEffect(() => {
        if (positions.length) {
            const bounds = L.latLngBounds(positions)
            map.fitBounds(bounds, { padding: [50, 50] })
        }
    }, [positions, map])
    return null
}

// Start (green) and End (red) icons
const startIcon = new L.Icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/190/190411.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
})
const endIcon = new L.Icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/190/190406.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
})

// Distance helpers
function metersBetween(a: [number, number], b: [number, number]) {
    const R = 6371000, toRad = (v: number) => (v * Math.PI) / 180
    const dLat = toRad(b[0] - a[0]), dLon = toRad(b[1] - a[1])
    const lat1 = toRad(a[0]), lat2 = toRad(b[0])
    const aa = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
    return 2 * R * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa))
}
const areClose = (a: [number, number], b: [number, number], tolM = 1) =>
    metersBetween(a, b) <= tolM

// Color by confidence
function confidenceColor(c: number) {
    if (c >= 0.8) return '#16a34a'  // strong (green)
    if (c >= 0.5) return '#f59e0b'  // medium (amber)
    return '#ef4444'                // weak (red)
}

export default function MapSession({ session }: { session: Session }) {
    const [distanceMeters, setDistanceMeters] = useState<number | null>(null)
    const [mergedPolyline, setMergedPolyline] = useState<[number, number][]>([])
    const [confidenceSegments, setConfidenceSegments] = useState<
        { positions: [number, number][]; confidence: number }[]
    >([])

    // raw latlng points
    const latlngs = useMemo(
        () => session.locations?.map(l => [l.latitude, l.longitude] as [number, number]) || [],
        [session]
    )
    const center: LatLngExpression = latlngs.length ? latlngs[0] : [0, 0]

    useEffect(() => {
        if (latlngs.length < 2) {
            setMergedPolyline(latlngs)
            setConfidenceSegments([])
            setDistanceMeters(0)
            return
        }

        const fetchMatched = async () => {
            try {
                const coordString = latlngs.map(p => `${p[1]},${p[0]}`).join(';')

                // prepare timestamps
                const rawTimestamps =
                    session.locations?.map(l => Math.floor(new Date(l.timestampUTC).getTime() / 1000)) || []
                const timestamps = sanitizeTimestamps(rawTimestamps)

                // prepare radiuses (10m default GPS accuracy for all points)
                const radiuses = new Array(latlngs.length).fill(15)

                const url =
                    `https://router.project-osrm.org/match/v1/driving/${coordString}` +
                    `?geometries=geojson&overview=full&gaps=ignore&tidy=true`
                    + `&timestamps=${timestamps.join(';')}`
                    + `&radiuses=${radiuses.join(';')}`

                let res, data;
                try {
                    console.log('started')
                    res = await fetch(url)
                    data = await res.json()
                    console.log('completed')

                } catch (error) {
                    console.log("got error")
                    console.log(error)
                }


                if (!data || !data.matchings || data.matchings.length === 0) {
                    setMergedPolyline(latlngs)
                    setConfidenceSegments([])
                    setDistanceMeters(null)
                    return
                }

                // Pick best matching (highest confidence)
                let bestMatchIndex = 0
                for (let i = 0; i < data.matchings.length; i++) {
                    if ((data.matchings[i].confidence ?? 0) > (data.matchings[bestMatchIndex]?.confidence ?? -1)) {
                        bestMatchIndex = i
                    }
                }
                const bestMatching = data.matchings[bestMatchIndex]

                // Use its geometry as the snapped polyline
                const snappedPolyline: [number, number][] =
                    bestMatching.geometry.coordinates.map(
                        (c: [number, number]) => [c[1], c[0]] as [number, number]
                    )

                // Update state
                setMergedPolyline(snappedPolyline)
                setConfidenceSegments([
                    { positions: snappedPolyline, confidence: bestMatching.confidence ?? 1 }
                ])
                setDistanceMeters(bestMatching.distance ?? null)
            } catch (e) {
                console.error('OSRM match error', e)
                setMergedPolyline(latlngs)
                setConfidenceSegments([])
                setDistanceMeters(null)
            }
        }

        fetchMatched()
    }, [latlngs, session.locations])

    return (
        <div className="w-full h-full flex flex-col">
            <div className="flex-1 min-h-0">
                <MapContainer center={center} zoom={17} style={{ height: '100%', width: '100%' }}>
                    <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution="&copy; OpenStreetMap contributors"
                    />

                    {/* Continuous snapped polyline */}
                    {mergedPolyline.length >= 2 && (
                        <Polyline positions={mergedPolyline} weight={5} opacity={0.7} />
                    )}

                    {/* Confidence overlay */}
                    {confidenceSegments.map((seg, i) => (
                        <Polyline
                            key={`conf-${i}`}
                            positions={seg.positions}
                            weight={6}
                            opacity={0.9}
                            color={confidenceColor(seg.confidence)}
                        />
                    ))}

                    {latlngs.length >= 1 && (
                        <Marker position={latlngs[0]} icon={startIcon}>
                            <Tooltip>Start</Tooltip>
                        </Marker>
                    )}
                    {latlngs.length >= 2 && (
                        <Marker position={latlngs[latlngs.length - 1]} icon={endIcon}>
                            <Tooltip>End</Tooltip>
                        </Marker>
                    )}

                    <FitBounds positions={mergedPolyline.length ? mergedPolyline : latlngs} />
                </MapContainer>
            </div>

            <div className="p-3 bg-gray-50 border-t text-sm">
                <div className="flex justify-between">
                    <span>Points: {session.locations?.length || 0}</span>
                    <span>
                        Distance:{' '}
                        {distanceMeters ? (distanceMeters / 1000).toFixed(3) + ' km' : 'calculating...'}
                    </span>
                </div>
            </div>
        </div>
    )
}
