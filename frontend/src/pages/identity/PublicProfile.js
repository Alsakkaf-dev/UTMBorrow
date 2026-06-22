import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, CheckCircle, Flag, MapPin } from "@phosphor-icons/react";
import { api } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { PageLoader, StarRating, Avatar } from "../../components/ui";
import ReportModal from "../../components/ReportModal";

const REPORT_CATEGORIES = [
    ["False_Scam", "Scam / fraud"],
    ["Damaged_Dangerous", "Returned damaged / unsafe"],
    ["Inappropriate_Offensive", "Harassment / offensive"],
    ["Prohibited_Illegal", "Prohibited / illegal conduct"],
    ["Other", "Other"],
];

export default function PublicProfile() {
    const { userId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [profile, setProfile] = useState(null);
    const [reportOpen, setReportOpen] = useState(false);

    useEffect(() => {
        api.get(`/profile/${userId}`).then(({ data }) => setProfile(data));
    }, [userId]);

    const submitUserReport = async (payload) => {
        const { data } = await api.post("/reports/user", { reported_user_id: userId, ...payload });
        return data.report;
    };

    if (!profile) return <PageLoader />;
    const u = profile.user;
    const isSelf = user && user.id === u.id;

    return (
        <div>
            <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-muted text-sm mb-4 font-medium hover:text-ink transition-colors" data-testid="back-btn"><ArrowLeft size={16} weight="bold" /> Back</button>

            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="bg-surface border border-line rounded-4xl p-6 text-center shadow-card" data-testid="public-profile-card">
                <div className="mx-auto w-fit"><Avatar name={u.full_name} src={u.profile_picture} size={84} /></div>
                <h1 className="font-head font-extrabold text-2xl mt-4">{u.full_name}</h1>
                {u.campus && (
                    <div className="flex justify-center mt-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-brand-50 text-brand-700 text-[11px] font-bold border border-brand-100" data-testid="public-profile-campus">
              <MapPin size={11} weight="fill" /> {u.campus}
            </span>
                    </div>
                )}
                {u.bio && (
                    <p className="text-sm text-ink/80 mt-3 leading-relaxed max-w-sm mx-auto" data-testid="public-profile-bio">{u.bio}</p>
                )}
                <div className="flex items-center justify-center gap-2 mt-3">
                    <StarRating value={u.trust_score} size={18} />
                    <span className="font-bold">{Number(u.trust_score).toFixed(2)}</span>
                </div>
                <p className="text-sm text-muted mt-2 inline-flex items-center gap-1.5"><CheckCircle size={15} weight="fill" className="text-emerald-500" /> {profile.completed_transactions} completed exchanges</p>
            </motion.div>

            {!isSelf && (
                <button onClick={() => setReportOpen(true)} className="w-full text-sm font-medium text-muted hover:text-status-cancelled flex items-center justify-center gap-1.5 py-3 mt-3 transition-colors" data-testid="report-user-btn">
                    <Flag size={15} /> Report this user
                </button>
            )}

            <h3 className="font-head font-bold text-lg mt-4 mb-3">Ratings ({profile.rating_count})</h3>
            {profile.rating_history.length === 0 ? (
                <p className="text-sm text-muted">No ratings yet.</p>
            ) : (
                <div className="space-y-3">
                    {profile.rating_history.map((r, i) => (
                        <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="border border-line rounded-3xl p-4 bg-surface shadow-card" data-testid={`pub-rating-${i}`}>
                            <div className="flex items-center justify-between">
                                <span className="font-semibold text-ink text-sm">{r.rater_name}</span>
                                <StarRating value={r.stars} size={14} />
                            </div>
                            {r.feedback && <p className="text-sm text-muted mt-2 leading-relaxed">{r.feedback}</p>}
                        </motion.div>
                    ))}
                </div>
            )}

            <ReportModal
                open={reportOpen}
                onClose={() => setReportOpen(false)}
                title="Report user"
                subjectName={u.full_name}
                categories={REPORT_CATEGORIES}
                submit={submitUserReport}
                onViewStatus={() => navigate("/settings/reports")}
                returnLabel="Return to Profile"
            />
        </div>
    );
}