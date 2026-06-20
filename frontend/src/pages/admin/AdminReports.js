import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, formatApiError } from "../../lib/api";
import { Card, PageLoader, EmptyState, SectionHeader, StatusBadge } from "../../components/ui";
import { toast } from "../../components/Toast";

export default function AdminReports() {
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState([]);

  useEffect(() => {
    api.get("/admin/reports/all")
      .then(({ data }) => setReports(data.reports || []))
      .catch((err) => toast.error(formatApiError(err.response?.data?.detail) || "Could not load reports."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageLoader />;

  return (
    <div data-testid="admin-reports-page">
      <SectionHeader eyebrow="Oversight" title="Reports" />
      {reports.length === 0 ? (
        <EmptyState title="No reports" subtitle="Nothing has been reported yet." />
      ) : (
        <div className="space-y-3 mt-6">
          {reports.map((r) => (
            <Link key={r.id} to={`/admin/reports/${r.id}`}>
              <Card hover className="p-4 flex items-center justify-between gap-3" data-testid={`admin-report-${r.id}`}>
                <div className="min-w-0">
                  <p className="font-semibold text-ink truncate">{r.report_type || r.reason_category || "Report"}</p>
                  <p className="text-sm text-mute truncate">{r.reason || r.description || "—"}</p>
                </div>
                <StatusBadge status={r.report_status} />
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
