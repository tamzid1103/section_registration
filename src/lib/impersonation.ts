export type ImpersonationRole = 'advisor' | 'cr' | 'student';

export interface ImpersonationSession {
    role: ImpersonationRole;
    email: string;
    name: string;
    studentId?: string | null;
    section?: string | null;
    advisorId?: string | null;
    originalAdminEmail: string;
    impersonatedAt: string;
}

const STORAGE_KEY = 'diu_impersonation_session';
const COOKIE_NAME = 'diu_impersonation';

export function getImpersonationSession(): ImpersonationSession | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (parsed && parsed.email && parsed.role) {
            return parsed as ImpersonationSession;
        }
    } catch {
        // Ignore parse error
    }
    return null;
}

export function startImpersonation(session: ImpersonationSession): void {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
        document.cookie = `${COOKIE_NAME}=${encodeURIComponent(JSON.stringify({ role: session.role, email: session.email }))}; path=/; max-age=86400; SameSite=Lax`;
        window.dispatchEvent(new CustomEvent('diu:impersonation-change', { detail: session }));
    } catch (e) {
        console.error('Failed to start impersonation', e);
    }
}

export function stopImpersonation(): void {
    if (typeof window === 'undefined') return;
    try {
        localStorage.removeItem(STORAGE_KEY);
        document.cookie = `${COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
        window.dispatchEvent(new CustomEvent('diu:impersonation-change', { detail: null }));
    } catch (e) {
        console.error('Failed to stop impersonation', e);
    }
}

export function getRoleTargetUrl(role: ImpersonationRole): string {
    switch (role) {
        case 'advisor':
            return '/advisor';
        case 'cr':
            return '/cr/manage';
        case 'student':
            return '/student/dashboard';
        default:
            return '/admin';
    }
}
