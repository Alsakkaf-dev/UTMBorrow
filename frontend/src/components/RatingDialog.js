import React, { useState } from "react";
import { Modal, Button, Textarea, StarRating } from "./ui";
import { toast } from "./Toast";
import { api, formatApiError } from "../lib/api";

export default function RatingDialog({ open, onClose, transactionId, counterpartyName, onRated }) {
    const [stars, setStars] = useState(5);
    const [feedback, setFeedback] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const submit = async () => {
        setLoading(true); setError("");
        try {
            await api.post("/ratings", { transaction_id: transactionId, stars, feedback });
            toast.success("Thanks for your rating!");
            onRated && onRated();
            onClose();
        } catch (err) {
            setError(formatApiError(err.response?.data?.detail) || err.message);
        } finally { setLoading(false); }
    };

    return (
        <Modal open={open} onClose={onClose} title="Rate this exchange" testid="rating-dialog">
            <p className="text-sm text-muted mb-2">How was your experience with <b className="text-ink">{counterpartyName}</b>?</p>
            {error && <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-2xl px-3.5 py-2.5 mb-4">{error}</div>}
            <div className="flex justify-center py-4">
                <StarRating value={stars} onChange={setStars} editable size={40} />
            </div>
            <Textarea label="Feedback (optional)" rows={3} placeholder="Share a few words..." value={feedback} onChange={(e) => setFeedback(e.target.value)} data-testid="rating-feedback" />
            <div className="flex gap-3 mt-5">
                <Button variant="secondary" className="flex-1" onClick={onClose} data-testid="rating-skip">Skip</Button>
                <Button className="flex-1" loading={loading} onClick={submit} disabled={loading} data-testid="rating-submit">
                    Submit rating
                </Button>
            </div>
        </Modal>
    );
}