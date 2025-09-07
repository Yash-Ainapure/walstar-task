import { useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, Polyline, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import { CircleMarker } from 'react-leaflet'
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
function FitBounds({ positions }: { positions: LatLngExpression[] }): null {
    const map = useMap()
    useEffect(() => {
        if (positions.length) {
            const bounds = L.latLngBounds(positions)
            map.fitBounds(bounds, { padding: [50, 50] })
        }
    }, [positions, map])
    return null
}

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

    // raw latlng points (full list)
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
                const MAX_OSRM_POINTS = 100

                // --- Sampling (limit to 100 points like RN) ---
                let toSend = session.locations || []
                if (toSend.length > MAX_OSRM_POINTS) {
                    const step = Math.ceil(toSend.length / MAX_OSRM_POINTS)
                    const sampled = toSend.filter((_, i) => i % step === 0)
                    if (sampled[sampled.length - 1] !== toSend[toSend.length - 1]) {
                        sampled.push(toSend[toSend.length - 1])
                    }
                    toSend = sampled
                }

                // --- Build OSRM params ---
                const coordString = toSend.map(p => `${p.longitude},${p.latitude}`).join(';')

                // timestamps (strictly increasing)
                const rawTimestamps = toSend.map(l =>
                    Math.floor(new Date(l.timestampUTC).getTime() / 1000)
                )
                const timestamps = sanitizeTimestamps(rawTimestamps)

                // radiuses (10m default accuracy)
                const radiuses = new Array(toSend.length).fill(10)

                const url =
                    `https://router.project-osrm.org/match/v1/driving/${coordString}` +
                    `?geometries=geojson&overview=full&gaps=ignore&tidy=true` +
                    `&timestamps=${timestamps.join(';')}` +
                    `&radiuses=${radiuses.join(';')}`

                console.log("OSRM request →", url)

                const res = await fetch(url)
                const data = await res.json()

                if (!data || !data.matchings || data.matchings.length === 0) {
                    setMergedPolyline(latlngs)
                    setConfidenceSegments([])
                    setDistanceMeters(null)
                    return
                }

                // --- Pick best matching ---
                let bestMatchIndex = 0
                for (let i = 0; i < data.matchings.length; i++) {
                    if ((data.matchings[i].confidence ?? 0) >
                        (data.matchings[bestMatchIndex]?.confidence ?? -1)) {
                        bestMatchIndex = i
                    }
                }
                const bestMatching = data.matchings[bestMatchIndex]

                // snapped polyline
                const snappedPolyline: [number, number][] =
                    bestMatching.geometry.coordinates.map(
                        (c: [number, number]) => [c[1], c[0]] as [number, number]
                    )

                // update state
                setMergedPolyline(snappedPolyline)
                setConfidenceSegments([
                    { positions: snappedPolyline, confidence: bestMatching.confidence ?? 1 }
                ])
                setDistanceMeters(bestMatching.distance ?? null)
            } catch (e) {
                console.error("OSRM match error", e)
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

                    {/* Start + End markers styled like RN */}
                    {mergedPolyline.length >= 1 && (
                        <CircleMarker
                            center={mergedPolyline[0]}
                            radius={7}
                            pathOptions={{ fillColor: '#2ecc71', color: '#fff', weight: 2, fillOpacity: 1 }}
                        >
                            <Tooltip direction="top" offset={[0, -8]} opacity={1} permanent>
                                Start
                            </Tooltip>
                        </CircleMarker>
                    )}

                    {mergedPolyline.length >= 2 && (
                        <CircleMarker
                            center={mergedPolyline[mergedPolyline.length - 1]}
                            radius={7}
                            pathOptions={{ fillColor: '#e74c3c', color: '#fff', weight: 2, fillOpacity: 1 }}
                        >
                            <Tooltip direction="top" offset={[0, -8]} opacity={1} permanent>
                                End
                            </Tooltip>
                        </CircleMarker>
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
