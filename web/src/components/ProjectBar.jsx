import { useEffect, useState } from "react";
import { useAuth } from "../auth";
import { api } from "../api";
import * as L from "../lib/loads";

const currentInput = (s) => ({
  units: s.units, type: s.type, height: s.height, levels: s.levels,
  overhang: s.overhang, span: s.span, force: s.force, factored: s.factored, capacity: s.cap,
});

export default function ProjectBar({ data, state, project, onSaved, onExit }) {
  const { user, requireAuth } = useAuth();
  const [panel, setPanel] = useState(null); // null | 'create' | 'saveas'
  const [flash, setFlash] = useState("");

  const openCreate = () => setPanel("create");
  const startAsGuest = () => requireAuth("register").then(openCreate).catch(() => {});

  if (!user) {
    return (
      <div className="project-root">
        <div className="proj-actions">
          <button className="btn primary small" onClick={startAsGuest}>Save as project</button>
          <span className="hint">Log in to save this design, tag it, add custom properties, and ask Walltopia about it.</span>
        </div>
      </div>
    );
  }

  if (panel) {
    return (
      <div className="project-root">
        <SavePanel data={data} state={state} project={project} asNew={panel === "saveas"}
          onCancel={() => setPanel(null)}
          onDone={(p, msg) => { setPanel(null); setFlash(msg); onSaved(p); setTimeout(() => setFlash(""), 3500); }} />
      </div>
    );
  }

  return (
    <div className="project-root">
      <div className="proj-actions">
        {project ? (
          <>
            <button className="btn small" onClick={onExit} title="Leave editing — keep these numbers as a new, unsaved design">&larr; Exit editing</button>
            <span className="editing-flag">Editing · {project.name}</span>
            <button className="btn primary small" onClick={async () => {
              try {
                const { project: p } = await api.updateProject(project.id, {
                  name: project.name, tags: project.tags, properties: project.properties,
                  input: currentInput(state), snapshot: L.snapshot(data, state),
                });
                onSaved(p); setFlash("Project updated."); setTimeout(() => setFlash(""), 3500);
              } catch (e) { setFlash(e.message); setTimeout(() => setFlash(""), 4000); }
            }}>Save changes</button>
            <button className="btn small" onClick={() => setPanel("saveas")}>Save as new</button>
          </>
        ) : (
          <>
            <button className="btn primary small" onClick={openCreate}>Save as project</button>
            <span className="hint">Save this design with tags &amp; custom properties.</span>
          </>
        )}
        {flash && <span className="save-msg ok">{flash}</span>}
      </div>
      {project && <QuestionPanel projectId={project.id} />}
    </div>
  );
}

function SavePanel({ data, state, project, asNew, onCancel, onDone }) {
  const editing = project && !asNew;
  const [name, setName] = useState(editing ? project.name : L.titleFor(state) + (state.type === "wall" ? " · " + state.levels + "-level" : ""));
  const [tags, setTags] = useState(editing ? (project.tags || []).join(", ") : "");
  const [props, setProps] = useState(editing && project.properties?.length ? project.properties : [{ key: "", value: "" }]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const setProp = (i, k, v) => setProps((p) => p.map((row, j) => (j === i ? { ...row, [k]: v } : row)));
  const addProp = () => setProps((p) => [...p, { key: "", value: "" }]);
  const rmProp = (i) => setProps((p) => p.filter((_, j) => j !== i));

  async function save() {
    if (!name.trim()) { setErr("Please enter a project name."); return; }
    setBusy(true); setErr("");
    const payload = {
      name: name.trim(),
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      properties: props.filter((p) => p.key.trim()).map((p) => ({ key: p.key.trim(), value: p.value.trim() })),
      input: currentInput(state),
      snapshot: L.snapshot(data, state),
    };
    try {
      const res = editing ? await api.updateProject(project.id, payload) : await api.createProject(payload);
      onDone(res.project, editing ? "Project updated." : "Project saved.");
    } catch (e) { setErr(e.message || "Could not save."); setBusy(false); }
  }

  return (
    <div className="save-panel">
      <h3>{asNew ? "Save as new project" : editing ? "Update project" : "Save project"}</h3>
      <div className="row"><label className="lbl">Project name</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} /></div>
      <div className="row"><label className="lbl">Tags <span className="hint" style={{ fontWeight: 400 }}>(comma separated)</span></label>
        <input type="text" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="gym, EU, seismic zone 2" /></div>
      <div className="row"><label className="lbl">Custom properties</label>
        <div className="prop-rows">
          {props.map((p, i) => (
            <div className="prop-row" key={i}>
              <input placeholder="Property" value={p.key} onChange={(e) => setProp(i, "key", e.target.value)} />
              <input placeholder="Value" value={p.value} onChange={(e) => setProp(i, "value", e.target.value)} />
              <button type="button" title="Remove" onClick={() => rmProp(i)}>&times;</button>
            </div>
          ))}
        </div>
        <button className="btn small" type="button" style={{ marginTop: 8 }} onClick={addProp}>+ Add property</button>
      </div>
      <div className="buttons">
        <button className="btn primary" onClick={save} disabled={busy}>{busy ? "Saving…" : asNew ? "Create copy" : editing ? "Save changes" : "Save project"}</button>
        <button className="btn" onClick={onCancel}>Cancel</button>
      </div>
      {err && <div className="save-msg bad">{err}</div>}
    </div>
  );
}

function QuestionPanel({ projectId }) {
  const [text, setText] = useState("");
  const [list, setList] = useState([]);
  const [msg, setMsg] = useState({ cls: "", text: "" });
  const [busy, setBusy] = useState(false);

  const load = () => api.listQuestions(projectId).then((r) => setList(r.questions || [])).catch(() => {});
  useEffect(() => { load(); }, [projectId]); // eslint-disable-line

  async function send() {
    if (text.trim().length < 5) { setMsg({ cls: "bad", text: "Please write your question." }); return; }
    setBusy(true); setMsg({ cls: "", text: "" });
    try {
      await api.askQuestion(projectId, text.trim());
      setText(""); setMsg({ cls: "ok", text: "Sent to Walltopia." }); load();
    } catch (e) { setMsg({ cls: "bad", text: e.message || "Could not send." }); }
    setBusy(false);
  }

  return (
    <div className="qa-panel">
      <h3>Ask Walltopia about this project</h3>
      <textarea value={text} onChange={(e) => setText(e.target.value)}
        placeholder="e.g. Is this scheme valid for a 6 m column raster in seismic zone 2? Any note on the end-column biaxial case?" />
      <div style={{ marginTop: 10 }}>
        <button className="btn primary small" onClick={send} disabled={busy}>Send question</button>
        {msg.text && <span className={"save-msg " + msg.cls} style={{ marginLeft: 10 }}>{msg.text}</span>}
      </div>
      <div className="qa-list">
        {list.map((q) => (
          <div className="qa-item" key={q.id}>{q.message}<time>{new Date(q.createdAt).toLocaleString()} · {q.status}</time></div>
        ))}
      </div>
    </div>
  );
}
