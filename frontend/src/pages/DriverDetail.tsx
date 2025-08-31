import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getDates, getSessionsByDate } from '../api/routesApi'
import type { Session } from '../types'
import MapSession from '../components/MapSession'


export default function DriverDetail() {
    const { id } = useParams();
    const userId = id || 'me'
    const [dates, setDates] = useState<string[]>([])
    const [selectedDate, setSelectedDate] = useState<string | null>(null)
    const [sessions, setSessions] = useState<Session[]>([])
    const [selectedSession, setSelectedSession] = useState<Session | null>(null)


    useEffect(() => { fetchDates() }, [])


    async function fetchDates() {
        try {
            const res = await getDates(userId)
            console.log("id: "+userId)
            console.log(res)
            setDates(res.data.dates)
        } catch (e) { console.error(e) }
    }


    async function loadSessions(date: string) {
        try {
            setSelectedDate(date)
            const res = await getSessionsByDate(userId, date)
            console.log(res)
            setSessions(res.data.sessions)
            setSelectedSession(null)
        } catch (e) { console.error(e) }
    }


    return (
        <div className="p-6">
            <div className="max-w-6xl mx-auto grid grid-cols-3 gap-6">
                <div className="col-span-1 bg-white p-4 rounded shadow">
                    <h3 className="font-medium mb-2">Dates</h3>
                    <ul className="divide-y">
                        {dates.map(d => (
                            <li key={d} className="py-2">
                                <button onClick={() => loadSessions(d)} className={`w-full text-left ${d === selectedDate ? 'font-semibold' : ''}`}>{d}</button>
                            </li>
                        ))}
                    </ul>
                </div>


                <div className="col-span-2">
                    <div className="bg-white p-4 rounded shadow mb-4">
                        <h3 className="font-medium">Sessions {selectedDate ? `— ${selectedDate}` : ''}</h3>
                        <ul className="divide-y">
                            {sessions.map(s => (
                                <li key={s.sessionId} className="py-3 flex items-center justify-between">
                                    <div>
                                        <div className="font-medium">{s.sessionId}</div>
                                        <div className="text-sm text-gray-500">{new Date(s.startTime).toLocaleString()}</div>
                                    </div>
                                    <div>
                                        <button onClick={() => setSelectedSession(s)} className="text-blue-600">Open</button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>


                    {selectedSession && (
                        <div className="bg-white p-4 rounded shadow">
                            <h3 className="font-medium mb-2">Session: {selectedSession.sessionId}</h3>
                            <div className="mb-4">Start: {new Date(selectedSession.startTime).toLocaleString()} — End: {new Date(selectedSession.endTime).toLocaleString()}</div>
                            <MapSession session={selectedSession} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}