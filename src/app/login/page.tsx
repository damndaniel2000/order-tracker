"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogIn } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, password }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Login failed");
      return;
    }

    router.replace(data.role === "admin" ? "/admin" : "/customer");
  }

  return (
    <>
      <SiteHeader />
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="mb-6 text-center">
            <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-white">
              <LogIn className="h-6 w-6" />
            </span>
            <h1 className="text-2xl font-bold">Log in</h1>
            <p className="mt-1 text-sm text-zinc-500">Admin or customer account</p>
          </div>

          <Card>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="identifier" className="mb-1">
                    Email or customer code
                  </Label>
                  <Input
                    id="identifier"
                    type="text"
                    placeholder="admin@likhit.test or DELL"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    className="h-12 rounded-xl px-4 text-sm"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="password" className="mb-1">
                    Password
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 rounded-xl px-4 text-sm"
                    required
                  />
                </div>

                {error && (
                  <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
                    {error}
                  </p>
                )}

                <Button type="submit" disabled={loading} className="h-12 w-full rounded-xl text-sm">
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Sign in
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
}
