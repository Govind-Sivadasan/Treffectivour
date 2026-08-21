"use client";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { formatHours } from "@/lib/calculations";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

export function AdminPanel() {
  const [users, setUsers] = useState<Array<{
    user: { id: string; name: string; email: string };
    stats: {
      totalEffectiveHours: number;
      totalGrossHours: number;
      daysTracked: number;
      daysComplete: number;
    };
  }>>([]);
  const [specialDays, setSpecialDays] = useState<Array<{
    id: string;
    date: string;
    name: string;
    requiredHours: number;
  }>>([]);
  const [newSpecial, setNewSpecial] = useState({ date: "", name: "", requiredHours: "3" });
  const [newUser, setNewUser] = useState({ email: "", name: "", password: "" });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [adminRes, specialRes] = await Promise.all([
      fetch("/api/admin"),
      fetch("/api/special-days"),
    ]);
    const adminData = await adminRes.json();
    const specialData = await specialRes.json();
    setUsers(adminData.users ?? []);
    setSpecialDays(specialData.days ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function addSpecialDay(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: newSpecial.date,
        name: newSpecial.name,
        requiredHours: parseFloat(newSpecial.requiredHours),
      }),
    });
    if (res.ok) {
      toast.success("Special day added");
      setNewSpecial({ date: "", name: "", requiredHours: "3" });
      load();
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || "Failed to add special day");
    }
  }

  async function deleteSpecial(id: string) {
    const res = await fetch(`/api/special-days?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Removed");
      load();
    }
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newUser),
    });
    const data = await res.json();
    if (res.ok) {
      toast.success(`User ${data.user.name} created`);
      setNewUser({ email: "", name: "", password: "" });
      load();
    } else {
      toast.error(data.error || "Failed to create user");
    }
  }

  return (
    <div className="min-h-screen">
      <header className="glass border-b border-[var(--color-border)]">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4" />
              Dashboard
            </Button>
          </Link>
          <h1 className="text-xl font-bold">Admin Panel</h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <Card>
          <CardTitle className="mb-4">All users — this month</CardTitle>
          {loading ? (
            <div className="animate-pulse h-32 bg-white/5 rounded-xl" />
          ) : users.length === 0 ? (
            <p className="text-sm text-[var(--color-muted)]">No users found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[var(--color-muted)] border-b border-[var(--color-border)]">
                    <th className="py-2 pr-4">User</th>
                    <th className="py-2 pr-4">Effective</th>
                    <th className="py-2 pr-4">Gross</th>
                    <th className="py-2 pr-4">Days complete</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(({ user, stats }) => (
                    <tr key={user.id} className="border-b border-[var(--color-border)]/50">
                      <td className="py-3 pr-4">
                        <div className="font-medium">{user.name}</div>
                        <div className="text-xs text-[var(--color-muted)]">{user.email}</div>
                      </td>
                      <td className="py-3 pr-4 tabular-nums">
                        {formatHours(stats.totalEffectiveHours * 3600000)}
                      </td>
                      <td className="py-3 pr-4 tabular-nums">
                        {formatHours(stats.totalGrossHours * 3600000)}
                      </td>
                      <td className="py-3 pr-4">
                        {stats.daysComplete}/{stats.daysTracked}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card>
          <CardTitle className="mb-4">Add user</CardTitle>
          <form onSubmit={createUser} className="grid md:grid-cols-4 gap-3">
            <div>
              <Label>Name</Label>
              <Input
                value={newUser.name}
                onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>Password</Label>
              <Input
                type="password"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                required
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" className="w-full">
                Create user
              </Button>
            </div>
          </form>
        </Card>

        <Card>
          <CardTitle className="mb-4 flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Special days (e.g. Onam — 3h required)
          </CardTitle>
          <form onSubmit={addSpecialDay} className="grid md:grid-cols-4 gap-3 mb-6">
            <div>
              <Label>Date</Label>
              <Input
                type="date"
                value={newSpecial.date}
                onChange={(e) => setNewSpecial({ ...newSpecial, date: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>Event name</Label>
              <Input
                value={newSpecial.name}
                onChange={(e) => setNewSpecial({ ...newSpecial, name: e.target.value })}
                placeholder="Onam"
                required
              />
            </div>
            <div>
              <Label>Required hours</Label>
              <Input
                type="number"
                step="0.5"
                value={newSpecial.requiredHours}
                onChange={(e) =>
                  setNewSpecial({ ...newSpecial, requiredHours: e.target.value })
                }
                required
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" className="w-full">
                Add
              </Button>
            </div>
          </form>

          <div className="space-y-2">
            {specialDays.map((day) => (
              <div
                key={day.id}
                className="flex items-center justify-between rounded-xl bg-black/30 border border-[var(--color-border)] px-4 py-3"
              >
                <div>
                  <span className="font-medium">{day.name}</span>
                  <span className="text-[var(--color-muted)] ml-2">{day.date}</span>
                  <span className="ml-2 text-[var(--color-accent)]">{day.requiredHours}h</span>
                </div>
                <Button variant="ghost" size="sm" onClick={() => deleteSpecial(day.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </Card>
      </main>
    </div>
  );
}
