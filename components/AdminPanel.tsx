"use client";

import { useState, useEffect, useCallback } from "react";
import * as XLSX from "xlsx";
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Guest, RsvpEntry } from "@/types/rsvp";

type FirestoreTimestamp = { toDate(): Date };

function formatDate(ts: unknown): string {
  if (!ts) return "—";
  const d = (ts as FirestoreTimestamp).toDate
    ? (ts as FirestoreTimestamp).toDate()
    : new Date(ts as string);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) +
    " " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export default function AdminPanel() {
  const [entries, setEntries]       = useState<RsvpEntry[]>([]);
  const [loading, setLoading]       = useState(true);
  const [fetchError, setFetchError] = useState("");

  // modal
  const [modal, setModal]           = useState<"add" | "edit" | null>(null);
  const [editTarget, setEditTarget] = useState<RsvpEntry | null>(null);

  // delete confirm
  const [deleteTarget, setDeleteTarget] = useState<RsvpEntry | null>(null);
  const [deleting, setDeleting]         = useState(false);

  // form
  const [firstName, setFirstName]   = useState("");
  const [lastName, setLastName]     = useState("");
  const [attending, setAttending]   = useState<"yes" | "no" | null>(null);
  const [guests, setGuests]         = useState<Guest[]>([]);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState("");

  useEffect(() => {
    return onSnapshot(
      collection(db, "rsvps"),
      (snap) => {
        const rows = snap.docs.map(d => ({
          ...(d.data() as Omit<RsvpEntry, "docId">),
          docId: d.id,
        }));
        // sort newest first client-side to avoid needing a Firestore index
        rows.sort((a, b) => {
          const ta = (a as any).submittedAt?.toMillis?.() ?? 0;
          const tb = (b as any).submittedAt?.toMillis?.() ?? 0;
          return tb - ta;
        });
        setEntries(rows);
        setLoading(false);
      },
      (err) => {
        console.error("Firestore read error:", err);
        setFetchError(err.message);
        setLoading(false);
      }
    );
  }, []);

  // Stats
  const attendingEntries = entries.filter(e => e.attending);
  const totalPeople = attendingEntries.reduce((s, e) => s + 1 + e.guests.length, 0);
  const declined    = entries.filter(e => !e.attending).length;

  // Guest helpers
  const addGuest = useCallback(() => {
    setGuests(prev => [...prev, { id: crypto.randomUUID(), firstName: "", lastName: "" }]);
  }, []);
  const removeGuest = useCallback((id: string) => {
    setGuests(prev => prev.filter(g => g.id !== id));
  }, []);
  const updateGuest = useCallback((id: string, field: "firstName" | "lastName", value: string) => {
    setGuests(prev => prev.map(g => g.id === id ? { ...g, [field]: value } : g));
  }, []);

  function openAdd() {
    setFirstName(""); setLastName(""); setAttending(null); setGuests([]);
    setError(""); setModal("add");
  }
  function openEdit(entry: RsvpEntry) {
    setFirstName(entry.firstName);
    setLastName(entry.lastName);
    setAttending(entry.attending ? "yes" : "no");
    setGuests(entry.guests.map(g => ({ ...g })));
    setEditTarget(entry);
    setError(""); setModal("edit");
  }
  function closeModal() { setModal(null); setEditTarget(null); }

  const canSubmit =
    firstName.trim() !== "" &&
    lastName.trim() !== "" &&
    attending !== null &&
    (attending === "no" || guests.every(g => g.firstName.trim() !== "" && g.lastName.trim() !== ""));

  async function handleSave() {
    if (!canSubmit || saving) return;
    setSaving(true); setError("");
    try {
      const payload = {
        firstName: firstName.trim(),
        lastName:  lastName.trim(),
        attending: attending === "yes",
        guests: attending === "yes"
          ? guests.map(g => ({ id: g.id, firstName: g.firstName.trim(), lastName: g.lastName.trim() }))
          : [],
      };
      if (modal === "add") {
        await addDoc(collection(db, "rsvps"), {
          id: crypto.randomUUID(),
          ...payload,
          submittedAt: serverTimestamp(),
        });
      } else if (modal === "edit" && editTarget) {
        await updateDoc(doc(db, "rsvps", editTarget.docId), payload);
      }
      closeModal();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function handleExport() {
    const rows: { "First Name": string; "Last Name": string }[] = [];
    for (const e of entries) {
      if (!e.attending) continue;
      rows.push({ "First Name": e.firstName, "Last Name": e.lastName });
      for (const g of e.guests) {
        rows.push({ "First Name": g.firstName, "Last Name": g.lastName });
      }
    }
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Guests");
    XLSX.writeFile(wb, `guests-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  async function handleDelete() {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, "rsvps", deleteTarget.docId));
      setDeleteTarget(null);
    } catch {
      // let user retry
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="adm-page">

      {/* ── Header ── */}
      <header className="adm-header">
        <div className="adm-header-left">
          <span className="adm-logo">T &amp; A</span>
          <span className="adm-logo-sub">Admin Panel</span>
        </div>
      </header>

      <div className="adm-body">

        {/* ── Stats ── */}
        <div className="adm-stats">
          <div className="adm-stat">
            <span className="adm-stat-num blue">{entries.length}</span>
            <span className="adm-stat-label">Total Responses</span>
          </div>
          <div className="adm-stat">
            <span className="adm-stat-num teal">{totalPeople}</span>
            <span className="adm-stat-label">Total Attending</span>
          </div>
          <div className="adm-stat">
            <span className="adm-stat-num muted">{declined}</span>
            <span className="adm-stat-label">Declined</span>
          </div>
        </div>

        {/* ── Action bar ── */}
        <div className="adm-bar">
          <h1 className="adm-bar-title">Guest List</h1>
          <div className="adm-bar-actions">
            <button className="adm-export-btn" onClick={handleExport} disabled={entries.length === 0}>Export Excel</button>
            <button className="adm-add-btn" onClick={openAdd}>+ Add RSVP</button>
          </div>
        </div>

        {/* ── Table ── */}
        {loading ? (
          <div className="adm-loading">Loading…</div>
        ) : fetchError ? (
          <div className="adm-empty" style={{ color: "#c0392b", fontStyle: "normal", fontSize: 13 }}>
            Firestore error: {fetchError}
          </div>
        ) : entries.length === 0 ? (
          <div className="adm-empty">No RSVPs yet — add the first one above.</div>
        ) : (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Status</th>
                  <th className="adm-hide-sm adm-guests-col">Guests</th>
                  <th className="adm-hide-sm">Date</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {entries.map(entry => (
                  <tr key={entry.docId}>
                    <td className="adm-name">{entry.firstName} {entry.lastName}</td>
                    <td>
                      <span className={`adm-badge ${entry.attending ? "yes" : "no"}`}>
                        {entry.attending ? "Attending" : "Declined"}
                      </span>
                    </td>
                    <td className="adm-hide-sm adm-guests-col">
                      {!entry.attending || entry.guests.length === 0
                        ? "—"
                        : entry.guests.map(g => `${g.firstName} ${g.lastName}`).join(", ")}
                    </td>
                    <td className="adm-hide-sm adm-date-col">
                      {formatDate((entry as RsvpEntry & { submittedAt: unknown }).submittedAt)}
                    </td>
                    <td>
                      <div className="adm-actions">
                        <button className="adm-edit-btn" onClick={() => openEdit(entry)}>Edit</button>
                        <button className="adm-del-btn"  onClick={() => setDeleteTarget(entry)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {/* ── Add / Edit Modal ── */}
      {modal && (
        <div className="adm-overlay" onClick={closeModal}>
          <div className="adm-modal" onClick={e => e.stopPropagation()}>

            <div className="adm-modal-head">
              <span className="adm-modal-title">
                {modal === "add" ? "Add RSVP" : "Edit RSVP"}
              </span>
              <button className="adm-modal-close" onClick={closeModal}>×</button>
            </div>

            <div className="field-row">
              <div>
                <label className="field-label">First Name</label>
                <input
                  className="field-input"
                  placeholder="First name"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                />
              </div>
              <div>
                <label className="field-label">Last Name</label>
                <input
                  className="field-input"
                  placeholder="Last name"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                />
              </div>
            </div>

            <div className="field">
              <label className="field-label">Will they attend?</label>
              <div className="attend-toggle">
                <button
                  className={`attend-btn yes ${attending === "yes" ? "active" : ""}`}
                  onClick={() => setAttending("yes")}
                >
                  Joyfully Accepts
                </button>
                <button
                  className={`attend-btn no ${attending === "no" ? "active" : ""}`}
                  onClick={() => { setAttending("no"); setGuests([]); }}
                >
                  Regretfully Declines
                </button>
              </div>
            </div>

            {attending === "yes" && (
              <div className="guests-area">
                <div className="guests-top">
                  <span className="guests-heading">Additional Guests</span>
                  <button className="add-guest-btn" onClick={addGuest}>+ Add Guest</button>
                </div>
                {guests.length === 0 && (
                  <p className="guests-empty">No additional guests.</p>
                )}
                {guests.map((g, i) => (
                  <div key={g.id} className="guest-entry">
                    <div>
                      <label className="field-label">Guest {i + 1} · First</label>
                      <input
                        className="field-input"
                        placeholder="First name"
                        value={g.firstName}
                        onChange={e => updateGuest(g.id, "firstName", e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="field-label">Last Name</label>
                      <input
                        className="field-input"
                        placeholder="Last name"
                        value={g.lastName}
                        onChange={e => updateGuest(g.id, "lastName", e.target.value)}
                      />
                    </div>
                    <button className="remove-guest" onClick={() => removeGuest(g.id)}>×</button>
                  </div>
                ))}
              </div>
            )}

            {error && <p className="form-error">{error}</p>}

            <button
              className="submit-btn"
              onClick={handleSave}
              disabled={!canSubmit || saving}
            >
              {saving ? "Saving…" : modal === "add" ? "Add Guest" : "Save Changes"}
            </button>

          </div>
        </div>
      )}

      {/* ── Delete Confirm ── */}
      {deleteTarget && (
        <div className="adm-overlay" onClick={() => !deleting && setDeleteTarget(null)}>
          <div className="adm-confirm" onClick={e => e.stopPropagation()}>
            <p className="adm-confirm-title">Delete RSVP?</p>
            <p className="adm-confirm-body">
              This will permanently remove the response from{" "}
              <strong>{deleteTarget.firstName} {deleteTarget.lastName}</strong>.
              This action cannot be undone.
            </p>
            <div className="adm-confirm-btns">
              <button
                className="adm-cancel-btn"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                className="adm-delete-btn"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
