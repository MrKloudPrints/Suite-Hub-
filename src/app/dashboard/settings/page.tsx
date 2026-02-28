"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import {
  Settings,
  Save,
  Loader2,
  CheckCircle2,
  Building2,
  Lock,
  Eye,
  EyeOff,
  Users,
  Plus,
  Pencil,
  Trash2,
  X,
  Link,
  Unlink,
  CreditCard,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface EmployeeBasic {
  id: string;
  name: string;
}

interface SettingsData {
  companyName: string;
  qb_company_name?: string;
  qb_access_token?: string;
  qb_client_id?: string;
  qb_client_secret?: string;
  qb_redirect_uri?: string;
  sales_people?: string;
  stripe_publishable_key?: string;
  stripe_secret_key?: string;
}

interface UserData {
  id: string;
  username: string;
  role: string;
  createdAt: string;
}

export default function SettingsPage() {
  const { data: session } = useSession();
  const [settings, setSettings] = useState<SettingsData>({ companyName: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Company settings state
  const [companyName, setCompanyName] = useState("");
  const [savingCompany, setSavingCompany] = useState(false);
  const [companySaved, setCompanySaved] = useState(false);

  // Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  // User management state
  const [users, setUsers] = useState<UserData[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [newUsername, setNewUsername] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState("EMPLOYEE");
  const [savingUser, setSavingUser] = useState(false);
  const [userError, setUserError] = useState("");

  // QuickBooks state
  const [qboConnected, setQboConnected] = useState(false);
  const [qboCompanyName, setQboCompanyName] = useState("");
  const [qboConnecting, setQboConnecting] = useState(false);
  const [qboDisconnecting, setQboDisconnecting] = useState(false);

  // QBO API credentials state
  const [qboClientId, setQboClientId] = useState("");
  const [qboClientSecret, setQboClientSecret] = useState("");
  const [savingQboKeys, setSavingQboKeys] = useState(false);
  const [qboKeysSaved, setQboKeysSaved] = useState(false);
  const [qboRedirectUri, setQboRedirectUri] = useState("");
  const [showQboSecret, setShowQboSecret] = useState(false);

  // Stripe state
  const [stripePublishableKey, setStripePublishableKey] = useState("");
  const [stripeSecretKey, setStripeSecretKey] = useState("");
  const [savingStripeKeys, setSavingStripeKeys] = useState(false);
  const [stripeKeysSaved, setStripeKeysSaved] = useState(false);
  const [showStripeSecret, setShowStripeSecret] = useState(false);

  // Sales People state
  const [allEmployees, setAllEmployees] = useState<EmployeeBasic[]>([]);
  const [selectedSalesPeople, setSelectedSalesPeople] = useState<string[]>([]);
  const [savingSalesPeople, setSavingSalesPeople] = useState(false);
  const [salesPeopleSaved, setSalesPeopleSaved] = useState(false);

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await fetch("/api/employees?active=true");
      if (res.ok) {
        const data = await res.json();
        setAllEmployees(data.map((e: { id: string; name: string }) => ({ id: e.id, name: e.name })).filter((e: EmployeeBasic) => e.name));
      }
    } catch { /* */ }
  }, []);

  const handleSaveSalesPeople = async () => {
    setSavingSalesPeople(true);
    setSalesPeopleSaved(false);
    try {
      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "sales_people", value: JSON.stringify(selectedSalesPeople) }),
      });
      setSalesPeopleSaved(true);
      setTimeout(() => setSalesPeopleSaved(false), 3000);
    } catch {
      alert("Failed to save sales people");
    } finally {
      setSavingSalesPeople(false);
    }
  };

  const toggleSalesPerson = (name: string) => {
    setSelectedSalesPeople((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/users");
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch {
      // ignore
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  const handleSaveUser = async () => {
    setUserError("");
    if (!newUsername) { setUserError("Username required"); return; }
    if (!editingUser && !newUserPassword) { setUserError("Password required"); return; }
    if (newUserPassword && newUserPassword.length < 6) { setUserError("Password must be at least 6 characters"); return; }

    setSavingUser(true);
    try {
      const url = editingUser ? `/api/users/${editingUser.id}` : "/api/users";
      const method = editingUser ? "PATCH" : "POST";
      const body: Record<string, string> = { username: newUsername, role: newUserRole };
      if (newUserPassword) body.password = newUserPassword;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save user");
      }
      setShowUserModal(false);
      setEditingUser(null);
      setNewUsername("");
      setNewUserPassword("");
      setNewUserRole("EMPLOYEE");
      fetchUsers();
    } catch (err) {
      setUserError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSavingUser(false);
    }
  };

  const handleDeleteUser = async (user: UserData) => {
    if (!confirm(`Delete user "${user.username}"?`)) return;
    try {
      const res = await fetch(`/api/users/${user.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to delete user");
        return;
      }
      fetchUsers();
    } catch {
      alert("Failed to delete user");
    }
  };

  const openEditUser = (user: UserData) => {
    setEditingUser(user);
    setNewUsername(user.username);
    setNewUserPassword("");
    setNewUserRole(user.role);
    setUserError("");
    setShowUserModal(true);
  };

  const openAddUser = () => {
    setEditingUser(null);
    setNewUsername("");
    setNewUserPassword("");
    setNewUserRole("EMPLOYEE");
    setUserError("");
    setShowUserModal(true);
  };

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings");
      if (!res.ok) throw new Error("Failed to load settings");
      const data = await res.json();
      setSettings(data);
      setCompanyName(data.companyName || "");
      setQboConnected(!!data.qb_access_token);
      setQboCompanyName(data.qb_company_name || "");
      setQboClientId(data.qb_client_id || "");
      setQboClientSecret(data.qb_client_secret || "");
      setQboRedirectUri(data.qb_redirect_uri || "");
      setStripePublishableKey(data.stripe_publishable_key || "");
      setStripeSecretKey(data.stripe_secret_key || "");
      try {
        setSelectedSalesPeople(data.sales_people ? JSON.parse(data.sales_people) : []);
      } catch { setSelectedSalesPeople([]); }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
    fetchUsers();
    fetchEmployees();
  }, [fetchSettings, fetchUsers, fetchEmployees]);

  const handleSaveCompany = async () => {
    setSavingCompany(true);
    setCompanySaved(false);
    setError("");
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "companyName", value: companyName }),
      });
      if (!res.ok) throw new Error("Failed to save settings");
      setCompanySaved(true);
      setTimeout(() => setCompanySaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSavingCompany(false);
    }
  };

  const handleChangePassword = async () => {
    setPasswordError("");
    setPasswordSaved(false);

    if (newPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }

    setSavingPassword(true);
    try {
      if (!session?.user?.id) throw new Error("Not logged in");
      const res = await fetch(`/api/users/${session.user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword, currentPassword }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to change password");
      }

      setPasswordSaved(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPasswordSaved(false), 3000);
    } catch (err) {
      setPasswordError(
        err instanceof Error ? err.message : "Failed to change password"
      );
    } finally {
      setSavingPassword(false);
    }
  };

  const handleConnectQbo = async () => {
    setQboConnecting(true);
    try {
      const res = await fetch("/api/quickbooks/auth");
      if (!res.ok) throw new Error("Failed to get auth URL");
      const { url } = await res.json();

      // Open OAuth popup
      const popup = window.open(url, "qbo_auth", "width=600,height=700");

      // Listen for message from callback page
      const onMessage = (e: MessageEvent) => {
        if (e.origin !== window.location.origin) return;
        if (e.data?.type === "qbo_connected") {
          setQboConnected(true);
          setQboCompanyName(e.data.companyName || "");
          setQboConnecting(false);
          window.removeEventListener("message", onMessage);
        }
      };
      window.addEventListener("message", onMessage);

      // Also watch for popup closing without connecting
      const checkClosed = setInterval(() => {
        if (!popup || popup.closed) {
          clearInterval(checkClosed);
          // Give a moment for the message to arrive
          setTimeout(() => {
            setQboConnecting(false);
            window.removeEventListener("message", onMessage);
          }, 1000);
        }
      }, 500);
    } catch {
      setQboConnecting(false);
      alert("Failed to start QuickBooks connection");
    }
  };

  const handleDisconnectQbo = async () => {
    if (!confirm("Disconnect QuickBooks? Invoice search will no longer be available.")) return;
    setQboDisconnecting(true);
    try {
      await fetch("/api/quickbooks/auth", { method: "DELETE" });
      setQboConnected(false);
      setQboCompanyName("");
    } catch {
      alert("Failed to disconnect");
    }
    setQboDisconnecting(false);
  };

  const handleSaveQboKeys = async () => {
    setSavingQboKeys(true);
    setQboKeysSaved(false);
    try {
      const keys = [
        { key: "qb_client_id", value: qboClientId },
        { key: "qb_client_secret", value: qboClientSecret },
        { key: "qb_redirect_uri", value: qboRedirectUri },
      ];
      for (const pair of keys) {
        await fetch("/api/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(pair),
        });
      }
      setQboKeysSaved(true);
      setTimeout(() => setQboKeysSaved(false), 3000);
    } catch {
      alert("Failed to save API credentials");
    } finally {
      setSavingQboKeys(false);
    }
  };

  const handleSaveStripeKeys = async () => {
    setSavingStripeKeys(true);
    setStripeKeysSaved(false);
    try {
      const keys = [
        { key: "stripe_publishable_key", value: stripePublishableKey },
        { key: "stripe_secret_key", value: stripeSecretKey },
      ];
      for (const pair of keys) {
        await fetch("/api/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(pair),
        });
      }
      setStripeKeysSaved(true);
      setTimeout(() => setStripeKeysSaved(false), 3000);
    } catch {
      alert("Failed to save Stripe keys");
    } finally {
      setSavingStripeKeys(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500 mt-1">
          Configure your payroll system preferences
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-5 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* Company Settings */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Building2 className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-900">Company Settings</h2>
            <p className="text-sm text-slate-500">
              Company information shown on paystubs
            </p>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Company Name
            </label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-slate-900"
              placeholder="Enter company name"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSaveCompany}
              disabled={savingCompany}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {savingCompany ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save
                </>
              )}
            </button>
            {companySaved && (
              <span className="inline-flex items-center gap-1 text-green-600 text-sm">
                <CheckCircle2 className="w-4 h-4" />
                Saved successfully
              </span>
            )}
          </div>
        </div>
      </div>

      {/* QuickBooks Online */}
      {session?.user?.role === "ADMIN" && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <Link className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">QuickBooks Online</h2>
              <p className="text-sm text-slate-500">
                Connect to search invoices and auto-record payments
              </p>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {qboConnected ? (
                  <>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-emerald-100 text-emerald-700">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      Connected
                    </span>
                    {qboCompanyName && (
                      <span className="text-sm text-slate-600">{qboCompanyName}</span>
                    )}
                  </>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-slate-100 text-slate-500">
                    <span className="w-2 h-2 rounded-full bg-slate-400" />
                    Not Connected
                  </span>
                )}
              </div>
              {qboConnected ? (
                <button
                  onClick={handleDisconnectQbo}
                  disabled={qboDisconnecting}
                  className="inline-flex items-center gap-2 px-4 py-2 text-red-600 text-sm font-medium rounded-lg border border-red-200 hover:bg-red-50 transition disabled:opacity-50"
                >
                  {qboDisconnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlink className="w-4 h-4" />}
                  Disconnect
                </button>
              ) : (
                <button
                  onClick={handleConnectQbo}
                  disabled={qboConnecting}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition disabled:opacity-50"
                >
                  {qboConnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link className="w-4 h-4" />}
                  Connect QuickBooks
                </button>
              )}
            </div>
            {!qboConnected && (
              <p className="text-xs text-slate-400">
                Connect your QuickBooks Online account to search invoices directly from the POS and automatically record payments when sales are completed.
              </p>
            )}

            {/* API Credentials */}
            <div className="border-t border-slate-200 pt-4 mt-4 space-y-3">
              <p className="text-sm font-medium text-slate-700">API Credentials</p>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Client ID</label>
                <input
                  type="text"
                  value={qboClientId}
                  onChange={(e) => setQboClientId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition text-slate-900 text-sm font-mono"
                  placeholder="Enter QuickBooks Client ID"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Client Secret</label>
                <div className="relative">
                  <input
                    type={showQboSecret ? "text" : "password"}
                    value={qboClientSecret}
                    onChange={(e) => setQboClientSecret(e.target.value)}
                    className="w-full px-3 py-2 pr-10 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition text-slate-900 text-sm font-mono"
                    placeholder="Enter QuickBooks Client Secret"
                  />
                  <button
                    type="button"
                    onClick={() => setShowQboSecret(!showQboSecret)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showQboSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Redirect URI</label>
                <input
                  type="text"
                  value={qboRedirectUri}
                  onChange={(e) => setQboRedirectUri(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition text-slate-900 text-sm font-mono"
                  placeholder="e.g. http://localhost:3000/api/quickbooks/callback"
                />
                <p className="text-xs text-slate-400 mt-1">Must match exactly what&apos;s listed in your Intuit app&apos;s Redirect URIs</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSaveQboKeys}
                  disabled={savingQboKeys || (!qboClientId && !qboClientSecret)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingQboKeys ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                  ) : (
                    <><Save className="w-4 h-4" /> Save Credentials</>
                  )}
                </button>
                {qboKeysSaved && (
                  <span className="inline-flex items-center gap-1 text-green-600 text-sm">
                    <CheckCircle2 className="w-4 h-4" />
                    Saved
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Get these from developer.intuit.com. Stored securely and used for OAuth authentication.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Stripe Payment Processing */}
      {session?.user?.role === "ADMIN" && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <CreditCard className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">Stripe Payment Processing</h2>
              <p className="text-sm text-slate-500">
                Accept credit card payments in-person via the POS
              </p>
            </div>
          </div>
          <div className="p-6 space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Publishable Key</label>
              <input
                type="text"
                value={stripePublishableKey}
                onChange={(e) => setStripePublishableKey(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-slate-900 text-sm font-mono"
                placeholder="pk_live_..."
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Secret Key</label>
              <div className="relative">
                <input
                  type={showStripeSecret ? "text" : "password"}
                  value={stripeSecretKey}
                  onChange={(e) => setStripeSecretKey(e.target.value)}
                  className="w-full px-3 py-2 pr-10 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-slate-900 text-sm font-mono"
                  placeholder="sk_live_..."
                />
                <button
                  type="button"
                  onClick={() => setShowStripeSecret(!showStripeSecret)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showStripeSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleSaveStripeKeys}
                disabled={savingStripeKeys || (!stripePublishableKey && !stripeSecretKey)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingStripeKeys ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                ) : (
                  <><Save className="w-4 h-4" /> Save Keys</>
                )}
              </button>
              {stripeKeysSaved && (
                <span className="inline-flex items-center gap-1 text-green-600 text-sm">
                  <CheckCircle2 className="w-4 h-4" />
                  Saved
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              Get your API keys from dashboard.stripe.com/apikeys. For in-person payments, also set up a Stripe Terminal M2 reader.
            </p>
          </div>
        </div>
      )}

      {/* Sales People */}
      {session?.user?.role === "ADMIN" && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center gap-3">
            <div className="p-2 bg-violet-100 rounded-lg">
              <Users className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">Sales People</h2>
              <p className="text-sm text-slate-500">
                Select which employees appear as sales people in the POS
              </p>
            </div>
          </div>
          <div className="p-6 space-y-4">
            {allEmployees.length === 0 ? (
              <p className="text-slate-500 text-sm">No active employees found. Add employees first.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {allEmployees.map((emp) => {
                  const selected = selectedSalesPeople.includes(emp.name);
                  return (
                    <button
                      key={emp.id}
                      onClick={() => toggleSalesPerson(emp.name)}
                      className={cn(
                        "px-4 py-2 rounded-lg text-sm font-medium border transition",
                        selected
                          ? "bg-violet-100 text-violet-700 border-violet-300"
                          : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
                      )}
                    >
                      {selected && <CheckCircle2 className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />}
                      {emp.name}
                    </button>
                  );
                })}
              </div>
            )}
            <div className="flex items-center gap-3">
              <button
                onClick={handleSaveSalesPeople}
                disabled={savingSalesPeople}
                className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingSalesPeople ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                ) : (
                  <><Save className="w-4 h-4" /> Save Sales People</>
                )}
              </button>
              {salesPeopleSaved && (
                <span className="inline-flex items-center gap-1 text-green-600 text-sm">
                  <CheckCircle2 className="w-4 h-4" />
                  Saved
                </span>
              )}
            </div>
            {selectedSalesPeople.length > 0 && (
              <p className="text-xs text-slate-400">
                {selectedSalesPeople.length} sales {selectedSalesPeople.length === 1 ? "person" : "people"} selected: {selectedSalesPeople.join(", ")}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Change Password */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center gap-3">
          <div className="p-2 bg-amber-100 rounded-lg">
            <Lock className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-900">Change Password</h2>
            <p className="text-sm text-slate-500">
              Update your admin account password
            </p>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Current Password
            </label>
            <div className="relative">
              <input
                type={showCurrentPassword ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-3 py-2 pr-10 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-slate-900"
                placeholder="Enter current password"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showCurrentPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              New Password
            </label>
            <div className="relative">
              <input
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 pr-10 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-slate-900"
                placeholder="Enter new password"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showNewPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Confirm New Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-slate-900"
              placeholder="Confirm new password"
            />
          </div>

          {passwordError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-lg text-sm">
              {passwordError}
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={handleChangePassword}
              disabled={
                savingPassword || !currentPassword || !newPassword || !confirmPassword
              }
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {savingPassword ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  Change Password
                </>
              )}
            </button>
            {passwordSaved && (
              <span className="inline-flex items-center gap-1 text-green-600 text-sm">
                <CheckCircle2 className="w-4 h-4" />
                Password changed successfully
              </span>
            )}
          </div>
        </div>
      </div>

      {/* User Management */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Users className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">User Management</h2>
              <p className="text-sm text-slate-500">Manage user accounts and roles</p>
            </div>
          </div>
          <button
            onClick={openAddUser}
            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition"
          >
            <Plus className="w-4 h-4" />
            Add User
          </button>
        </div>
        <div className="p-6">
          {loadingUsers ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 text-purple-600 animate-spin" />
            </div>
          ) : users.length === 0 ? (
            <p className="text-slate-500 text-center py-8">No users found</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left text-sm font-medium text-slate-500 pb-3">Username</th>
                  <th className="text-left text-sm font-medium text-slate-500 pb-3">Role</th>
                  <th className="text-left text-sm font-medium text-slate-500 pb-3">Created</th>
                  <th className="text-right text-sm font-medium text-slate-500 pb-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-3 text-sm text-slate-900 font-medium">{user.username}</td>
                    <td className="py-3">
                      <span className={cn(
                        "inline-flex px-2 py-0.5 rounded-full text-xs font-medium",
                        user.role === "ADMIN" ? "bg-blue-100 text-blue-700" : user.role === "MANAGER" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"
                      )}>
                        {user.role}
                      </span>
                    </td>
                    <td className="py-3 text-sm text-slate-500">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditUser(user)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* User Modal */}
      {showUserModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">
                {editingUser ? "Edit User" : "Add User"}
              </h3>
              <button
                onClick={() => setShowUserModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition text-slate-900"
                  placeholder="Enter username"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {editingUser ? "New Password (leave blank to keep)" : "Password"}
                </label>
                <input
                  type="password"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition text-slate-900"
                  placeholder={editingUser ? "Leave blank to keep current" : "Enter password"}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition text-slate-900"
                >
                  <option value="ADMIN">Admin</option>
                  <option value="MANAGER">Manager</option>
                  <option value="EMPLOYEE">Employee</option>
                </select>
              </div>
              {userError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-lg text-sm">
                  {userError}
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowUserModal(false)}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveUser}
                  disabled={savingUser}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition disabled:opacity-50"
                >
                  {savingUser ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {editingUser ? "Update" : "Create"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
