"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveToken, saveUser } from "../../lib/auth";
import logo from "@/app/assets/Logo.png";
import Image from "next/image";
import { Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";
import Link from "next/link";
import GoogleButton from "@/components/ui/buttons/googleauth";
import { NEXT_PARAM } from "@/lib/authRoutes";
import AuthShowcase from "@/components/auth/AuthShowcase";
import env from "@/config/env";

export default function LoginPage() {
    const router = useRouter();
    const [formData, setFormData] = useState({ email: "", password: "" });
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            const response = await fetch(`${env.NEXT_PUBLIC_API_URL}/api/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data.message || "Invalid credentials");
                setLoading(false);
                return;
            }

            saveToken(data.token);
            saveUser(data.user);

            // No stash to replay any more: the funnel runs signed in, straight
            // after email verification, and has already built the account.
            //
            // Resume wherever the guard interrupted them. Read from
            // window.location rather than useSearchParams: this runs on submit,
            // so it needs no Suspense boundary and does not push this page off
            // the static prerender it currently gets.
            //
            // ONLY a path is accepted. A value starting "//" or carrying a
            // scheme is someone else's origin, and honouring it is exactly how
            // a "next" parameter becomes an open redirect that phishes a user
            // straight after they have typed their password.
            const wanted = new URLSearchParams(window.location.search).get(NEXT_PARAM);
            const safeNext =
                wanted && wanted.startsWith("/") && !wanted.startsWith("//") ? wanted : "/Home";

            router.push(safeNext);
        } catch (err: any) {
            setError("Cannot connect to the server. Please verify your backend is running.");
            setLoading(false);
        }
    };

    const handleOAuth = (provider: "apple") => {
        window.location.href = `${env.NEXT_PUBLIC_API_URL}/auth/${provider}`;
    };

    return (
        <section className="w-full h-full bg-canvas p-3">
            <div className="flex gap-3 w-full h-full">
                <AuthShowcase />

                <div className="w-full lg:w-[55%] flex flex-col px-6 sm:px-16 py-8 rounded-xl bg-card flex-1">
                    <div className="flex items-center justify-between">
                        <Link href="/" className="cursor-pointer">
                            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-card shadow-sm border border-zinc-300">
                                <Image src={logo} alt="Logo" priority />
                            </div>
                        </Link>
                        
                        <p className="text-sm text-slate-600">
                            Don't have an account?{" "}
                            <span onClick={() => router.push("/register")} className="font-semibold text-accent underline cursor-pointer">Sign Up</span>
                        </p>
                    </div>

                    <div className="flex-1 flex items-center justify-center font-google-sans">
                        <div className="w-full max-w-sm">
                            <div className="mb-8 text-center">
                                <h1 className="text-2xl font-bold text-slate-900 flex gap-1 items-center">Welcome back to Conexus
                                    <span className="brand-gradient-warm-text font-extrabold text-3xl font-jost">
                                        X
                                    </span></h1>
                                <p className="mt-2 text-sm text-slate-500">Please enter your details to sign in your account</p>
                            </div>

                            {error && (
                                <div className="mb-5 flex items-center justify-center gap-2 rounded-lg border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent text-center">
                                    <AlertCircle className="h-4 w-4 shrink-0" />
                                    {error}
                                </div>
                            )}

                            <div className="space-y-3">
                                <GoogleButton mode="login" disabled={loading} onError={setError} />

                                <button type="button" onClick={() => handleOAuth("apple")} disabled={loading} className="w-full flex items-center justify-center gap-2 rounded-lg border border-zinc-400 bg-card py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-60 cursor-pointer">
                                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="black">
                                        <path d="M16.365 1.43c0 1.14-.417 2.06-1.25 2.87-.833.79-1.833 1.25-2.998 1.16-.146-1.11.375-2.27 1.19-3.06.813-.79 2.146-1.36 3.058-1.29zm3.395 15.65c-.5 1.15-1.083 2.28-1.916 3.36-.917 1.17-1.833 2.34-3.25 2.36-1.375.03-1.833-.79-3.417-.79-1.583 0-2.083.77-3.416.82-1.375.05-2.416-1.24-3.333-2.4-1.833-2.36-3.25-6.68-1.333-9.6 0.917-1.44 2.583-2.36 4.416-2.39 1.334-.02 2.584.87 3.417.87.833 0 2.333-1.07 3.917-.91 0.666.03 2.55.26 3.75 1.99-.1.07-2.25 1.28-2.22 3.86.03 3.1 2.75 4.13 2.78 4.15z" />
                                    </svg>
                                    Continue with Apple
                                </button>
                            </div>

                            <div className="my-6 flex items-center gap-4">
                                <div className="h-px flex-1 bg-zinc-400" />
                                <span className="text-xs text-slate-600">Or sign in with</span>
                                <div className="h-px flex-1 bg-zinc-400" />
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="mb-1.5 block text-sm font-semibold text-slate-800">Email</label>
                                    <input name="email" type="email" placeholder="John@gmail.com" value={formData.email} onChange={handleChange} required disabled={loading} className="w-full rounded-lg border border-zinc-400 px-3 py-2.5 text-sm text-foreground placeholder:text-zinc-400 outline-none focus:border-black focus:ring-none disabled:opacity-60" />
                                </div>

                                <div>
                                    <label className="mb-1.5 block text-sm font-semibold text-slate-800">Password</label>
                                    <div className="relative">
                                        <input name="password" type={showPassword ? "text" : "password"} placeholder="Enter your password" value={formData.password} onChange={handleChange} required minLength={8} disabled={loading} className="w-full rounded-lg border border-zinc-400 px-3 py-2.5 pr-10 text-sm text-foreground placeholder:text-zinc-400 outline-none focus:border-black focus:ring-none disabled:opacity-60" />
                                        <button type="button" disabled={loading} onClick={() => setShowPassword(!showPassword)} className="absolute cursor-pointer right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-foreground disabled:opacity-50">
                                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                    </div>
                                </div>

                                <button type="submit" disabled={loading} className="w-full mt-2 flex items-center justify-center gap-2 rounded-lg bg-accent py-3 text-sm font-semibold text-white transition hover:bg-accent-hover disabled:bg-slate-400 disabled:cursor-not-allowed cursor-pointer font-google-sans">
                                    {loading ? (
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                    ) : (
                                        <>Sign In</>
                                    )}
                                </button>
                            </form>

                            <Link href="/forget" className="mt-2 text-center text-sm font-google-sans flex justify-center">
                                <span className="cursor-pointer text-foreground text-md font-semibold  hover:text-accent">Forget Password?</span>
                            </Link>
                        </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>© 2026 Conexus X</span>
                        <div className="flex gap-4">
                            <span className="cursor-pointer hover:text-[#6A00FF]">Privacy Policy</span>
                            <span className="cursor-pointer hover:text-[#6A00FF]">Support</span>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}