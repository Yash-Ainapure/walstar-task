export type Role = 'superadmin' | 'driver';


export interface User {
_id: string;
username: string; // email
name?: string;
phone?: string;
address?: string;
photoUrl?: string;
role: Role;
}


export interface LocationPoint {
latitude: number;
longitude: number;
timestampUTC: string; // ISO
timestampIST?: string;
}


export interface Session {
sessionId: string;
startTime: string;
endTime: string;
locations: LocationPoint[];
name?: string;
}


export interface DateBucket {
sessions: Session[];
}