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

 
  
}
