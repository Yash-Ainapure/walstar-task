import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from './pages/Login'
import DriversList from './pages/DriversList'
import DriverDetail from './pages/DriverDetail'


function RequireAuth({ children }: { children: React.ReactElement }) {
const token = localStorage.getItem('token');
if (!token) return <Navigate to="/login" />;
return children;
}


export default function App() {
return (
<div className="min-h-screen bg-gray-50">
<Routes>
<Route path="/login" element={<LoginPage />} />
<Route path="/" element={<RequireAuth><DriversList /></RequireAuth>} />
<Route path="/drivers/:id" element={<RequireAuth><DriverDetail /></RequireAuth>} />
</Routes>
</div>
)
}