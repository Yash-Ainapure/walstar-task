import React, { useEffect, useState } from 'react'
import type { User } from '../types'
import { useNavigate } from 'react-router-dom'
import { listUsers, createUser, deleteUser } from '../api/users'
import { Link } from 'react-router-dom'


export default function DriversList() {
    const [users, setUsers] = useState<User[]>([])
    const [loading, setLoading] = useState(false)
    const [creating, setCreating] = useState(false)
    const [form, setForm] = useState({ username: '', password: '', name: '' })
    const nav = useNavigate()


    useEffect(() => { fetchUsers() }, [])


    async function fetchUsers() {
        setLoading(true)
        try {
            const res = await listUsers()
            setUsers(res.data)
        } catch (e) { console.error(e) }
        setLoading(false)
    }


    async function handleCreate(e: React.FormEvent) {
        e.preventDefault()
        setCreating(true)
        try {
            await createUser({ username: form.username, password: form.password, name: form.name, role: 'driver' })
            setForm({ username: '', password: '', name: '' })
            fetchUsers()
        } catch (err) { console.error(err) }
        setCreating(false)
    }


    async function handleDelete(id: string) {
        if (!confirm('Delete user?')) return
        try { await deleteUser(id); fetchUsers() } catch (e) { console.error(e) }
    }


    return (
        <div className="p-6">
            <div className="max-w-4xl mx-auto">
                <div className="flex items-center justify-between mb-4">
                    <h1 className="text-2xl font-semibold">Drivers</h1>
                    <button onClick={() => { localStorage.removeItem('token'); nav('/login') }} className="text-sm text-gray-600">Logout</button>
                </div>


                <div className="bg-white p-4 rounded shadow mb-6">
                    <h3 className="font-medium mb-2">Create driver</h3>
                    <form onSubmit={handleCreate} className="flex gap-2">
                        <input className="border p-2 flex-1" placeholder="email" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} />
                        <input className="border p-2" placeholder="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
                        <input className="border p-2" placeholder="name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                        <button className="bg-green-600 text-white px-4" disabled={creating}>{creating ? 'Creating...' : 'Create'}</button>
                    </form>
                </div>


                <div className="bg-white p-4 rounded shadow">
                    <h3 className="font-medium mb-2">Driver list</h3>
                    {loading ? <div>Loading...</div> : (
                        <ul className="divide-y">
                            {users.map(u => (
                                <li key={u._id} className="py-3 flex items-center justify-between">
                                    <div>
                                        <div className="font-medium">{u.name || u.username}</div>
                                        <div className="text-sm text-gray-500">{u.username}</div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Link to={`/drivers/${u._id}`} className="text-blue-600">View</Link>
                                        <button onClick={() => handleDelete(u._id)} className="text-red-600">Delete</button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    )
}