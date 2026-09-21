import { FormEvent, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { configured, supabase } from "./lib/supabase";
import { demoProducts, demoSettings } from "./demo";
import type { Order, Product, StoreSettings } from "./types";
import { ProductImageUploader } from "./ProductImageUploader";
import "./admin-extra.css";
type View = "overview" | "products" | "orders" | "settings" | "payments";
const blank: Product = {
  id: "",
  name: "",
  slug: "",
  description: "",
  price_cents: 0,
  image_url: "",
  category: "Arrangements",
  active: true,
  featured: false,
  inventory_count: null,
  sort_order: 99,
};
const money = (c: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    c / 100,
  );
export function Admin({ navigate }: { navigate: (to: string) => void }) {
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(configured);
  const [view, setView] = useState<View>("overview");
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setChecking(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  if (checking)
    return <div className="admin-center">Opening the shop dashboard…</div>;
  if (!configured) return <DemoAdmin navigate={navigate} />;
  if (!session) return <Login navigate={navigate} />;
  return <Dashboard view={view} setView={setView} navigate={navigate} />;
}
function Login({ navigate }: { navigate: (to: string) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage("Signing in…");
    const { error } = await supabase!.auth.signInWithPassword({
      email,
      password,
    });
    setMessage(error?.message || "");
  };
  return (
    <div className="login-page">
      <button className="back-link" onClick={() => navigate("/")}>
        ← Back to shop
      </button>
      <form onSubmit={submit}>
        <p className="script">The Bird’s Nest</p>
        <h1>Shop login</h1>
        <p>For store owners and staff.</p>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        <button type="submit">Sign in</button>
        {message && <p className="form-message">{message}</p>}
      </form>
    </div>
  );
}
function Shell({
  view,
  setView,
  navigate,
  children,
}: {
  view: View;
  setView: (v: View) => void;
  navigate: (to: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="admin-shell">
      <aside>
        <div className="admin-logo">
          <span>BN</span>
          <div>
            <strong>The Bird’s Nest</strong>
            <small>Shop manager</small>
          </div>
        </div>
        <nav>
          {(
            ["overview", "products", "orders", "settings", "payments"] as View[]
          ).map((v) => (
            <button
              className={view === v ? "active" : ""}
              onClick={() => setView(v)}
              key={v}
            >
              {v[0].toUpperCase() + v.slice(1)}
            </button>
          ))}
        </nav>
        <button className="view-store" onClick={() => navigate("/")}>
          View storefront ↗
        </button>
        <button className="sign-out" onClick={() => supabase?.auth.signOut()}>
          Sign out
        </button>
      </aside>
      <section className="admin-content">{children}</section>
    </div>
  );
}
function Dashboard({
  view,
  setView,
  navigate,
}: {
  view: View;
  setView: (v: View) => void;
  navigate: (to: string) => void;
}) {
  return (
    <Shell {...{ view, setView, navigate }}>
      {view === "overview" && <Overview setView={setView} />}{" "}
      {view === "products" && <Products />}
      {view === "orders" && <Orders />}
      {view === "settings" && <Settings />}
      {view === "payments" && <Payments />}
    </Shell>
  );
}
function Overview({ setView }: { setView: (v: View) => void }) {
  const [stats, setStats] = useState({ products: 0, orders: 0, pending: 0 });
  useEffect(() => {
    Promise.all([
      supabase!.from("products").select("id", { count: "exact", head: true }),
      supabase!.from("orders").select("id", { count: "exact", head: true }),
      supabase!
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("status", "new"),
    ]).then(([p, o, n]) =>
      setStats({
        products: p.count || 0,
        orders: o.count || 0,
        pending: n.count || 0,
      }),
    );
  }, []);
  return (
    <>
      <AdminHead
        eyebrow="Today"
        title="Shop overview"
        text="Everything you need to keep the online shop current."
      />
      <div className="stat-grid">
        <Stat label="Products" value={stats.products} />
        <Stat label="Total orders" value={stats.orders} />
        <Stat label="New orders" value={stats.pending} />
      </div>
      <div className="quick-grid">
        <button onClick={() => setView("products")}>
          <b>＋</b>
          <strong>Add a product</strong>
          <span>Add flowers, gifts, prices, and photos.</span>
        </button>
        <button onClick={() => setView("orders")}>
          <b>✓</b>
          <strong>Review orders</strong>
          <span>See customer and fulfillment details.</span>
        </button>
        <button onClick={() => setView("settings")}>
          <b>⚙</b>
          <strong>Store settings</strong>
          <span>Hours, ordering, pickup, and delivery.</span>
        </button>
      </div>
    </>
  );
}
function Stat({ label, value }: { label: string; value: number }) {
  return (
    <article>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}
function AdminHead({
  eyebrow,
  title,
  text,
  action,
}: {
  eyebrow: string;
  title: string;
  text: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="admin-head">
      <div>
        <p>{eyebrow}</p>
        <h1>{title}</h1>
        <span>{text}</span>
      </div>
      {action}
    </header>
  );
}
function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [editing, setEditing] = useState<Product | null>(null);
  const load = () =>
    supabase!
      .from("products")
      .select("*")
      .order("sort_order")
      .then(({ data }) => setProducts((data || []) as Product[]));
  useEffect(() => {
    load();
  }, []);
  const save = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editing) return;
    const slug =
      editing.slug ||
      editing.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
    const row = { ...editing, slug, id: editing.id || undefined };
    const { error } = editing.id
      ? await supabase!.from("products").update(row).eq("id", editing.id)
      : await supabase!.from("products").insert(row);
    if (error) alert(error.message);
    else {
      setEditing(null);
      load();
    }
  };
  return (
    <>
      <AdminHead
        eyebrow="Catalog"
        title="Products"
        text="Manage what customers can see and order."
        action={
          <button
            className="admin-primary"
            onClick={() => setEditing({ ...blank })}
          >
            Add product
          </button>
        }
      />
      <div className="admin-table">
        {products.map((p) => (
          <article key={p.id}>
            <img src={p.image_url} alt="" />
            <div>
              <strong>{p.name}</strong>
              <span>
                {p.category} · {p.active ? "Visible" : "Hidden"}
              </span>
            </div>
            <b>{money(p.price_cents)}</b>
            <button onClick={() => setEditing(p)}>Edit</button>
          </article>
        ))}
      </div>
      {editing && (
        <div className="modal-layer">
          <form className="product-form" onSubmit={save}>
            <button
              type="button"
              className="close"
              onClick={() => setEditing(null)}
            >
              ×
            </button>
            <p>Product</p>
            <h2>{editing.id ? "Edit product" : "Add product"}</h2>
            <div className="field-grid">
              <label>
                Name
                <input
                  value={editing.name}
                  onChange={(e) =>
                    setEditing({ ...editing, name: e.target.value })
                  }
                  required
                />
              </label>
              <label>
                Category
                <input
                  value={editing.category}
                  onChange={(e) =>
                    setEditing({ ...editing, category: e.target.value })
                  }
                  required
                />
              </label>
              <label>
                Price ($)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editing.price_cents / 100}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      price_cents: Math.round(Number(e.target.value) * 100),
                    })
                  }
                  required
                />
              </label>
              <label>
                Inventory (blank for unlimited)
                <input
                  type="number"
                  min="0"
                  value={editing.inventory_count ?? ""}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      inventory_count:
                        e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                />
              </label>
            </div>
            <label>
              Description
              <textarea
                rows={4}
                value={editing.description}
                onChange={(e) =>
                  setEditing({ ...editing, description: e.target.value })
                }
              />
            </label>
            <ProductImageUploader
              value={editing.image_url}
              onChange={(image_url) => setEditing({ ...editing, image_url })}
            />
            <div className="checks">
              <label>
                <input
                  type="checkbox"
                  checked={editing.active}
                  onChange={(e) =>
                    setEditing({ ...editing, active: e.target.checked })
                  }
                />
                Visible in shop
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={editing.featured}
                  onChange={(e) =>
                    setEditing({ ...editing, featured: e.target.checked })
                  }
                />
                Shop favorite
              </label>
            </div>
            <button className="admin-primary" type="submit">
              Save product
            </button>
          </form>
        </div>
      )}
    </>
  );
}
function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const load = () =>
    supabase!
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => setOrders((data || []) as Order[]));
  useEffect(() => {
    load();
  }, []);
  const status = async (id: string, value: string) => {
    await supabase!.from("orders").update({ status: value }).eq("id", id);
    load();
  };
  return (
    <>
      <AdminHead
        eyebrow="Sales"
        title="Orders"
        text="Customer, payment, pickup, and delivery details."
      />
      <div className="orders-list">
        {orders.length === 0 ? (
          <div className="empty-state">
            <h2>No orders yet</h2>
            <p>New online orders will appear here.</p>
          </div>
        ) : (
          orders.map((o) => (
            <article key={o.id}>
              <div>
                <b>#{o.order_number}</b>
                <span>{new Date(o.created_at).toLocaleString()}</span>
              </div>
              <div>
                <strong>{o.customer_name}</strong>
                <span>
                  {o.customer_phone} · {o.fulfillment_type}
                </span>
              </div>
              <b>{money(o.total_cents)}</b>
              <select
                value={o.status}
                onChange={(e) => status(o.id, e.target.value)}
              >
                <option value="new">New</option>
                <option value="confirmed">Confirmed</option>
                <option value="ready">Ready</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </article>
          ))
        )}
      </div>
    </>
  );
}
function Settings() {
  const [settings, setSettings] = useState<StoreSettings>(demoSettings);
  const [saved, setSaved] = useState("");
  useEffect(() => {
    supabase!
      .from("store_settings")
      .select("*")
      .limit(1)
      .single()
      .then(({ data }) => data && setSettings(data as StoreSettings));
  }, []);
  const save = async (e: FormEvent) => {
    e.preventDefault();
    const { error } = await supabase!
      .from("store_settings")
      .upsert({ ...settings, id: "00000000-0000-0000-0000-000000000001" });
    setSaved(error?.message || "Settings saved");
  };
  return (
    <>
      <AdminHead
        eyebrow="Store"
        title="Settings"
        text="Control the information and order options customers see."
      />
      <form className="settings-form" onSubmit={save}>
        <label>
          Store name
          <input
            value={settings.store_name}
            onChange={(e) =>
              setSettings({ ...settings, store_name: e.target.value })
            }
          />
        </label>
        <div className="field-grid">
          <label>
            Phone
            <input
              value={settings.phone}
              onChange={(e) =>
                setSettings({ ...settings, phone: e.target.value })
              }
            />
          </label>
          <label>
            Email
            <input
              type="email"
              value={settings.email}
              onChange={(e) =>
                setSettings({ ...settings, email: e.target.value })
              }
            />
          </label>
        </div>
        <label>
          Address
          <input
            value={settings.address}
            onChange={(e) =>
              setSettings({ ...settings, address: e.target.value })
            }
          />
        </label>
        <label>
          Business hours
          <input
            value={settings.hours}
            onChange={(e) =>
              setSettings({ ...settings, hours: e.target.value })
            }
          />
        </label>
        <label>
          Announcement
          <input
            value={settings.announcement}
            onChange={(e) =>
              setSettings({ ...settings, announcement: e.target.value })
            }
          />
        </label>
        <div className="checks">
          <label>
            <input
              type="checkbox"
              checked={settings.accepting_orders}
              onChange={(e) =>
                setSettings({ ...settings, accepting_orders: e.target.checked })
              }
            />
            Accept online orders
          </label>
          <label>
            <input
              type="checkbox"
              checked={settings.pickup_enabled}
              onChange={(e) =>
                setSettings({ ...settings, pickup_enabled: e.target.checked })
              }
            />
            Offer pickup
          </label>
          <label>
            <input
              type="checkbox"
              checked={settings.delivery_enabled}
              onChange={(e) =>
                setSettings({ ...settings, delivery_enabled: e.target.checked })
              }
            />
            Offer delivery
          </label>
        </div>
        <button className="admin-primary" type="submit">
          Save settings
        </button>
        {saved && <span>{saved}</span>}
      </form>
    </>
  );
}
function Payments() {
  return (
    <>
      <AdminHead
        eyebrow="Checkout"
        title="Payments"
        text="Connect payments after the shop chooses Square or Stripe."
      />
      <div className="payment-card">
        <span className="not-connected">Not connected</span>
        <h2>Choose a payment provider</h2>
        <p>
          No card or bank information is stored in this application. The
          selected provider will securely handle checkout, card details,
          deposits, refunds, and payout settings.
        </p>
        <div>
          <article>
            <b>Square</b>
            <span>Best when the store already uses Square POS.</span>
            <button disabled>Connect after selection</button>
          </article>
          <article>
            <b>Stripe</b>
            <span>Best for a fully custom online checkout.</span>
            <button disabled>Connect after selection</button>
          </article>
        </div>
      </div>
    </>
  );
}
function DemoAdmin({ navigate }: { navigate: (to: string) => void }) {
  const [view, setView] = useState<View>("overview");
  return (
    <Shell {...{ view, setView, navigate }}>
      <div className="preview-note">
        Preview mode: connect the Bird’s Nest Supabase project to save changes.
      </div>
      {view === "overview" && (
        <>
          <AdminHead
            eyebrow="Today"
            title="Shop overview"
            text="A familiar, simpler store manager."
          />
          <div className="stat-grid">
            <Stat label="Products" value={demoProducts.length} />
            <Stat label="Total orders" value={0} />
            <Stat label="New orders" value={0} />
          </div>
        </>
      )}
      {view === "products" && (
        <>
          <AdminHead
            eyebrow="Catalog"
            title="Products"
            text="Add flowers, gifts, prices, photos, and availability."
          />
          <div className="admin-table">
            {demoProducts.map((p) => (
              <article key={p.id}>
                <img src={p.image_url} />
                <div>
                  <strong>{p.name}</strong>
                  <span>{p.category} · Visible</span>
                </div>
                <b>{money(p.price_cents)}</b>
                <button disabled>Edit</button>
              </article>
            ))}
          </div>
        </>
      )}
      {view === "orders" && (
        <>
          <AdminHead
            eyebrow="Sales"
            title="Orders"
            text="Online orders will appear here."
          />
          <div className="empty-state">
            <h2>No orders yet</h2>
          </div>
        </>
      )}
      {view === "settings" && (
        <>
          <AdminHead
            eyebrow="Store"
            title="Settings"
            text="Hours, ordering, pickup, delivery, and shop details."
          />
          <div className="payment-card">
            <p>{demoSettings.store_name}</p>
            <p>{demoSettings.phone}</p>
            <p>{demoSettings.hours}</p>
          </div>
        </>
      )}
      {view === "payments" && <Payments />}
    </Shell>
  );
}
