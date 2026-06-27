    "use client";

    import { useEffect, useMemo, useState } from "react";
    import { getSession, signIn, signOut } from "next-auth/react";
    import Link from "next/link";

    type User = {
      id: string;
      email: string;
      name: string;
      plan: string;
      active: boolean;
      expires_at: string | null;
      created_at: string;
      last_login_at: string | null;
      last_seen_at: string | null;
    };

    type LoginLog = {
      id: string;
      user_id: string | null;
      email: string | null;
      role: string | null;
      ip: string | null;
      user_agent: string | null;
      browser: string | null;
      os: string | null;
      device: string | null;
      country: string | null;
      city: string | null;
      latitude: number | null;
      longitude: number | null;
      created_at: string;
    };

    function generatePassword() {
      const chars =
        "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@$!%*?";
      return Array.from({ length: 12 }, () =>
        chars[Math.floor(Math.random() * chars.length)]
      ).join("");
    }

    function getDevice(userAgent: string | null) {
      const ua = userAgent?.toLowerCase() ?? "";

      if (ua.includes("iphone")) return "iPhone";
      if (ua.includes("ipad")) return "iPad";
      if (ua.includes("android")) return "Android";
      if (ua.includes("mac")) return "Mac";
      if (ua.includes("windows")) return "Windows";
      if (ua.includes("linux")) return "Linux";

      return "Desconocido";
    }

    function getBrowser(userAgent: string | null) {
      const ua = userAgent?.toLowerCase() ?? "";

      if (ua.includes("edg")) return "Edge";
      if (ua.includes("chrome")) return "Chrome";
      if (ua.includes("safari")) return "Safari";
      if (ua.includes("firefox")) return "Firefox";

      return "Navegador";
    }

    export default function AdminPage() {
      const [session, setSession] = useState<any>(null);
      const [authLoading, setAuthLoading] = useState(true);

      const [users, setUsers] = useState<User[]>([]);
      const [logs, setLogs] = useState<LoginLog[]>([]);

      const [email, setEmail] = useState("");
      const [password, setPassword] = useState(generatePassword());
      const [name, setName] = useState("");
      const [plan, setPlan] = useState("beta");
      const [expiresAt, setExpiresAt] = useState("");
      const [search, setSearch] = useState("");
      const [loading, setLoading] = useState(false);

      useEffect(() => {
        async function checkAuth() {
          const currentSession = await getSession();

          if (!currentSession) {
            signIn(undefined, { callbackUrl: "/admin" });
            return;
          }

          setSession(currentSession);
          setAuthLoading(false);
        }

        checkAuth();
      }, []);

      async function loadUsers() {
        const res = await fetch("/api/admin/users", { cache: "no-store" });
        const data = await res.json();
        setUsers(data.users ?? []);
      }

    async function loadLogs() {
      const res = await fetch("/api/admin/users/login-logs", {
        cache: "no-store",
      });

      const data = await res.json();
      setLogs(data.logs ?? []);
    }

      async function refreshAll() {
        await Promise.all([loadUsers(), loadLogs()]);
      }

      useEffect(() => {
        if (session) refreshAll();
      }, [session]);

      function formatDate(value: string | null) {
        if (!value) return "Nunca";
        return new Date(value).toLocaleString("es-ES");
      }

      function onlineStatus(value: string | null) {
        if (!value) return "Offline";

        const diff = Date.now() - new Date(value).getTime();
        const minutes = Math.floor(diff / 60000);

        if (minutes < 2) return "Online";
        if (minutes < 60) return `Hace ${minutes} min`;

        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `Hace ${hours} h`;

        const days = Math.floor(hours / 24);
        return `Hace ${days} días`;
      }

      function isOnline(value: string | null) {
        if (!value) return false;
        const diff = Date.now() - new Date(value).getTime();
        return diff < 2 * 60 * 1000;
      }

      function copyAccess(u: { email: string; plan: string; password?: string }) {
        navigator.clipboard.writeText(
          `IRVIN ANALYTICS

    Link: https://irvin-picks.vercel.app/login
    Email: ${u.email}
    ${
      u.password
        ? `Contraseña: ${u.password}`
        : "Contraseña: la asignada por el administrador"
    }
    Plan: ${u.plan}`
        );

        alert("Acceso copiado");
      }

      async function createUser(e: React.FormEvent) {
        e.preventDefault();

        if (!email || !password || !name) {
          alert("Completa nombre, email y contraseña");
          return;
        }

        setLoading(true);

        const cleanEmail = email.trim().toLowerCase();

        const res = await fetch("/api/admin/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: cleanEmail,
            password,
            name: name.trim(),
            plan,
            expires_at: expiresAt || null,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          alert("Error creando usuario: " + data.error);
          setLoading(false);
          return;
        }

        copyAccess({ email: cleanEmail, password, plan });

        setEmail("");
        setName("");
        setPassword(generatePassword());
        setPlan("beta");
        setExpiresAt("");
        setLoading(false);
        refreshAll();
      }

      async function toggleUser(id: string, active: boolean) {
        const res = await fetch("/api/admin/users", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, active: !active }),
        });

        if (!res.ok) {
          const data = await res.json();
          alert("Error cambiando estado: " + data.error);
          return;
        }

        refreshAll();
      }


    async function updateUserPlan(user: User, newPlan: string) {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: user.id,
          plan: newPlan,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error ?? "Error cambiando plan");
        return;
      }

      refreshAll();
    }

    async function updateUserExpiry(user: User) {
      const newDate = prompt(
        `Nueva fecha de expiración para ${user.email}. Ejemplo: 2026-12-31. Déjalo vacío para no expirar.`,
        user.expires_at ? user.expires_at.slice(0, 10) : ""
      );

      if (newDate === null) return;

      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: user.id,
          expires_at: newDate || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error ?? "Error cambiando expiración");
        return;
      }

      refreshAll();
    }






      async function resetPassword(user: User) {
        const newPassword = prompt(
          `Nueva contraseña para ${user.email}`,
          generatePassword()
        );

        if (!newPassword) return;

        const res = await fetch("/api/admin/users", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: user.id,
            password: newPassword,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          alert(data.error ?? "Error cambiando contraseña");
          return;
        }

        navigator.clipboard.writeText(
          `IRVIN ANALYTICS

    Link: https://irvin-picks.vercel.app/login
    Email: ${user.email}
    Nueva contraseña: ${newPassword}`
        );

        alert("Contraseña cambiada y copiada al portapapeles.");
        refreshAll();
      }

      async function forceLogout(user: User) {
        if (!confirm(`¿Expulsar sesión activa de ${user.email}?`)) return;

        const res = await fetch("/api/admin/users", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: user.id,
            forceLogout: true,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          alert(data.error ?? "Error expulsando usuario");
          return;
        }

        alert("Sesión expulsada correctamente.");
        refreshAll();
      }

      async function deleteUser(user: User) {
        const currentEmail = session?.user?.email;

        if (user.email === currentEmail) {
          alert("No puedes eliminar tu propio usuario admin.");
          return;
        }

        if (!confirm(`¿Seguro que quieres eliminar a ${user.email}?`)) return;

        const res = await fetch("/api/admin/users", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: user.id }),
        });

        const data = await res.json();

        if (!res.ok) {
          alert("Error eliminando usuario: " + data.error);
          return;
        }

        refreshAll();
      }

      const filteredUsers = useMemo(() => {
        const q = search.toLowerCase().trim();

        return users.filter(
          (u) =>
            u.name?.toLowerCase().includes(q) ||
            u.email?.toLowerCase().includes(q) ||
            u.plan?.toLowerCase().includes(q)
        );
      }, [users, search]);

      const stats = {
        total: users.length,
        activos: users.filter((u) => u.active).length,
        online: users.filter((u) => isOnline(u.last_seen_at)).length,
        beta: users.filter((u) => u.plan === "beta").length,
        premium: users.filter((u) => u.plan === "premium" || u.plan === "vip")
          .length,
        bloqueados: users.filter((u) => !u.active).length,
      };

      if (authLoading) {
        return (
          <main className="min-h-screen bg-[#03070b] text-white flex items-center justify-center">
            Cargando panel...
          </main>
        );
      }

      if (
        (session?.user as any)?.role !== "ADMIN" &&
        (session?.user as any)?.plan !== "admin"
      ) {
        return (
          <main className="min-h-screen bg-[#03070b] text-white flex items-center justify-center">
            Acceso denegado
          </main>
        );
      }

      return (
        <main className="min-h-screen bg-[#03070b] text-white">
          <div className="flex">
            <aside className="w-72 min-h-screen border-r border-white/10 bg-[#07111c] p-6">
              <h1 className="text-3xl font-black text-green-400">IRVIN</h1>
              <p className="text-xs tracking-[0.35em] text-green-400 mb-10">
                ANALYTICS
              </p>

              <nav className="space-y-3 text-sm">
                <div className="bg-green-500 text-black font-black rounded-xl px-4 py-3">
                  Usuarios
                </div>

                <Link
                  href="/admin/security"
                  className="block text-white/50 px-4 py-3 rounded-xl hover:bg-white/10"
                >
                  🛡 Seguridad
                </Link>

                <div className="text-white/50 px-4 py-3">Licencias</div>
                <div className="text-white/50 px-4 py-3">Pagos</div>
                <div className="text-white/50 px-4 py-3">Ajustes</div>
              </nav>
            </aside>

            <section className="flex-1 p-8">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h2 className="text-4xl font-black">Panel de administración</h2>
                  <p className="text-white/50">
                    Usuarios, licencias, accesos, actividad y seguridad.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <Link
      href="/live-tv"
      target="_blank"
      className="bg-green-500 text-black rounded-full px-4 py-2 font-black hover:bg-green-400"
    >
      📺 Live TV
    </Link>
                  <button
                    onClick={refreshAll}
                    className="bg-white/10 text-white border border-white/10 rounded-full px-4 py-2 font-bold hover:bg-white/15"
                  >
                    Actualizar
                  </button>

                  <div className="bg-green-500/10 text-green-400 border border-green-500/30 rounded-full px-4 py-2 font-bold">
                    ADMIN ACTIVO
                  </div>

                  <button
                    onClick={() => signOut({ callbackUrl: "/login" })}
                    className="bg-red-500/20 text-red-300 border border-red-500/30 rounded-full px-4 py-2 font-bold hover:bg-red-500/30"
                  >
                    Cerrar sesión
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-6 gap-4 mb-8">
                <Card title="Usuarios" value={stats.total} />
                <Card title="Activos" value={stats.activos} />
                <Card title="Online" value={stats.online} />
                <Card title="Beta" value={stats.beta} />
                <Card title="Premium/VIP" value={stats.premium} />
                <Card title="Bloqueados" value={stats.bloqueados} />
              </div>

              <div className="grid grid-cols-3 gap-6">
                <form
                  onSubmit={createUser}
                  className="bg-[#07111c] border border-white/10 rounded-3xl p-6 space-y-4"
                >
                  <h3 className="text-xl font-black">Crear usuario</h3>

                  <input
                    className="w-full bg-white/10 rounded-xl px-4 py-3 outline-none focus:border-green-400 border border-white/10"
                    placeholder="Nombre"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />

                  <input
                    className="w-full bg-white/10 rounded-xl px-4 py-3 outline-none focus:border-green-400 border border-white/10"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />

                  <div className="flex gap-2">
                    <input
                      className="w-full bg-white/10 rounded-xl px-4 py-3 outline-none focus:border-green-400 border border-white/10"
                      placeholder="Contraseña"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />

                    <button
                      type="button"
                      onClick={() => setPassword(generatePassword())}
                      className="bg-yellow-500/20 text-yellow-300 rounded-xl px-4 font-black"
                    >
                      🎲
                    </button>
                  </div>

                  <input
                    className="w-full bg-white/10 rounded-xl px-4 py-3 outline-none focus:border-green-400 border border-white/10"
                    type="date"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                  />

                  <select
                    className="w-full bg-white/10 rounded-xl px-4 py-3 outline-none focus:border-green-400 border border-white/10"
                    value={plan}
                    onChange={(e) => setPlan(e.target.value)}
                  >
                    <option value="beta">Beta</option>
                    <option value="premium">Premium</option>
                    <option value="vip">VIP</option>
                  </select>

                  <button
                    disabled={loading}
                    className="w-full bg-green-500 disabled:bg-green-500/40 disabled:cursor-not-allowed text-black font-black rounded-xl py-3"
                  >
                    {loading ? "Creando..." : "Crear y copiar acceso"}
                  </button>
                </form>

                <div className="col-span-2 bg-[#07111c] border border-white/10 rounded-3xl p-6">
                  <div className="flex justify-between items-center mb-5">
                    <div>
                      <h3 className="text-xl font-black">Usuarios registrados</h3>
                      <p className="text-white/40 text-sm">
                        Estado, conexión, login, actividad y acciones.
                      </p>
                    </div>

                    <input
                      className="bg-white/10 rounded-xl px-4 py-3 w-72 outline-none focus:border-green-400 border border-white/10"
                      placeholder="Buscar..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>

                  <div className="space-y-3 max-h-[620px] overflow-y-auto pr-1">
                    {filteredUsers.map((u) => {
                      const online = isOnline(u.last_seen_at);
                      const isAdminUser =
                        u.plan === "admin" || u.email === session?.user?.email;

                      return (
                        <div
                          key={u.id}
                          className="bg-[#0b1623] border border-white/10 rounded-2xl p-4"
                        >
                          <div className="grid grid-cols-[1.2fr_1.8fr_0.8fr_0.8fr_1.1fr_1.1fr] gap-3 items-center text-sm">
                            <div>
                              <div className="font-black">{u.name}</div>
                              <div
                                className={
                                  online ? "text-green-400" : "text-white/40"
                                }
                              >
                                {online ? "● Online" : "● Offline"}
                              </div>
                            </div>

                            <div className="text-white/70 truncate">{u.email}</div>

                            <div className="uppercase font-black text-green-400">
                              {u.plan}
                            </div>

                            <div
                              className={
                                u.active ? "text-green-400" : "text-red-400"
                              }
                            >
                              {u.active ? "Activo" : "Inactivo"}
                            </div>

                            <div className="text-white/50 text-xs">
                              Login:
                              <br />
                              <span className="text-white/80">
                                {formatDate(u.last_login_at)}
                              </span>
                            </div>

                            <div className="text-white/50 text-xs">
                              Actividad:
                              <br />
                              <span className="text-cyan-400 font-bold">
                                {onlineStatus(u.last_seen_at)}
                              </span>
                            </div>
                          </div>


                          <select
      value={u.plan}
      onChange={(e) => updateUserPlan(u, e.target.value)}
      className="bg-white/10 rounded-xl px-3 py-2 text-sm"
    >
      <option value="beta">Beta</option>
      <option value="premium">Premium</option>
      <option value="vip">VIP</option>
    </select>

    <button
      onClick={() => updateUserExpiry(u)}
      className="bg-purple-500/20 text-purple-300 rounded-xl px-3 py-2 text-sm"
    >
      📅 Expira
    </button>

                          <div className="mt-4 flex flex-wrap gap-2 justify-end">
                            {!isAdminUser && (
                              <>
                                <button
                                  onClick={() => toggleUser(u.id, u.active)}
                                  className="bg-white/10 rounded-xl px-3 py-2 text-sm"
                                >
                                  {u.active ? "Desactivar" : "Activar"}
                                </button>

                                <button
                                  onClick={() => resetPassword(u)}
                                  className="bg-yellow-500/20 text-yellow-300 rounded-xl px-3 py-2 text-sm"
                                >
                                  🔑 Reset
                                </button>

                                <button
                                  onClick={() => forceLogout(u)}
                                  className="bg-blue-500/20 text-blue-300 rounded-xl px-3 py-2 text-sm"
                                >
                                  🚪 Expulsar
                                </button>

                                <button
                                  onClick={() => deleteUser(u)}
                                  className="bg-red-500/20 text-red-300 rounded-xl px-3 py-2 text-sm"
                                >
                                  Eliminar
                                </button>
                              </>
                            )}

                            <button
                              onClick={() => copyAccess(u)}
                              className="bg-green-500/20 text-green-300 rounded-xl px-3 py-2 text-sm"
                            >
                              Copiar
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {filteredUsers.length === 0 && (
                      <div className="text-center text-white/40 py-8">
                        No hay usuarios que coincidan con la búsqueda.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-6 bg-[#07111c] border border-white/10 rounded-3xl p-6">
                <div className="flex justify-between items-center mb-5">
                  <div>
                    <h3 className="text-xl font-black">Historial de conexiones</h3>
                    <p className="text-white/40 text-sm">
                      Últimos accesos registrados: email, rol, IP, dispositivo,
                      navegador y hora.
                    </p>
                  </div>

                  <button
                    onClick={loadLogs}
                    className="bg-white/10 rounded-xl px-4 py-2 font-bold"
                  >
                    Actualizar logs
                  </button>
                </div>

                <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">


    {logs.map((log) => (
      <div
        key={log.id}
        className="grid grid-cols-[1.7fr_0.7fr_1fr_1fr_1fr_1fr_1.2fr] gap-3 items-center bg-[#0b1623] border border-white/10 rounded-2xl p-4 text-sm"
      >
        <div>
          <div className="font-black">{log.email ?? "Sin email"}</div>
          <div className="text-white/40">{log.user_id ?? "Sin ID"}</div>
        </div>

        <div className="font-black text-green-400">
          {log.role ?? "USER"}
        </div>

        <div className="text-white/70 truncate">
          {log.ip ?? "Sin IP"}
        </div>

        <div className="text-white/70">
          {log.device ?? getDevice(log.user_agent)}
        </div>

        <div className="text-white/70">
          {log.browser ?? getBrowser(log.user_agent)}
        </div>

        <div className="text-white/70">
          {log.city || log.country
            ? `${log.city ?? ""} ${log.country ?? ""}`.trim()
            : "Sin ubicación"}
        </div>

        <div className="text-white/50 text-xs">
          {formatDate(log.created_at)}
        </div>
      </div>
    ))}



                  {logs.length === 0 && (
                    <div className="text-center text-white/40 py-8">
                      Aún no hay conexiones registradas.
                    </div>
                  )}
                </div>
              </div>
            </section>
          </div>
        </main>
      );
    }

    function Card({ title, value }: { title: string; value: number }) {
      return (
        <div className="bg-[#07111c] border border-white/10 rounded-3xl p-6">
          <p className="text-white/50 text-sm">{title}</p>
          <p className="text-4xl font-black text-green-400 mt-2">{value}</p>
        </div>
      );
    }   