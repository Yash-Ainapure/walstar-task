import React, { useEffect, useState } from 'react'
import type { User } from '../types'
import { useNavigate } from 'react-router-dom'
import { listUsers, createUser, deleteUser } from '../api/users'
import { Link } from 'react-router-dom'

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


export default function DriversList() {
    const [users, setUsers] = useState<User[]>([])
    const [loading, setLoading] = useState(false)
    const [creating, setCreating] = useState(false)
    const [form, setForm] = useState({ username: '', password: '', name: '', phone: '', address: '', profileImage: null as File | null })
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
            const formData = new FormData()
            formData.append('username', form.username)
            formData.append('password', form.password)
            formData.append('name', form.name)
            formData.append('phone', form.phone)
            formData.append('address', form.address)
            formData.append('role', 'driver')
            if (form.profileImage) {
                formData.append('profileImage', form.profileImage)
            }
            
            await createUser(formData)
            setForm({ username: '', password: '', name: '', phone: '', address: '', profileImage: null })
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
                    <form onSubmit={handleCreate} className="space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <input 
                                className="border p-2 rounded" 
                                placeholder="Email" 
                                type="email"
                                value={form.username} 
                                onChange={e => setForm({ ...form, username: e.target.value })} 
                                required
                            />
                            <input 
                                className="border p-2 rounded" 
                                placeholder="Password" 
                                type="password"
                                value={form.password} 
                                onChange={e => setForm({ ...form, password: e.target.value })} 
                                required
                            />
                            <input 
                                className="border p-2 rounded" 
                                placeholder="Full Name" 
                                value={form.name} 
                                onChange={e => setForm({ ...form, name: e.target.value })} 
                                required
                            />
                            <input 
                                className="border p-2 rounded" 
                                placeholder="Phone Number" 
                                type="tel"
                                value={form.phone} 
                                onChange={e => setForm({ ...form, phone: e.target.value })} 
                                required
                            />
                        </div>
                        <input 
                            className="border p-2 rounded w-full" 
                            placeholder="Address" 
                            value={form.address} 
                            onChange={e => setForm({ ...form, address: e.target.value })} 
                            required
                        />
                        <div className="flex items-center gap-3">
                            <label className="text-sm font-medium text-gray-700">Profile Image:</label>
                            <input 
                                type="file" 
                                accept="image/*"
                                onChange={e => setForm({ ...form, profileImage: e.target.files?.[0] || null })}
                                className="border p-2 rounded flex-1"
                            />
                        </div>
                        <button 
                            type="submit"
                            className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 disabled:opacity-50" 
                            disabled={creating}
                        >
                            {creating ? 'Creating...' : 'Create Driver'}
                        </button>
                    </form>
                </div>


                <div className="bg-white p-4 rounded shadow">
                    <h3 className="font-medium mb-2">Driver list</h3>
                    {loading ? <div>Loading...</div> : (
                        <ul className="divide-y">
                            {users.map(u => (
                                <li key={u._id} className="py-4 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        {getImageUrl(u.photoUrl) ? (
                                            <img 
                                                src={getImageUrl(u.photoUrl)!} 
                                                alt={u.name || u.username}
                                                className="w-12 h-12 rounded-full object-cover"
                                                onError={(e) => {
                                                    // Fallback to default avatar if image fails to load
                                                    console.log('Image failed to load:', getImageUrl(u.photoUrl))
                                                    e.currentTarget.style.display = 'none'
                                                    e.currentTarget.nextElementSibling?.classList.remove('hidden')
                                                }}
                                            />
                                        ) : (
                                            <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                                                <span className="text-gray-500 text-sm">
                                                    {(u.name || u.username).charAt(0).toUpperCase()}
                                                </span>
                                            </div>
                                        )}
                                        <div>
                                            <div className="font-medium">{u.name || u.username}</div>
                                            <div className="text-sm text-gray-500">{u.username}</div>
                                            {u.phone && <div className="text-sm text-gray-500">📞 {u.phone}</div>}
                                            {u.address && <div className="text-sm text-gray-500">📍 {u.address}</div>}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Link to={`/drivers/${u._id}`} className="text-blue-600 hover:underline">View</Link>
                                        <Link to={`/drivers/${u._id}/edit`} className="text-green-600 hover:underline">Edit</Link>
                                        <button onClick={() => handleDelete(u._id)} className="text-red-600 hover:underline">Delete</button>
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