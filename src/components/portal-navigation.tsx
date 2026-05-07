import Link from "next/link"
import { ShieldAlert, UserCheck, Settings, LayoutDashboard } from "lucide-react"

export function PortalNavigation() {
    return (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-white/80 backdrop-blur-md border shadow-2xl rounded-full px-6 py-3 flex items-center gap-8 z-50">
            <Link href="/cr/manage" className="flex flex-col items-center gap-1 group">
                <UserCheck className="w-5 h-5 text-slate-400 group-hover:text-blue-600 transition-colors" />
                <span className="text-[10px] font-bold text-slate-500 group-hover:text-blue-600 uppercase tracking-tighter">CR Portal</span>
            </Link>
            <Link href="/advisor" className="flex flex-col items-center gap-1 group">
                <LayoutDashboard className="w-5 h-5 text-slate-400 group-hover:text-blue-600 transition-colors" />
                <span className="text-[10px] font-bold text-slate-500 group-hover:text-blue-600 uppercase tracking-tighter">Advisor</span>
            </Link>
            <Link href="/admin" className="flex flex-col items-center gap-1 group">
                <Settings className="w-5 h-5 text-slate-400 group-hover:text-blue-600 transition-colors" />
                <span className="text-[10px] font-bold text-slate-500 group-hover:text-blue-600 uppercase tracking-tighter">Admin</span>
            </Link>
            <Link href="/developer" className="flex flex-col items-center gap-1 group border-l pl-8">
                <ShieldAlert className="w-5 h-5 text-slate-400 group-hover:text-red-500 transition-colors" />
                <span className="text-[10px] font-bold text-slate-500 group-hover:text-red-500 uppercase tracking-tighter">Dev</span>
            </Link>
        </div>
    )
}
