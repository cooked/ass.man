import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Users, Shield, Building2, Plus, Edit2, Trash2, Check, X,
  Search, AlertCircle, CheckCircle2, UserCheck, UserX,
  Mail, MapPin, ExternalLink, Sparkles, Save, ShieldCheck,
  Boxes, Cpu, RefreshCw
} from "lucide-react";
import { CustomerAsset } from "../types/schema";

export interface UserItem {
  username: string;
  name?: string;
  surname?: string;
  role: string;
  inactive?: boolean;
}

interface UsersAndCustomersViewProps {
  currentUser: string;
  onUserChange?: (username: string) => void;
  onSelectCustomerOnMap?: (customerCode: string) => void;
  onRefresh: () => void;
  customers?: any[];
  kits?: any[];
  sensors?: any[];
}

const AVAILABLE_PERMISSIONS: { key: string; label: string; desc: string }[] = [
  { key: "manage_sensors", label: "Manage Sensors", desc: "Create, edit, decommission, and lock sensors" },
  { key: "assemble_kits", label: "Assemble Kits", desc: "Compose kits, assign sensor slots, and pack kits" },
  { key: "release_firmware", label: "Release Firmware", desc: "Publish firmware binaries and trigger OTA upgrades" },
  { key: "manage_customers", label: "Manage Customers", desc: "Register industrial client facilities and contacts" },
  { key: "manage_users", label: "Manage Users & Roles", desc: "Add/edit operator accounts and permission scopes" },
  { key: "configure_system", label: "Configure System", desc: "Adjust storage paths, timeouts, and unlock assets" },
  { key: "scan_ingestion", label: "Scanner Ingestion", desc: "Ingest Android DataMatrix camera batch files" }
];

function testMatch(text: string, term: string, matchCase: boolean, wholeWord: boolean): boolean {
  if (!text || !term) return false;
  if (!wholeWord) {
    if (!matchCase) return text.toLowerCase().includes(term.toLowerCase());
    return text.includes(term);
  }
  const escaped = term.replace(/[.*+?^\${}()|[\]\\]/g, "\\$&");
  try {
    const regex = new RegExp(`(^|[^\\p{L}\\p{N}_])${escaped}($|[^\\p{L}\\p{N}_])`, matchCase ? "u" : "iu");
    return regex.test(text);
  } catch {
    const regex = new RegExp(`(^|[^a-zA-Z0-9_À-ž])${escaped}($|[^a-zA-Z0-9_À-ž])`, matchCase ? "" : "i");
    return regex.test(text);
  }
}

