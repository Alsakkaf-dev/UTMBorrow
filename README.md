# UTM Borrow

A campus-wide **circular resource-sharing platform** for the Universiti Teknologi Malaysia (UTM)
community. Verified students lend and borrow academic resources — laboratory tools, engineering
equipment, textbooks and event clothing — instead of buying expensive single-use items. Every loan
runs through a strict state machine and each physical handover/return is proven with a
cryptographically signed QR code.

> Built for **SCSE2243 Application Development I — Section 01, Semester II 2025/2026**
> Group **Alpha** · Prepared for **Dr. Mohd Yazid Bin Idris**

> **Current repository state.** Only the shared **foundation** has been pushed to `main` so far
> (core backend modules + the frontend UI kit). **Every file currently in the repository was authored
> by Mohammed Alsakkaf.** The subsystem tables below therefore list **only the files that actually
> exist today**; every module not yet pushed is left empty (—).

---

## Team & Subsystem Ownership

| Subsystem | Developer | Matric |
|-----------|-----------|--------|
| Identity & User Management | Ahmat Mahamat Mourdji Moustapha | A24CS4053 |
| Resource Catalog & Discovery | Muaz Ibne Ahmed | A23CS4062 |
| Transaction & Handover | Mohammed Mohsen Mohammed Alsakkaf | A23CS4026 |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 (Create React App), React Router v6, Tailwind CSS v3, Framer Motion, Phosphor Icons, Axios |
| Backend | FastAPI (Python), Motor (async MongoDB driver), PyJWT, bcrypt |
| Database | MongoDB (local `:27017` or Atlas) |
| Realtime | Server-Sent Events (SSE) — push-only live updates |
| Security | JWT sessions, bcrypt password hashing, TOTP 2FA, HMAC-SHA256 signed QR tokens |

---

Each subsystem owns **three modules** (nine modules total). For every module the table lists its
**Frontend** (screens + components) and **Backend** (routers + core modules). **Click any file name
to open it.**

## Identity & User Management Subsystem
Foundational security and accountability layer: who can enter the system, their public identity, and
their reputation.

**Developer: AHMAT MAHAMAT MOURDJI MOUSTAPHA**

| # | Module Name | Frontend | Backend |
|---|-------------|----------|---------|
| 1 | Authentication | — | **Core modules:**<br>• [security.py](Backend/security.py) (JWT + bcrypt) |
| 2 | Profile & Trust Score | — | — |
| 3 | User Activity Dashboard | — | — |

> **ℹ️ Authorship note —** [`security.py`](Backend/security.py) was written by **Mohammed Alsakkaf**,
> not by this subsystem's owner. It is the shared JWT + bcrypt security core that every subsystem
> depends on, so it was built first as part of the platform foundation while the Identity modules are
> still pending.

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
| 1 | Request & Approval Workflow | — | **Core modules:**<br>• [tx_common.py](Backend/tx_common.py) (state log + enrich)<br>• [notifications.py](Backend/notifications.py)<br>• [realtime.py](Backend/realtime.py) |
| 2 | QR Verification | — | — |
| 3 | Community Moderation & Reporting | — | — |
