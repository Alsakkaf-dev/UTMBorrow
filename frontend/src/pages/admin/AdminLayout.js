import React, { useCallback, useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Gauge, ArrowsLeftRight, Clock, UsersThree, QrCode, ClipboardText, Flag,
  SignOut, Bell, DotsThreeOutline, Lock, CaretRight, UserCircle,
  ChartLine, MagnifyingGlass, CaretDoubleLeft, CaretDoubleRight,
} from "@phosphor-icons/react";
import { adminApi, setAdminToken } from "../../lib/api";
import { PageLoader, Avatar, IconButton, Modal } from "../../components/ui";
import { useRealtimeStatus } from "../../lib/realtime";
import { useAuth } from "../../context/AuthContext";
import AdminElevate from "./AdminElevate";
import AdminCommandPalette from "./AdminCommandPalette";

// ─── Navigation config ───────────────────────────────────────────────────────

const NAV_GROUPS = [
  {
    label: "Monitoring",
    items: [
      { to: "/admin",            label: "Overview",     icon: Gauge,            end: true },
      { to: "/admin/analytics",  label: "Analytics",    icon: ChartLine },
    ],
  },
  {
    label: "Oversight",
    items: [
      { to: "/admin/transactions", label: "Transactions", icon: ArrowsLeftRight },
      { to: "/admin/overdue",      label: "Overdue",      icon: Clock },
      { to: "/admin/reports",      label: "Reports",      icon: Flag },
    ],
  },
  {
    label: "People",
    items: [
      { to: "/admin/users",  label: "Users",  icon: UsersThree },
      { to: "/admin/inbox",  label: "Inbox",  icon: Bell },
    ],
  },
  {
    label: "Operations",
    items: [
      { to: "/admin/scan",  label: "Desk Scan",  icon: QrCode },
    ],
  },
  {
    label: "System",
    items: [
      { to: "/admin/audit", label: "Audit Log", icon: ClipboardText },
    ],
  },
];

// Mobile bottom-nav primary tabs (max 4 + more)
const PRIMARY_MOBILE = [
  { to: "/admin",              label: "Overview", icon: Gauge,            end: true },
  { to: "/admin/inbox",        label: "Inbox",    icon: Bell },
  { to: "/admin/transactions", label: "Deals",    icon: ArrowsLeftRight },
  { to: "/admin/users",        label: "Users",    icon: UsersThree },
];