export const UsersAndCustomersView: React.FC<UsersAndCustomersViewProps> = ({
  currentUser,
  onUserChange,
  onSelectCustomerOnMap,
  onRefresh
}) => {
  const [activeSubTab, setActiveSubTab] = useState<"users" | "roles" | "customers">("users");

  // Data states
  const [users, setUsers] = useState<UserItem[]>([]);
  const [rolesConfig, setRolesConfig] = useState<Record<string, string[]>>({});
  const [customers, setCustomers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [matchCase, setMatchCase] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [roleFilter, setRoleFilter] = useState("all");

  // User Drawer State
  const [isUserDrawerOpen, setIsUserDrawerOpen] = useState(false);
  const [userFormData, setUserFormData] = useState<UserItem>({
    username: "",
    name: "",
    surname: "",
    role: "Warehouse Operator",
    inactive: false
  });
  const [isEditingUser, setIsEditingUser] = useState(false);

  // Customer Drawer State
  const [isCustomerDrawerOpen, setIsCustomerDrawerOpen] = useState(false);
  const [customerFormData, setCustomerFormData] = useState({
    code: "",
    company_name: "",
    plant_name: "Main Facility",
    address: "",
    city: "",
    lat: 44.5,
    lng: 11.3,
    contact_person: "",
    contact_email: ""
  });
  const [isEditingCustomer, setIsEditingCustomer] = useState(false);

  // New Role Modal State
  const [newRoleName, setNewRoleName] = useState("");
  const [isAddingRole, setIsAddingRole] = useState(false);
  const [isSavingRoles, setIsSavingRoles] = useState(false);

  // Fetch Users, Roles, Customers
  const loadAllData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [usersRes, rolesRes, custRes] = await Promise.all([
        fetch("/api/users"),
        fetch("/api/roles"),
        fetch("/api/assets/customer")
      ]);
      const [usersData, rolesData, custData] = await Promise.all([
        usersRes.json(),
        rolesRes.json(),
        custRes.json()
      ]);
      setUsers(usersData || []);
      setRolesConfig(rolesData || {});
      setCustomers(custData || []);
    } catch (e: any) {
      setFeedbackMsg({ type: "error", text: "Failed to load management directory." });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Show transient feedback message
  const notify = (type: "success" | "error", text: string) => {
    setFeedbackMsg({ type, text });
    setTimeout(() => setFeedbackMsg(null), 3500);
  };

  // --- USER ACTIONS ---
  const handleOpenCreateUser = () => {
    setUserFormData({
      username: "",
      name: "",
      surname: "",
      role: Object.keys(rolesConfig)[0] || "Warehouse Operator",
      inactive: false
    });
    setIsEditingUser(false);
    setIsUserDrawerOpen(true);
  };

  const handleOpenEditUser = (user: UserItem) => {
    setUserFormData({ ...user });
    setIsEditingUser(true);
    setIsUserDrawerOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userFormData.username.trim()) {
      notify("error", "Username is required.");
      return;
    }
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userFormData)
      });
      if (res.ok) {
        notify("success", `User "${userFormData.username}" saved successfully.`);
        setIsUserDrawerOpen(false);
        loadAllData();
        onRefresh();
      } else {
        const err = await res.json();
        notify("error", err.error || "Failed to save user.");
      }
    } catch {
      notify("error", "Network error while saving user.");
    }
  };

  const handleToggleUserInactive = async (user: UserItem) => {
    const updated = { ...user, inactive: !user.inactive };
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated)
      });
      if (res.ok) {
        notify("success", `User ${user.username} is now ${updated.inactive ? "Inactive" : "Active"}.`);
        loadAllData();
      }
    } catch {
      notify("error", "Could not toggle user status.");
    }
  };

  const handleDeleteUser = async (username: string) => {
    if (username.toLowerCase() === currentUser.toLowerCase()) {
      alert("You cannot delete the active operator account.");
      return;
    }
    if (!confirm(`Are you sure you want to delete user "${username}"?`)) return;
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(username)}`, {
        method: "DELETE"
      });
      if (res.ok) {
        notify("success", `User ${username} removed.`);
        loadAllData();
        onRefresh();
      }
    } catch {
      notify("error", "Could not delete user.");
    }
  };

  // --- ROLES & PERMISSIONS ACTIONS ---
  const handleTogglePermission = (role: string, permKey: string) => {
    setRolesConfig(prev => {
      const currentPerms = prev[role] || [];
      const hasPerm = currentPerms.includes(permKey);
      const newPerms = hasPerm
        ? currentPerms.filter(p => p !== permKey)
        : [...currentPerms, permKey];
      return {
        ...prev,
        [role]: newPerms
      };
    });
  };

  const handleSaveRoles = async () => {
    setIsSavingRoles(true);
    try {
      const res = await fetch("/api/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rolesConfig)
      });
      if (res.ok) {
        notify("success", "Role authorization scopes saved successfully.");
        loadAllData();
        onRefresh();
      } else {
        notify("error", "Failed to persist roles config.");
      }
    } catch {
      notify("error", "Network error while saving roles.");
    } finally {
      setIsSavingRoles(false);
    }
  };

  const handleAddNewRole = () => {
    const trimmed = newRoleName.trim();
    if (!trimmed) return;
    if (rolesConfig[trimmed]) {
      alert("A role with this name already exists.");
      return;
    }
    setRolesConfig(prev => ({ ...prev, [trimmed]: ["manage_sensors"] }));
    setNewRoleName("");
    setIsAddingRole(false);
    notify("success", `Role "${trimmed}" added. Remember to click "Save Role Scopes".`);
  };

  // --- CUSTOMER ACTIONS ---
  const handleOpenCreateCustomer = () => {
    const nextCode = `CUST-00${customers.length + 1}`;
    setCustomerFormData({
      code: nextCode,
      company_name: "",
      plant_name: "Main Facility",
      address: "",
      city: "",
      lat: 44.4949,
      lng: 11.3426,
      contact_person: "",
      contact_email: ""
    });
    setIsEditingCustomer(false);
    setIsCustomerDrawerOpen(true);
  };

  const handleOpenEditCustomer = (customer: any) => {
    setCustomerFormData({
      code: customer.code || "",
      company_name: customer.company_name || "",
      plant_name: customer.plant_name || "Main Facility",
      address: customer.address || "",
      city: customer.city || "",
      lat: Number(customer.lat) || 44.5,
      lng: Number(customer.lng) || 11.3,
      contact_person: customer.contact_person || "",
      contact_email: customer.contact_email || ""
    });
    setIsEditingCustomer(true);
    setIsCustomerDrawerOpen(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerFormData.code.trim() || !customerFormData.company_name.trim()) {
      notify("error", "Customer Code and Company Name are required.");
      return;
    }
    try {
      const res = await fetch(`/api/assets/customer/${customerFormData.code.toLowerCase()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(customerFormData)
      });
      if (res.ok) {
        notify("success", `Customer "${customerFormData.company_name}" saved.`);
        setIsCustomerDrawerOpen(false);
        loadAllData();
        onRefresh();
      } else {
        notify("error", "Failed to save customer asset.");
      }
    } catch {
      notify("error", "Network error saving customer.");
    }
  };

  const handleDeleteCustomer = async (customer: any) => {
    if (!confirm(`Are you sure you want to delete customer facility "${customer.company_name}" (${customer.code})?`)) return;
    try {
      const res = await fetch(`/api/assets/customer/${customer.code.toLowerCase()}`, {
        method: "DELETE"
      });
      if (res.ok) {
        notify("success", `Customer ${customer.code} removed.`);
        loadAllData();
        onRefresh();
      }
    } catch {
      notify("error", "Could not delete customer.");
    }
  };

  // Close drawers on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsUserDrawerOpen(false);
        setIsCustomerDrawerOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Filtered Users
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      if (roleFilter !== "all" && u.role !== roleFilter) return false;
      if (!searchTerm.trim()) return true;
      const combined = `${u.username} ${u.name || ""} ${u.surname || ""} ${u.role}`;
      return testMatch(combined, searchTerm, matchCase, wholeWord);
    });
  }, [users, searchTerm, matchCase, wholeWord, roleFilter]);

  // Filtered Customers
  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      if (!searchTerm.trim()) return true;
      const combined = `${c.code} ${c.company_name} ${c.plant_name || ""} ${c.city} ${c.address} ${c.contact_person || ""} ${c.contact_email || ""}`;
      return testMatch(combined, searchTerm, matchCase, wholeWord);
    });
  }, [customers, searchTerm, matchCase, wholeWord]);

  const getRoleBadgeStyle = (role: string) => {
    switch (role) {
      case "Admin":
        return "bg-rose-100 text-rose-800 border-rose-300";
      case "Warehouse Operator":
        return "bg-amber-100 text-amber-800 border-amber-300";
      case "Field Engineer":
        return "bg-blue-100 text-blue-800 border-blue-300";
      case "Viewer":
        return "bg-slate-100 text-slate-800 border-slate-300";
      default:
        return "bg-purple-100 text-purple-800 border-purple-300";
    }
  };

  return (
    <div className="h-full flex flex-col space-y-2.5 overflow-hidden font-sans">
      {/* Top Banner & Sub-Tab Navigation Header (sal.vo UserManagement Style) */}
      <div className="bg-white border border-slate-300 rounded p-2 shadow-xs flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0">
            <Users className="w-4 h-4 text-rose-600" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-xs font-bold text-slate-900 tracking-tight whitespace-nowrap">
                Users & Customers Management
              </h2>
              <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded border border-slate-200 font-mono font-medium whitespace-nowrap">
                sal.vo directory
              </span>
            </div>
            <p className="text-[10.5px] text-slate-500 whitespace-nowrap">
              Manage operators, authorization scopes, and industrial customer facilities.
            </p>
          </div>
        </div>

        {/* Sub-Tabs Switcher */}
        <div className="flex items-center space-x-1.5 bg-slate-100 p-1 rounded border border-slate-200">
          <button
            onClick={() => { setActiveSubTab("users"); setSearchTerm(""); }}
            className={`flex items-center space-x-1.5 px-2.5 py-1 text-xs font-bold rounded transition-colors cursor-pointer whitespace-nowrap ${
              activeSubTab === "users"
                ? "bg-white text-rose-700 shadow-2xs border border-slate-200"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Users & Operators</span>
            <span className="text-[10px] bg-slate-200 text-slate-700 font-mono px-1 py-0.2 rounded-full font-bold">
              {users.length}
            </span>
          </button>

          <button
            onClick={() => { setActiveSubTab("roles"); setSearchTerm(""); }}
            className={`flex items-center space-x-1.5 px-2.5 py-1 text-xs font-bold rounded transition-colors cursor-pointer whitespace-nowrap ${
              activeSubTab === "roles"
                ? "bg-white text-rose-700 shadow-2xs border border-slate-200"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Roles & Scopes</span>
            <span className="text-[10px] bg-slate-200 text-slate-700 font-mono px-1 py-0.2 rounded-full font-bold">
              {Object.keys(rolesConfig).length}
            </span>
          </button>

          <button
            onClick={() => { setActiveSubTab("customers"); setSearchTerm(""); }}
            className={`flex items-center space-x-1.5 px-2.5 py-1 text-xs font-bold rounded transition-colors cursor-pointer whitespace-nowrap ${
              activeSubTab === "customers"
                ? "bg-white text-rose-700 shadow-2xs border border-slate-200"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Customer Facilities</span>
            <span className="text-[10px] bg-slate-200 text-slate-700 font-mono px-1 py-0.2 rounded-full font-bold">
              {customers.length}
            </span>
          </button>
        </div>

        {/* Action Button */}
        <div className="flex items-center space-x-2">
          {activeSubTab === "users" && (
            <button
              onClick={handleOpenCreateUser}
              className="flex items-center space-x-1.5 text-xs font-bold uppercase tracking-wider bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded shadow-2xs transition-colors cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Operator</span>
            </button>
          )}

          {activeSubTab === "roles" && (
            <button
              onClick={handleSaveRoles}
              disabled={isSavingRoles}
              className="flex items-center space-x-1.5 text-xs font-bold uppercase tracking-wider bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded shadow-2xs transition-colors cursor-pointer whitespace-nowrap"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSavingRoles ? "Saving..." : "Save Role Scopes"}</span>
            </button>
          )}

          {activeSubTab === "customers" && (
            <button
              onClick={handleOpenCreateCustomer}
              className="flex items-center space-x-1.5 text-xs font-bold uppercase tracking-wider bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded shadow-2xs transition-colors cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Customer</span>
            </button>
          )}
        </div>
      </div>

      {/* Feedback Toast if any */}
      {feedbackMsg && (
        <div className={`p-2 rounded text-xs font-bold flex items-center space-x-2 shrink-0 border whitespace-nowrap ${
          feedbackMsg.type === "success"
            ? "bg-emerald-50 text-emerald-800 border-emerald-300"
            : "bg-red-50 text-red-800 border-red-300"
        }`}>
          {feedbackMsg.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          )}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* Filter / Search Bar for Users and Customers */}
      {activeSubTab !== "roles" && (
        <div className="bg-white border border-slate-300 rounded p-1.5 shadow-xs flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
              <input
                type="text"
                placeholder={activeSubTab === "users" ? "Search operator by name, username, or role..." : "Search client by company, plant, city, contact..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded pl-8 pr-2 py-1 text-xs text-slate-800 focus:bg-white focus:border-rose-600 focus:outline-none"
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm("")} className="absolute right-2 top-1.5 text-slate-400 hover:text-slate-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Case Sensitive Toggle (sal.vo style) */}
            <button
              onClick={() => setMatchCase(!matchCase)}
              title="Match Case (Aa)"
              className={`px-1.5 py-1 text-[10px] font-bold rounded border cursor-pointer whitespace-nowrap ${
                matchCase ? "bg-rose-100 text-rose-800 border-rose-300" : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100"
              }`}
            >
              Aa
            </button>

            {/* Whole Word Toggle (sal.vo style) */}
            <button
              onClick={() => setWholeWord(!wholeWord)}
              title="Match Whole Word"
              className={`px-1.5 py-1 text-[10px] font-bold rounded border cursor-pointer whitespace-nowrap ${
                wholeWord ? "bg-rose-100 text-rose-800 border-rose-300" : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100"
              }`}
            >
              "w"
            </button>

            {activeSubTab === "users" && (
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs text-slate-700 font-bold focus:outline-none"
              >
                <option value="all">All Roles</option>
                {Object.keys(rolesConfig).map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            )}
          </div>

          <div className="text-[11px] font-medium text-slate-500 whitespace-nowrap">
            Showing <span className="font-bold text-slate-800 font-mono">{activeSubTab === "users" ? filteredUsers.length : filteredCustomers.length}</span> records
          </div>
        </div>
      )}

      {/* Main Tab Content */}
      <div className="flex-1 min-h-0 bg-white border border-slate-300 rounded shadow-xs overflow-hidden flex flex-col">
        {/* SUBTAB 1: USERS & OPERATORS */}
        {activeSubTab === "users" && (
          <div className="flex-1 overflow-y-auto min-h-0">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-100 border-b border-slate-200 text-slate-600 text-[10px] font-bold uppercase tracking-wider sticky top-0 z-10">
                <tr>
                  <th className="px-3.5 py-2 whitespace-nowrap">Operator</th>
                  <th className="px-3.5 py-2 whitespace-nowrap">Username</th>
                  <th className="px-3.5 py-2 whitespace-nowrap">System Role</th>
                  <th className="px-3.5 py-2 whitespace-nowrap">Account Status</th>
                  <th className="px-3.5 py-2 whitespace-nowrap text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400 text-xs">
                      No operators found matching the criteria.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    const isCurrent = u.username.toLowerCase() === currentUser.toLowerCase();
                    const initials = `${(u.name || "")[0] || ""}${(u.surname || "")[0] || u.username[0] || "U"}`.toUpperCase();

                    return (
                      <tr key={u.username} className={`hover:bg-slate-50/80 transition-colors ${u.inactive ? "opacity-60 bg-slate-50/40" : ""}`}>
                        <td className="px-3.5 py-2.5 whitespace-nowrap">
                          <div className="flex items-center space-x-2.5">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-[11px] shrink-0 border ${
                              isCurrent ? "bg-rose-600 text-white border-rose-700" : "bg-slate-100 text-slate-700 border-slate-300"
                            }`}>
                              {initials}
                            </div>
                            <div>
                              <div className="font-bold text-slate-800 text-xs flex items-center space-x-1.5 whitespace-nowrap">
                                <span>{u.name || ""} {u.surname || ""}</span>
                                {isCurrent && (
                                  <span className="text-[9.5px] bg-rose-100 text-rose-800 border border-rose-300 px-1 py-0.2 rounded font-bold uppercase tracking-tight">
                                    Current User
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-400 block">{u.role}</span>
                            </div>
                          </div>
                        </td>

                        <td className="px-3.5 py-2.5 whitespace-nowrap">
                          <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            {u.username}
                          </span>
                        </td>

                        <td className="px-3.5 py-2.5 whitespace-nowrap">
                          <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded border whitespace-nowrap ${getRoleBadgeStyle(u.role)}`}>
                            {u.role}
                          </span>
                        </td>

                        <td className="px-3.5 py-2.5 whitespace-nowrap">
                          {u.inactive ? (
                            <span className="inline-flex items-center space-x-1 text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 whitespace-nowrap">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                              <span>Inactive</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 whitespace-nowrap">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              <span>Active</span>
                            </span>
                          )}
                        </td>

                        <td className="px-3.5 py-2.5 whitespace-nowrap text-right space-x-1">
                          {onUserChange && !isCurrent && (
                            <button
                              onClick={() => onUserChange(u.username)}
                              title="Switch active session to this operator"
                              className="text-[10px] font-bold uppercase text-slate-600 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded transition-colors cursor-pointer inline-flex items-center space-x-1"
                            >
                              <UserCheck className="w-3 h-3 text-slate-500" />
                              <span>Switch</span>
                            </button>
                          )}

                          <button
                            onClick={() => handleToggleUserInactive(u)}
                            title={u.inactive ? "Activate Account" : "Deactivate Account"}
                            className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors"
                          >
                            {u.inactive ? <UserCheck className="w-3.5 h-3.5 text-emerald-600" /> : <UserX className="w-3.5 h-3.5 text-amber-600" />}
                          </button>

                          <button
                            onClick={() => handleOpenEditUser(u)}
                            title="Edit Operator"
                            className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleDeleteUser(u.username)}
                            title="Delete User"
                            disabled={isCurrent}
                            className={`p-1 rounded transition-colors ${isCurrent ? "text-slate-200 cursor-not-allowed" : "text-slate-400 hover:text-red-600"}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* SUBTAB 2: ROLES & SCOPES MATRIX */}
        {activeSubTab === "roles" && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Role Authorization Matrix
                </h3>
                <p className="text-[11px] text-slate-500">
                  Assign permission capabilities to each system role. Changes are applied dynamically to active operators.
                </p>
              </div>

              {isAddingRole ? (
                <div className="flex items-center space-x-1.5">
                  <input
                    type="text"
                    placeholder="Role Name (e.g. Quality Auditor)..."
                    value={newRoleName}
                    onChange={(e) => setNewRoleName(e.target.value)}
                    className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs focus:bg-white focus:outline-none"
                  />
                  <button
                    onClick={handleAddNewRole}
                    className="bg-rose-600 text-white px-2 py-1 text-xs font-bold rounded cursor-pointer"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => { setIsAddingRole(false); setNewRoleName(""); }}
                    className="text-slate-400 hover:text-slate-600 p-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setIsAddingRole(true)}
                  className="flex items-center space-x-1 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2.5 py-1 rounded transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Define New Role</span>
                </button>
              )}
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 text-[10.5px] font-bold uppercase">
                  <tr>
                    <th className="px-3.5 py-2.5 whitespace-nowrap bg-slate-100/70 border-r border-slate-200 min-w-44">
                      Role Name
                    </th>
                    {AVAILABLE_PERMISSIONS.map(p => (
                      <th key={p.key} className="px-3 py-2 text-center whitespace-nowrap border-r border-slate-200 last:border-r-0" title={p.desc}>
                        <div className="font-bold text-slate-800">{p.label}</div>
                        <div className="text-[9px] text-slate-400 font-mono font-normal">{p.key}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {Object.entries(rolesConfig).map(([roleName, perms]) => (
                    <tr key={roleName} className="hover:bg-slate-50/50">
                      <td className="px-3.5 py-3 whitespace-nowrap font-bold text-slate-800 bg-slate-50/50 border-r border-slate-200">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded border whitespace-nowrap ${getRoleBadgeStyle(roleName)}`}>
                          {roleName}
                        </span>
                      </td>

                      {AVAILABLE_PERMISSIONS.map(p => {
                        const isGranted = Array.isArray(perms) ? perms.includes(p.key) : false;
                        return (
                          <td key={p.key} className="px-3 py-3 text-center border-r border-slate-200 last:border-r-0">
                            <input
                              type="checkbox"
                              checked={isGranted}
                              onChange={() => handleTogglePermission(roleName, p.key)}
                              className="w-4 h-4 accent-rose-600 rounded border-slate-300 cursor-pointer"
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SUBTAB 3: CUSTOMER FACILITIES DIRECTORY */}
        {activeSubTab === "customers" && (
          <div className="flex-1 overflow-y-auto min-h-0">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-100 border-b border-slate-200 text-slate-600 text-[10px] font-bold uppercase tracking-wider sticky top-0 z-10">
                <tr>
                  <th className="px-3.5 py-2 whitespace-nowrap">Code</th>
                  <th className="px-3.5 py-2 whitespace-nowrap">Company & Facility</th>
                  <th className="px-3.5 py-2 whitespace-nowrap">Location (City / Address)</th>
                  <th className="px-3.5 py-2 whitespace-nowrap">Technical Contact</th>
                  <th className="px-3.5 py-2 whitespace-nowrap text-center">Assigned Kits</th>
                  <th className="px-3.5 py-2 whitespace-nowrap text-center">Sensors Active</th>
                  <th className="px-3.5 py-2 whitespace-nowrap text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400 text-xs">
                      No customer facilities registered.
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map((c) => {
                    const kitsCount = Array.isArray(c.kits) ? c.kits.length : (c._resolved?.kits?.length || 0);
                    const sensorsCount = Array.isArray(c.sensors) ? c.sensors.length : (c._resolved?.sensors?.length || 0);

                    return (
                      <tr key={c.code} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-3.5 py-2.5 whitespace-nowrap">
                          <span className="font-mono text-xs font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                            {c.code}
                          </span>
                        </td>

                        <td className="px-3.5 py-2.5 whitespace-nowrap">
                          <div className="font-bold text-slate-900 text-xs">{c.company_name}</div>
                          <span className="text-[10.5px] text-slate-500 font-medium">{c.plant_name || "Main Plant"}</span>
                        </td>

                        <td className="px-3.5 py-2.5 whitespace-nowrap">
                          <div className="flex items-center space-x-1.5 text-slate-800 font-medium">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{c.city}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 block truncate max-w-xs">{c.address}</span>
                        </td>

                        <td className="px-3.5 py-2.5 whitespace-nowrap">
                          <div className="font-medium text-slate-800">{c.contact_person || "-"}</div>
                          {c.contact_email ? (
                            <a
                              href={`mailto:${c.contact_email}`}
                              className="text-[10px] text-rose-600 hover:underline flex items-center space-x-1"
                            >
                              <Mail className="w-3 h-3 shrink-0" />
                              <span>{c.contact_email}</span>
                            </a>
                          ) : (
                            <span className="text-[10px] text-slate-400">-</span>
                          )}
                        </td>

                        <td className="px-3.5 py-2.5 whitespace-nowrap text-center">
                          <span className="inline-flex items-center space-x-1 font-mono text-[11px] font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                            <Boxes className="w-3 h-3 text-blue-600" />
                            <span>{kitsCount}</span>
                          </span>
                        </td>

                        <td className="px-3.5 py-2.5 whitespace-nowrap text-center">
                          <span className="inline-flex items-center space-x-1 font-mono text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            <Cpu className="w-3 h-3 text-emerald-600" />
                            <span>{sensorsCount}</span>
                          </span>
                        </td>

                        <td className="px-3.5 py-2.5 whitespace-nowrap text-right space-x-1">
                          {onSelectCustomerOnMap && (
                            <button
                              onClick={() => onSelectCustomerOnMap(c.code)}
                              title="View on Facility GIS Map"
                              className="p-1 text-slate-400 hover:text-blue-600 rounded transition-colors"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            onClick={() => handleOpenEditCustomer(c)}
                            title="Edit Facility Details"
                            className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleDeleteCustomer(c)}
                            title="Delete Facility"
                            className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* FULL-PAGE-HEIGHT SIDE DRAWER: CREATE / EDIT OPERATOR */}
      {isUserDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-2xs transition-opacity"
            onClick={() => setIsUserDrawerOpen(false)}
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-md bg-white border-l border-slate-300 shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-200">
              {/* Drawer Header */}
              <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
                <div className="flex items-center space-x-2">
                  <div className="w-7 h-7 rounded bg-rose-100 flex items-center justify-center">
                    <Users className="w-4 h-4 text-rose-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      {isEditingUser ? "Edit Operator Account" : "Register New Operator"}
                    </h3>
                    <p className="text-[10.5px] text-slate-500">
                      Bonfiglioli identity credentials & role scope
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsUserDrawerOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drawer Body */}
              <form id="userForm" onSubmit={handleSaveUser} className="flex-1 overflow-y-auto p-5 space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Username / ID <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    disabled={isEditingUser}
                    value={userFormData.username}
                    onChange={(e) => setUserFormData({ ...userFormData, username: e.target.value })}
                    placeholder="e.g. m.rossi"
                    className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-1.5 text-xs text-slate-800 font-mono focus:bg-white focus:border-rose-600 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Unique operator account handle.
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      First Name
                    </label>
                    <input
                      type="text"
                      value={userFormData.name || ""}
                      onChange={(e) => setUserFormData({ ...userFormData, name: e.target.value })}
                      placeholder="e.g. Mario"
                      className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-1.5 text-xs text-slate-800 focus:bg-white focus:border-rose-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Last Name / Surname
                    </label>
                    <input
                      type="text"
                      value={userFormData.surname || ""}
                      onChange={(e) => setUserFormData({ ...userFormData, surname: e.target.value })}
                      placeholder="e.g. Rossi"
                      className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-1.5 text-xs text-slate-800 focus:bg-white focus:border-rose-600 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    System Role Scope <span className="text-rose-600">*</span>
                  </label>
                  <select
                    value={userFormData.role}
                    onChange={(e) => setUserFormData({ ...userFormData, role: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-1.5 text-xs text-slate-800 font-bold focus:bg-white focus:border-rose-600 focus:outline-none"
                  >
                    {Object.keys(rolesConfig).map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>

                <div className="pt-2 border-t border-slate-200">
                  <label className="flex items-center space-x-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={userFormData.inactive || false}
                      onChange={(e) => setUserFormData({ ...userFormData, inactive: e.target.checked })}
                      className="w-4 h-4 accent-rose-600 rounded border-slate-300"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">Deactivate Account</span>
                      <span className="text-[10.5px] text-slate-400 block">
                        Prevents operator from acquiring collaborative locks or modifying assets.
                      </span>
                    </div>
                  </label>
                </div>
              </form>

              {/* Drawer Footer */}
              <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
                <button
                  type="button"
                  onClick={() => setIsUserDrawerOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  form="userForm"
                  className="flex items-center space-x-1.5 text-xs font-bold uppercase tracking-wider bg-rose-600 hover:bg-rose-700 text-white px-4 py-1.5 rounded shadow-2xs transition-colors cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isEditingUser ? "Update Operator" : "Create Operator"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FULL-PAGE-HEIGHT SIDE DRAWER: CREATE / EDIT CUSTOMER */}
      {isCustomerDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-2xs transition-opacity"
            onClick={() => setIsCustomerDrawerOpen(false)}
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-lg bg-white border-l border-slate-300 shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-200">
              {/* Drawer Header */}
              <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
                <div className="flex items-center space-x-2">
                  <div className="w-7 h-7 rounded bg-rose-100 flex items-center justify-center">
                    <Building2 className="w-4 h-4 text-rose-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      {isEditingCustomer ? "Edit Customer Facility" : "Register Industrial Client"}
                    </h3>
                    <p className="text-[10.5px] text-slate-500">
                      Client facility directory and Leaflet telemetry coordinates
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsCustomerDrawerOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drawer Body */}
              <form id="customerForm" onSubmit={handleSaveCustomer} className="flex-1 overflow-y-auto p-5 space-y-3.5">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Customer Code <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      disabled={isEditingCustomer}
                      value={customerFormData.code}
                      onChange={(e) => setCustomerFormData({ ...customerFormData, code: e.target.value.toUpperCase() })}
                      placeholder="CUST-00X"
                      className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs text-rose-700 font-mono font-bold focus:bg-white focus:border-rose-600 focus:outline-none disabled:bg-slate-100"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Company Legal Name <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={customerFormData.company_name}
                      onChange={(e) => setCustomerFormData({ ...customerFormData, company_name: e.target.value })}
                      placeholder="e.g. Barilla G. e R. Fratelli S.p.A."
                      className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-800 font-bold focus:bg-white focus:border-rose-600 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Facility / Plant Designation
                  </label>
                  <input
                    type="text"
                    value={customerFormData.plant_name}
                    onChange={(e) => setCustomerFormData({ ...customerFormData, plant_name: e.target.value })}
                    placeholder="e.g. Headquarters / Packaging Line 4"
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-800 focus:bg-white focus:border-rose-600 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Street Address
                    </label>
                    <input
                      type="text"
                      value={customerFormData.address}
                      onChange={(e) => setCustomerFormData({ ...customerFormData, address: e.target.value })}
                      placeholder="e.g. Via Mantova 166"
                      className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-800 focus:bg-white focus:border-rose-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      City / Region
                    </label>
                    <input
                      type="text"
                      value={customerFormData.city}
                      onChange={(e) => setCustomerFormData({ ...customerFormData, city: e.target.value })}
                      placeholder="e.g. Parma"
                      className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-800 focus:bg-white focus:border-rose-600 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded border border-slate-200 space-y-2">
                  <span className="text-[11px] font-bold text-slate-700 block uppercase tracking-wider">
                    GIS Coordinates (Leaflet Map Integration)
                  </span>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10.5px] font-bold text-slate-600 block mb-0.5">Latitude</label>
                      <input
                        type="number"
                        step="any"
                        value={customerFormData.lat}
                        onChange={(e) => setCustomerFormData({ ...customerFormData, lat: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs font-mono text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="text-[10.5px] font-bold text-slate-600 block mb-0.5">Longitude</label>
                      <input
                        type="number"
                        step="any"
                        value={customerFormData.lng}
                        onChange={(e) => setCustomerFormData({ ...customerFormData, lng: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs font-mono text-slate-800"
                      />
                    </div>
                  </div>
                  <div className="flex items-center space-x-1.5 pt-1">
                    <span className="text-[10px] text-slate-400">Presets:</span>
                    <button
                      type="button"
                      onClick={() => setCustomerFormData(prev => ({ ...prev, city: "Bologna", lat: 44.4949, lng: 11.3426 }))}
                      className="text-[10px] bg-white border border-slate-200 px-1.5 py-0.5 rounded hover:border-rose-500 font-bold text-slate-600"
                    >
                      Bologna
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomerFormData(prev => ({ ...prev, city: "Modena", lat: 44.6471, lng: 10.9252 }))}
                      className="text-[10px] bg-white border border-slate-200 px-1.5 py-0.5 rounded hover:border-rose-500 font-bold text-slate-600"
                    >
                      Modena
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomerFormData(prev => ({ ...prev, city: "Parma", lat: 44.8015, lng: 10.3279 }))}
                      className="text-[10px] bg-white border border-slate-200 px-1.5 py-0.5 rounded hover:border-rose-500 font-bold text-slate-600"
                    >
                      Parma
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomerFormData(prev => ({ ...prev, city: "Reggio Emilia", lat: 44.6989, lng: 10.6307 }))}
                      className="text-[10px] bg-white border border-slate-200 px-1.5 py-0.5 rounded hover:border-rose-500 font-bold text-slate-600"
                    >
                      Reggio Emilia
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Technical Contact Person
                    </label>
                    <input
                      type="text"
                      value={customerFormData.contact_person}
                      onChange={(e) => setCustomerFormData({ ...customerFormData, contact_person: e.target.value })}
                      placeholder="e.g. Ing. Roberto Bianchi"
                      className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-800 focus:bg-white focus:border-rose-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Contact Email
                    </label>
                    <input
                      type="email"
                      value={customerFormData.contact_email}
                      onChange={(e) => setCustomerFormData({ ...customerFormData, contact_email: e.target.value })}
                      placeholder="e.g. r.bianchi@client.com"
                      className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-800 focus:bg-white focus:border-rose-600 focus:outline-none"
                    />
                  </div>
                </div>
              </form>

              {/* Drawer Footer */}
              <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
                <button
                  type="button"
                  onClick={() => setIsCustomerDrawerOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  form="customerForm"
                  className="flex items-center space-x-1.5 text-xs font-bold uppercase tracking-wider bg-rose-600 hover:bg-rose-700 text-white px-4 py-1.5 rounded shadow-2xs transition-colors cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isEditingCustomer ? "Update Facility" : "Register Facility"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
