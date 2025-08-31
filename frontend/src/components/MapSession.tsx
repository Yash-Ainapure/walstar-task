import { useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, Polyline, Marker, Tooltip } from 'react-leaflet'
import type { LatLngExpression } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Session } from '../types'
import { osrmRoute } from '../api/routesApi'


export default function MapSession({ session }: { session: Session }) {
    const [routeGeo, setRouteGeo] = useState<any | null>(null)
    const [distanceMeters, setDistanceMeters] = useState<number | null>(null)


    const latlngs = useMemo(() => session.locations.map(l => [l.latitude, l.longitude] as [number, number]), [session])
    const center: LatLngExpression = latlngs.length ? latlngs[0] : [0, 0]


    useEffect(() => {
        async function fetchRoute() {
            if (session.locations.length < 2) return
            const coords = session.locations.map(p => `${p.longitude},${p.latitude}`).join(';')
            try {
                const res = await osrmRoute(coords)
                if (res.data.geometry) {
                    setRouteGeo(res.data.geometry)
                    setDistanceMeters(res.data.distanceMeters ?? res.data.fallbackDistanceMeters ?? null)
                } else {
                    setDistanceMeters(res.data.fallbackDistanceMeters ?? null)
                }
            } catch (e) {
                console.error('osrm error', e)
            }
        }
        fetchRoute()
    }, [session])


    return (
        <div className="w-full h-[500px] rounded shadow">
            <MapContainer center={center} zoom={17} style={{ height: '100%', width: '100%' }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap contributors' />
                {routeGeo ? (
                    <Polyline positions={(routeGeo.coordinates as [number, number][]).map(c => [c[1], c[0]])} />
                ) : (
                    <Polyline positions={latlngs} />
                )}
                {latlngs.map((pos, i) => (
                    <Marker key={i} position={pos}>
                        <Tooltip>{new Date(session.locations[i].timestampUTC).toLocaleString()}</Tooltip>
                    </Marker>
                ))}
            </MapContainer>
            <div className="p-2">
                <div>Points: {session.locations.length}</div>
                <div>Distance: {distanceMeters ? (distanceMeters / 1000).toFixed(3) + ' km' : 'calculating...'}</div>
            </div>
        </div>
    )
}