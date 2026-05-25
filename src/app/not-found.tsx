import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";

export default function NotFound() {
    return (
        <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center px-4 py-16 sm:px-6 lg:px-8">
            <Card className="relative w-full max-w-xl overflow-hidden border-slate-200/80 bg-white/90 shadow-2xl shadow-slate-200/70 backdrop-blur">
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-500 via-cyan-500 to-emerald-500" />
                <CardHeader className="items-center gap-4 pt-10 text-center">
                    <div className="relative flex h-28 w-28 items-center justify-center rounded-full bg-slate-50 ring-1 ring-slate-200">
                        <div className="absolute inset-4 rounded-full border-4 border-dashed border-slate-300 animate-spin [animation-duration:14s]" />
                        <div className="absolute left-7 top-10 h-8 w-11 rounded-full border-l-4 border-t-4 border-slate-400/80 -rotate-12" />
                        <div className="absolute right-7 top-10 h-8 w-11 rounded-full border-r-4 border-t-4 border-slate-400/80 rotate-12" />
                        <div className="absolute bottom-7 left-1/2 h-10 w-10 -translate-x-1/2 rounded-full border-b-4 border-slate-400/80" />
                        <div className="absolute right-4 top-4 rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700 shadow-sm animate-bounce">
                            Oops
                        </div>
                    </div>
                    <div className="space-y-2">
                        <CardTitle className="font-heading text-5xl font-bold tracking-tight text-slate-900 sm:text-6xl">
                            404
                        </CardTitle>
                        <CardDescription className="text-base text-slate-500 sm:text-lg">
                            This page took a wrong turn and never arrived.
                        </CardDescription>
                    </div>
                </CardHeader>

                <CardContent className="space-y-6 pb-10 text-center">
                    <p className="mx-auto max-w-md text-sm leading-6 text-slate-600 sm:text-base">
                        The link you opened does not exist, but your home page is still one click away.
                    </p>

                    <div className="flex items-center justify-center">
                        <Button asChild size="lg" className="min-w-40 rounded-full px-6">
                            <Link href="/">Back to Home</Link>
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}