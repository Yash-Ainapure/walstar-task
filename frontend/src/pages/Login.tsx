import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login } from '../api/auth'


export default function LoginPage() {
const [username, setUsername] = useState('')
const [password, setPassword] = useState('')
const [err, setErr] = useState<string | null>(null)
const nav = useNavigate()


async function handleSubmit(e: React.FormEvent) {
e.preventDefault()
try {
const res = await login(username, password)
localStorage.setItem('token', res.data.token)
nav('/')
} catch (err: any) {
setErr(err?.response?.data?.msg || 'Login failed')
}
}


return (
<div className="flex items-center justify-center h-screen">
<div className="w-full max-w-md bg-white p-6 rounded shadow">
<h2 className="text-2xl font-semibold mb-4">Superadmin Login</h2>
{err && <div className="bg-red-100 text-red-700 p-2 mb-3 rounded">{err}</div>}
<form onSubmit={handleSubmit} className="space-y-4">
<input value={username} onChange={e => setUsername(e.target.value)} placeholder="Email" className="w-full p-2 border rounded" />
<input value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" type="password" className="w-full p-2 border rounded" />
<button className="w-full bg-blue-600 text-white p-2 rounded">Login</button>
</form>
</div>
</div>
)
}