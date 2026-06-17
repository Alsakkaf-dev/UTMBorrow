import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle, ImageSquare, X, CheckSquare, Square } from "@phosphor-icons/react";
import { formatApiError } from "../lib/api";
import { Button, Modal, Select, Textarea } from "./ui";

/* Non-compliance / report form shared by user reports (PublicProfile) and item
   reports (ItemDetail). Implements SDD Fig 3.2.3.4 & 3.2.3.5 / SRS UC1203 ·
   UC3301: report category, incident time, up to 3 evidence images, a
   truthfulness confirmation that gates submit, then a confirmation screen that
   surfaces the report id and a link to submission status. */

// When the incident occurred — mirrors backend INCIDENT_WHEN.
const INCIDENT_OPTIONS = [
  "Before handover",
  "During handover",
  "During the loan",
  "At/After return",
  "Other",
];

const MAX_EVIDENCE = 3;
const MAX_EVIDENCE_BYTES = 3.5 * 1024 * 1024;

export default function ReportModal({
  open,
  onClose,
  title = "Submit report",
  subjectName,
  intro,
  categories,
  submit,           // async (payload) => report   (must return the created report, with id)
  onViewStatus,     // () => void   navigate to submission-status screen
  returnLabel = "Return",
}) {
  const [reportCategory, setReportCategory] = useState("");
  const [incidentWhen, setIncidentWhen] = useState("");
  const [description, setDescription] = useState("");
  const [evidence, setEvidence] = useState([]);
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [modalErr, setModalErr] = useState("");
  const [done, setDone] = useState(false);
  const [reportId, setReportId] = useState("");

  // Reset every time the modal is (re)opened.
  useEffect(() => {
    if (open) {
      setReportCategory("");
      setIncidentWhen("");
      setDescription("");
      setEvidence([]);
      setConfirmed(false);
      setModalErr("");
      setDone(false);
      setReportId("");
    }
  }, [open]);

  const onEvidence = (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = ""; // allow re-selecting the same file
    if (!files.length) return;
    setModalErr("");
    const slots = MAX_EVIDENCE - evidence.length;
    if (files.length > slots) setModalErr(`You can attach up to ${MAX_EVIDENCE} images.`);
    files.slice(0, Math.max(slots, 0)).forEach((f) => {
      if (!["image/jpeg", "image/png"].includes(f.type)) {
        setModalErr("Only JPEG or PNG images are allowed.");
        return;
      }
      if (f.size > MAX_EVIDENCE_BYTES) {
        setModalErr("Each image must be under 3.5MB.");
        return;
      }
      const reader = new FileReader();
      reader.onload = () =>
        setEvidence((prev) => (prev.length >= MAX_EVIDENCE ? prev : [...prev, reader.result]));
      reader.readAsDataURL(f);
    });
  };

  const removeEvidence = (idx) => setEvidence((prev) => prev.filter((_, i) => i !== idx));

  const handleSubmit = async () => {
    if (!reportCategory || !confirmed) return;
    setSubmitting(true);
    setModalErr("");
    try {
      const report = await submit({
        report_category: reportCategory,
        description: description.trim() || null,
        incident_when: incidentWhen || null,
        evidence,
        confirmed_truthful: true,
      });
      setReportId(report?.id || "");
      setDone(true);
    } catch (e) {
      setModalErr(formatApiError(e.response?.data?.detail) || e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const shortId = reportId ? `#RP-${reportId.slice(0, 8).toUpperCase()}` : "#RP-—";
   
   return (
    <Modal open={open} onClose={onClose} title={done ? "" : title} testid="report-modal">
      {done ? (
        <div className="text-center py-4" data-testid="report-success">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 320, damping: 18 }}
            className="w-14 h-14 rounded-2xl bg-status-borrowed text-white flex items-center justify-center mx-auto mb-3"
          >
            <CheckCircle size={30} weight="fill" />
          </motion.div>
          <p className="text-ink font-head font-semibold text-lg">Report submitted</p>
          <p className="text-sm text-muted mt-1">Moderators will review this shortly.</p>
          <p className="mt-3 inline-flex items-center px-3 py-1.5 rounded-full bg-canvas border border-line text-sm font-mono font-bold text-ink" data-testid="report-id">
            {shortId}
          </p>
          <div className="flex gap-2.5 mt-5">
            <Button variant="secondary" className="flex-1" onClick={onClose} data-testid="report-return">
              {returnLabel}
            </Button>
            <Button
              className="flex-1"
              onClick={() => { onClose?.(); onViewStatus?.(); }}
              data-testid="report-view-status"
            >
              View Submission Status
            </Button>
          </div>
        </div>
      ) : (
        <>
          {modalErr && (
            <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-2xl px-3.5 py-2.5 mb-3">
              {modalErr}
            </div>
          )}
          {intro ? (
            <p className="text-sm text-muted mb-3">{intro}</p>
          ) : subjectName ? (
            <p className="text-sm text-muted mb-3">
              Report <b className="text-ink">{subjectName}</b> for a serious trust violation. Misuse may affect your own standing.
            </p>
          ) : null}

          <Select
            label="Reason"
            value={reportCategory}
            onChange={(e) => setReportCategory(e.target.value)}
            data-testid="report-category"
          >
            <option value="">Select a reason</option>
            {categories.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>

          <div className="mt-3">
            <Select
              label="When did this incident occur?"
              value={incidentWhen}
              onChange={(e) => setIncidentWhen(e.target.value)}
              data-testid="report-incident-when"
            >
              <option value="">Select a time (optional)</option>
              {INCIDENT_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </Select>
          </div>

          <div className="mt-3">
            <Textarea
              label="Details (optional)"
              rows={3}
              placeholder="Describe what happened"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              data-testid="report-description"
            />
          </div>

          {/* Evidence uploader — up to 3 images */}
          <div className="mt-3">
            <span className="label-eyebrow block mb-1.5">Evidence (optional · up to {MAX_EVIDENCE})</span>
            <div className="flex flex-wrap gap-2.5">
              {evidence.map((src, i) => (
                <div key={i} className="relative w-20 h-20 rounded-2xl overflow-hidden border border-line" data-testid={`report-evidence-${i}`}>
                  <img src={src} alt={`Evidence ${i + 1}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeEvidence(i)}
                    aria-label="Remove evidence"
                    data-testid={`report-evidence-remove-${i}`}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-ink/60 text-white flex items-center justify-center"
                  >
                    <X size={12} weight="bold" />
                  </button>
                </div>
              ))}
              {evidence.length < MAX_EVIDENCE && (
                <label
                  className="w-20 h-20 rounded-2xl border-2 border-dashed border-brand-200 bg-brand-50/40 flex flex-col items-center justify-center cursor-pointer hover:bg-brand-50 transition-colors"
                  data-testid="report-evidence-upload"
                >
                  <ImageSquare size={22} className="text-brand-400" />
                  <span className="text-[10px] font-semibold text-brand-500 mt-0.5">Add</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    multiple
                    className="hidden"
                    onChange={onEvidence}
                    data-testid="report-evidence-input"
                  />
                </label>
              )}
            </div>
          </div>

          {/* Truthfulness confirmation — gates the submit button */}
          <button
            type="button"
            onClick={() => setConfirmed((c) => !c)}
            data-testid="report-confirm-truthful"
            className="mt-4 w-full flex items-start gap-2.5 text-left"
          >
            <span className={`shrink-0 mt-0.5 ${confirmed ? "text-brand-600" : "text-slate-400"}`}>
              {confirmed ? <CheckSquare size={20} weight="fill" /> : <Square size={20} />}
            </span>
            <span className="text-sm text-ink leading-snug">
              I confirm this report is truthful and accurate.
            </span>
          </button>

          <Button
            className="w-full mt-5"
            loading={submitting}
            onClick={handleSubmit}
            disabled={submitting || !reportCategory || !confirmed}
            data-testid="report-submit"
          >
            Submit report
          </Button>
        </>
      )}
    </Modal>
  );
 
  
}
