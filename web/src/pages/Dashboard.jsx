import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth";
import { api } from "../api";

export default function Dashboard() {
  const { user, ready, openAuth } = useAuth();
  const [projects, setProjects] = useState([]);
  const [tags, setTags] = useState([]);
  const [filters, setFilters] = useState({ q: "", tag: "", sort: "updated" });
  const [loading, setLoading] = useState(true);
  const debounce = useRef();

  async function load(f = filters) {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    try {
      const [t, p] = await Promise.all([api.listTags(), api.listProjects(f)]);
      setTags(t.tags || []); setProjects(p.projects || []);
    } catch (e) { setProjects([]); }
    setLoading(false);
  }

  useEffect(() => { if (ready) load(); }, [user, ready]); // eslint-disable-line

  const setQ = (q) => {
    setFilters((f) => ({ ...f, q }));
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => load({ ...filters, q }), 300);
  };
  const setTag = (tag) => { const f = { ...filters, tag }; setFilters(f); load(f); };
  const setSort = (sort) => { const f = { ...filters, sort }; setFilters(f); load(f); };

  async function del(p) {
    if (!confirm(`Delete "${p.name}"? This also removes its questions and cannot be undone.`)) return;
    try { await api.deleteProject(p.id); load(); } catch (e) { alert(e.message); }
  }

  if (ready && !user) {
    return (
      <main className="dash">
        <div className="dash-guest">
          <h2>Log in to see your projects</h2>
          <p>Save any calculation as a project, organise it with tags and custom properties, reopen it to tweak the numbers, and send questions to Walltopia about a design.</p>
          <button className="btn primary" onClick={() => openAuth("register")}>Log in or register</button>
        </div>
      </main>
    );
  }

  return (
    <main className="dash">
      <div className="dash-head">
        <div>
          <h1>My Projects</h1>
          <p>{loading ? "Loading…" : projects.length ? projects.length + (projects.length === 1 ? " project" : " projects") : "No projects yet"}</p>
        </div>
        <Link className="btn primary" to="/">+ New calculation</Link>
      </div>

      <div className="dash-toolbar">
        <input type="search" placeholder="Search name, tags, properties…" value={filters.q} onChange={(e) => setQ(e.target.value)} />
        <span className="lbl">Tag</span>
        <select value={filters.tag} onChange={(e) => setTag(e.target.value)}>
          <option value="">All</option>
          {tags.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <span className="lbl">Sort</span>
        <select value={filters.sort} onChange={(e) => setSort(e.target.value)}>
          <option value="updated">Recently updated</option>
          <option value="created">Newest</option>
          <option value="name">Name A–Z</option>
        </select>
      </div>

      {!loading && projects.length === 0 ? (
        <div className="dash-empty">
          {filters.q || filters.tag ? "No projects match these filters. " : "You haven't saved any projects yet. "}
          <Link to="/">Open the calculator</Link> and save a design.
        </div>
      ) : (
        <div className="proj-grid">
          {projects.map((p) => <Card key={p.id} p={p} onDelete={() => del(p)} onTag={setTag} />)}
        </div>
      )}
    </main>
  );
}

function Card({ p, onDelete, onTag }) {
  const snap = p.snapshot || {};
  const when = p.updatedAt ? new Date(p.updatedAt).toLocaleDateString() : "";
  return (
    <div className="proj-card">
      <h3>{p.name}</h3>
      <div className="meta">{snap.title || ""}{when ? " · updated " + when : ""}</div>
      {typeof snap.governing === "number" && (
        <div className="snap">Governing column load <b>{snap.governing} {snap.unit || ""}</b>
          {snap.verdict && snap.verdict !== "neutral" ? " · " + (snap.verdict === "ok" ? "applicable" : "exceeds capacity") : ""}</div>
      )}
      {(p.tags || []).length > 0 && (
        <div className="tags">{p.tags.map((t) => <span className="tag-chip" key={t} onClick={() => onTag(t)}>{t}</span>)}</div>
      )}
      {(p.properties || []).length > 0 && (
        <div className="tags">{p.properties.slice(0, 4).map((pr, i) => (
          <span className="tag-chip prop" key={i}>{pr.key}{pr.value ? ": " + pr.value : ""}</span>
        ))}</div>
      )}
      <div className="card-actions">
        <Link className="btn small primary" to={"/?project=" + p.id}>Open &amp; edit</Link>
        <button className="btn small" onClick={onDelete}>Delete</button>
      </div>
    </div>
  );
}
