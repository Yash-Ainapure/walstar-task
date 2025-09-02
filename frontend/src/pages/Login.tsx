import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login } from '../api/auth'


export default function LoginPage() {
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [err, setErr] = useState<string | null>(null)
    const [loading, setLoading] = useState(false);
    const nav = useNavigate()


    async function handleSubmit(e: React.FormEvent) {

        setLoading(true)
        e.preventDefault()
        try {
            const res = await login(username, password)
            localStorage.setItem('token', res.data.token)

            // Add delay to show loading animation
            await new Promise(resolve => setTimeout(resolve, 1500))

            setLoading(false)
            nav('/')
        } catch (err: any) {
            // Add delay even for errors to show consistent UX
            await new Promise(resolve => setTimeout(resolve, 1000))
            setLoading(false)
            setErr(err?.response?.data?.msg || 'Login failed')
        }
    }


    return (
        <div className="flex items-center justify-center h-screen">
            <div className="w-full max-w-md bg-white p-6 rounded shadow">
                <div className='mb-4'>
                    <h2 className="text-2xl font-semibold">Super Admin Login</h2>
                    <p className='text-slate-600'>Access the driver management dashboard</p>
                </div>
                {err && <div className="bg-red-100 text-red-700 p-2 mb-3 rounded">{err}</div>}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <p>Email:</p>
                    <input value={username} onChange={e => setUsername(e.target.value)} type='email' placeholder="admin@gmail.com" className="w-full p-2 rounded" />
                    <p>Password:</p>
                    <input value={password} onChange={e => setPassword(e.target.value)} placeholder="*****" type="password" className="w-full p-2 rounded" />
                    <button className={`text-white p-2 w-full rounded ${loading ? "bg-blue-400" : "bg-blue-600"}`} disabled={loading}>{loading ? "signing in..." : "Sign in"}</button>
                </form>
            </div>
        </div>
    )
}