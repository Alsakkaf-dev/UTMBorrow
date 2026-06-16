# UTM Borrow

A campus-wide **circular resource-sharing platform** for the Universiti Teknologi Malaysia (UTM)
community. Verified students lend and borrow academic resources — laboratory tools, engineering
equipment, textbooks and event clothing — instead of buying expensive single-use items.

> Built for **SCSE2243 Application Development I — Section 01, Semester II 2025/2026**
> Group **Alpha** · Prepared for **Dr. Mohd Yazid Bin Idris**

> **Current build status.** Only the shared **foundation** has been pushed to `main` so far
> (core backend modules + the frontend UI kit). The three subsystem tables below therefore list
> **only the files that actually exist in the repository today** — every module that has not yet
> been pushed is left empty (—).

---

## Identity & User Management Subsystem
Foundational security and accountability layer: who can enter the system, their public identity, and
their reputation.

**Developer: AHMAT MAHAMAT MOURDJI MOUSTAPHA**

| # | Module Name | Frontend | Backend |
|---|-------------|----------|---------|
| 1 | Authentication | — | **Core modules:**<br>• [security.py](backend/security.py) (JWT + bcrypt) |
| 2 | Profile & Trust Score | — | — |
| 3 | User Activity Dashboard | — | — |

## Resource Catalog & Discovery Subsystem
The browsing and search engine: publishing listings and finding items by category, condition and
campus location.

**Developer: MUAZ IBNE AHMED**

| # | Module Name | Frontend | Backend |
|---|-------------|----------|---------|
| 1 | Item Listing & Management | — | — |
| 2 | Category & Condition Metadata | — | — |
| 3 | Location-Based Filter | — | — |

## Transaction & Handover Subsystem
The accountability engine: the loan lifecycle (Pending → Approved → Borrowed → Completed), QR-signed
handover/return, and community moderation.

**Developer: MOHAMMED MOHSEN MOHAMMED ALSAKKAF**

| # | Module Name | Frontend | Backend |
|---|-------------|----------|---------|
| 1 | Request & Approval Workflow | — | **Core modules:**<br>• [tx_common.py](backend/tx_common.py) (state log + enrich)<br>• [notifications.py](backend/notifications.py)<br>• [realtime.py](backend/realtime.py) |
| 2 | QR Verification | — | — |
| 3 | Community Moderation & Reporting | — | — |
