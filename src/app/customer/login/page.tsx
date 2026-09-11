"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Building2 } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function CustomerLoginPage() {
  const router = useRouter();
  const [customerCode, setCustomerCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/customer/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerCode, password }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Login failed");
      return;
    }

    router.replace("/customer");
  }

  return (
    <>
      <SiteHeader />
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="mb-6 text-center">
            <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-white">
              <Building2 className="h-6 w-6" />
            </span>
            <h1 className="text-2xl font-bold">Customer login</h1>
            <p className="mt-1 text-sm text-zinc-500">See every order on your account</p>
          </div>

          <Card>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="customerCode" className="mb-1">
                    Customer code
                  </Label>
                  <Input
                    id="customerCode"
                    type="text"
                    placeholder="e.g. DELL"
                    value={customerCode}
                    onChange={(e) => setCustomerCode(e.target.value)}
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

          <p className="mt-4 text-center text-sm">
            <Link href="/track" className="text-indigo-600 hover:underline dark:text-indigo-400">
              Track a single order instead →
            </Link>
          </p>
        </div>
      </main>
    </>
  );
}
