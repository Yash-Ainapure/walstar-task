import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { User } from '../types'
import { getUserById, updateUser } from '../api/users'

export default function EditDriver() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const [loading, setLoading] = useState(true)
    const [updating, setUpdating] = useState(false)
    const [user, setUser] = useState<User | null>(null)
    const [form, setForm] = useState({
        username: '',
        password: '',
        name: '',
        phone: '',
        address: '',
        profileImage: null as File | null
    })

    useEffect(() => {
        if (id) {
            fetchUser(id)
        }
    }, [id])

    async function fetchUser(userId: string) {
        setLoading(true)
        try {
            const res = await getUserById(userId)
            const userData = res.data
            setUser(userData)
            setForm({
                username: userData.username || '',
                password: '',
                name: userData.name || '',
                phone: userData.phone || '',
                address: userData.address || '',
                profileImage: null
            })
        } catch (err) {
            console.error('Error fetching user:', err)
            navigate('/drivers')
        }
        setLoading(false)
    }

    async function handleUpdate(e: React.FormEvent) {
        e.preventDefault()
        if (!id) return

        setUpdating(true)
        try {
            const formData = new FormData()
            formData.append('username', form.username)
            if (form.password) {
                formData.append('password', form.password)
            }
            formData.append('name', form.name)
            formData.append('phone', form.phone)
            formData.append('address', form.address)
            if(user?.role=='superadmin'){
                formData.append('role', 'superadmin')
            }
            else{
                formData.append('role', 'driver')
            }
            if (form.profileImage) {
                formData.append('profileImage', form.profileImage)
            }

            await updateUser(id, formData)
            navigate('/drivers')
        } catch (err) {
            console.error('Error updating user:', err)
        }
        setUpdating(false)
    }

    if (loading) {
        return (
            <div className="p-6">
                <div className="max-w-2xl mx-auto">
                    <div>Loading...</div>
                </div>
            </div>
        )
    }

    if (!user) {
        return (
            <div className="p-6">
                <div className="max-w-2xl mx-auto">
                    <div>Driver not found</div>
                </div>
            </div>
        )
    }

    return (
        <div className="p-6">
            <div className="max-w-2xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-2xl font-semibold">Edit Driver</h1>
                    <button 
                        onClick={() => navigate('/drivers')}
                        className="text-gray-600 hover:text-gray-800"
                    >
                        ← Back to Drivers
                    </button>
                </div>

                <div className="bg-white p-6 rounded-lg shadow">
                    {user.photoUrl && (
                        <div className="mb-4 flex justify-center">
                            <img 
                                src={user.photoUrl}
                                alt={user.name || user.username}
                                className="w-24 h-24 rounded-full object-cover"
                            />
                        </div>
                    )}

                    <form onSubmit={handleUpdate} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Email *
                                </label>
                                <input 
                                    className="w-full border p-3 rounded-md" 
                                    placeholder="Email" 
                                    type="email"
                                    value={form.username} 
                                    onChange={e => setForm({ ...form, username: e.target.value })} 
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Password (leave blank to keep current)
                                </label>
                                <input 
                                    className="w-full border p-3 rounded-md" 
                                    placeholder="New Password" 
                                    type="password"
                                    value={form.password} 
                                    onChange={e => setForm({ ...form, password: e.target.value })} 
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Full Name *
                                </label>
                                <input 
                                    className="w-full border p-3 rounded-md" 
                                    placeholder="Full Name" 
                                    value={form.name} 
                                    onChange={e => setForm({ ...form, name: e.target.value })} 
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Phone Number *
                                </label>
                                <input 
                                    className="w-full border p-3 rounded-md" 
                                    placeholder="Phone Number" 
                                    type="tel"
                                    value={form.phone} 
                                    onChange={e => setForm({ ...form, phone: e.target.value })} 
                                    required
                                />
                            </div>
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Address *
                            </label>
                            <input 
                                className="w-full border p-3 rounded-md" 
                                placeholder="Address" 
                                value={form.address} 
                                onChange={e => setForm({ ...form, address: e.target.value })} 
                                required
                            />
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Profile Image
                            </label>
                            <input 
                                type="file" 
                                accept="image/*"
                                onChange={e => setForm({ ...form, profileImage: e.target.files?.[0] || null })}
                                className="w-full border p-3 rounded-md"
                            />
                            <p className="text-sm text-gray-500 mt-1">
                                Leave empty to keep current image
                            </p>
                        </div>
                        
                        <div className="flex gap-3 pt-4">
                            <button 
                                type="submit"
                                className="bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 disabled:opacity-50 flex-1" 
                                disabled={updating}
                            >
                                {updating ? 'Updating...' : 'Update Driver'}
                            </button>
                            <button 
                                type="button"
                                onClick={() => navigate('/drivers')}
                                className="bg-gray-300 text-gray-700 px-6 py-3 rounded-md hover:bg-gray-400"
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    )
}
