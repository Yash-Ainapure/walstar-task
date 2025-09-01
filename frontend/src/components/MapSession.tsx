import { useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, Polyline, Marker, Tooltip, useMap } from 'react-leaflet'
import L, { LatLngExpression } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Session } from '../types'
import { osrmRoute } from '../api/routesApi'

function haversineDistance(a: [number, number], b: [number, number]): number {
    const R = 6371000 // Earth's radius in meters
    const toRad = (v: number) => (v * Math.PI) / 180
    const dLat = toRad(b[0] - a[0])
    const dLon = toRad(b[1] - a[1])
    const lat1 = toRad(a[0])
    const lat2 = toRad(b[0])
    const sinDLat = Math.sin(dLat / 2)
    const sinDLon = Math.sin(dLon / 2)
    const aa = sinDLat ** 2 + Math.cos(lat1) * Math.cos(lat2) * sinDLon ** 2
    const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa))
    return R * c
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

// Remove consecutive duplicates
function filterDuplicates(points: [number, number][]): [number, number][] {
    return points.filter((pos, i, arr) =>
        i === 0 || pos[0] !== arr[i - 1][0] || pos[1] !== arr[i - 1][1]
    )
}

// Split polyline if consecutive points are far apart
function splitPolylineByGap(points: [number, number][], maxGapMeters = 100): [number, number][][] {
    const result: [number, number][][] = []
    let segment: [number, number][] = []

    const distance = (a: [number, number], b: [number, number]) => {
        const R = 6371000
        const toRad = (v: number) => (v * Math.PI) / 180
        const dLat = toRad(b[0] - a[0])
        const dLon = toRad(b[1] - a[1])
        const lat1 = toRad(a[0])
        const lat2 = toRad(b[0])
        const sinDLat = Math.sin(dLat / 2)
        const sinDLon = Math.sin(dLon / 2)
        const aa = sinDLat ** 2 + Math.cos(lat1) * Math.cos(lat2) * sinDLon ** 2
        const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa))
        return R * c
    }

    for (let i = 0; i < points.length; i++) {
        if (i > 0 && distance(points[i - 1], points[i]) > maxGapMeters) {
            if (segment.length) result.push(segment)
            segment = []
        }
        segment.push(points[i])
    }
    if (segment.length) result.push(segment)
    return result
}

export default function MapSession({ session }: { session: Session }) {
    const [routeGeo, setRouteGeo] = useState<[number, number][] | null>(null)
    const [distanceMeters, setDistanceMeters] = useState<number | null>(null)

    // raw latlng points
    const latlngs = useMemo(() => session.locations.map(l => [l.latitude, l.longitude] as [number, number]), [session])
    const filteredLatlngs = useMemo(() => filterDuplicates(latlngs), [latlngs])
    const center: LatLngExpression = filteredLatlngs.length ? filteredLatlngs[0] : [0, 0]


    useEffect(() => {
        if (filteredLatlngs.length < 2) {
            setDistanceMeters(0)
            return
        }

        let totalDistance = 0
        for (let i = 1; i < filteredLatlngs.length; i++) {
            const point1 = filteredLatlngs[i - 1]
            const point2 = filteredLatlngs[i]
            totalDistance += haversineDistance(point1, point2)
        }

        setDistanceMeters(totalDistance)
    }, [filteredLatlngs])

    // Fetch route
    // useEffect(() => {
    //     if (filteredLatlngs.length < 2) return
    //     // Two points → straight line
    //     if (filteredLatlngs.length === 2) {
    //         setRouteGeo(filteredLatlngs)
    //         // Haversine distance
    //         const [a, b] = filteredLatlngs
    //         const R = 6371000
    //         const toRad = (v: number) => (v * Math.PI) / 180
    //         const dLat = toRad(b[0] - a[0])
    //         const dLon = toRad(b[1] - a[1])
    //         const lat1 = toRad(a[0])
    //         const lat2 = toRad(b[0])
    //         const sinDLat = Math.sin(dLat / 2)
    //         const sinDLon = Math.sin(dLon / 2)
    //         const aa = sinDLat ** 2 + Math.cos(lat1) * Math.cos(lat2) * sinDLon ** 2
    //         const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa))
    //         setDistanceMeters(R * c)
    //         return
    //     }
    //     // Three or more points → OSRM
    //     const fetchRoute = async () => {
    //         const coords = filteredLatlngs.map(p => `${p[1]},${p[0]}`).join(';')
    //         try {
    //             const res = await osrmRoute(coords)
    //             if (res.data.geometry?.coordinates) {
    //                 setRouteGeo(res.data.geometry.coordinates.map(c => [c[1], c[0]]))
    //                 setDistanceMeters(res.data.distanceMeters ?? res.data.fallbackDistanceMeters ?? null)
    //             } else {
    //                 setRouteGeo(null)
    //                 setDistanceMeters(res.data.fallbackDistanceMeters ?? null)
    //             }
    //         } catch (e) {
    //             console.error('OSRM error', e)
    //             setRouteGeo(null)
    //         }
    //     }
    //     fetchRoute()
    // }, [filteredLatlngs])
    // const polylinePositions = routeGeo ?? filteredLatlngs


    const polylineSegments = splitPolylineByGap(filteredLatlngs, 200)

    return (
        <div className="w-full h-[500px] rounded shadow">
            <MapContainer center={center} zoom={17} style={{ height: '100%', width: '100%' }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap contributors' />

                {polylineSegments.map((seg, idx) => (
                    <Polyline key={idx} positions={seg} color="blue" />
                ))}

                {filteredLatlngs.length >= 1 && <Marker position={filteredLatlngs[0]} icon={startIcon}><Tooltip>Start</Tooltip></Marker>}
                {filteredLatlngs.length >= 2 && <Marker position={filteredLatlngs[filteredLatlngs.length - 1]} icon={endIcon}><Tooltip>End</Tooltip></Marker>}

                {/* <FitBounds positions={polylinePositions} /> */}
                <FitBounds positions={filteredLatlngs} />
            </MapContainer>

            <div className="p-2">
                <div>Points: {session.locations.length}</div>
                <div>Distance: {distanceMeters ? (distanceMeters / 1000).toFixed(3) + ' km' : 'calculating...'}</div>
            </div>
        </div>
    )
}
