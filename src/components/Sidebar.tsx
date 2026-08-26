"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Calendar,
  DollarSign,
  Users,
  Scissors,
  Settings,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Package,
  Menu,
  X,
  GitCompareArrows,
  MapPin,
  ChevronDown,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useStore } from "@/hooks/useStore";

const menuItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/agendamentos", label: "Agendamentos", icon: Calendar },
  { href: "/financeiro", label: "Financeiro", icon: DollarSign },
  { href: "/estoque", label: "Estoque", icon: Package },
  { href: "/resumo", label: "Resumo", icon: ClipboardList },
  { href: "/profissionais", label: "Profissionais", icon: Scissors },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/comparativo", label: "Comparar Lojas", icon: GitCompareArrows },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [storeDropdownOpen, setStoreDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { stores, currentStore, currentStoreName, setCurrentStore } = useStore();

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [mobileOpen]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setStoreDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const shortStoreName = currentStoreName
    ? currentStoreName.length > 16
      ? currentStoreName.slice(0, 14) + "…"
      : currentStoreName
    : "";

  return (
    <>
      {/* Mobile top bar */}
      <div className="fixed top-0 left-0 right-0 h-14 bg-sidebar-bg text-white flex items-center px-4 gap-3 z-40 md:hidden">
        <button onClick={() => setMobileOpen(true)} aria-label="Abrir menu">
          <Menu size={24} />
        </button>
        <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="Cacique"
            width={32}
            height={32}
            className="object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
              (e.target as HTMLImageElement).parentElement!.innerHTML =
                '<span class="text-white font-bold text-xs">C</span>';
            }}
          />
        </div>
        <span className="font-semibold text-sm flex-1 truncate">
          {shortStoreName || "DashBoard Cacique's"}
        </span>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-full bg-sidebar-bg text-sidebar-text flex flex-col transition-all duration-300 z-50
          ${collapsed ? "w-16" : "w-60"}
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
          md:translate-x-0
        `}
      >
        <div className="flex items-center gap-3 px-4 h-16 border-b border-white/10">
          <div className="w-9 h-9 rounded-full bg-black flex items-center justify-center shrink-0 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="Cacique"
              width={36}
              height={36}
              className="object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
                (e.target as HTMLImageElement).parentElement!.innerHTML =
                  '<span class="text-white font-bold text-sm">C</span>';
              }}
            />
          </div>
          {!collapsed && (
            <span className="font-semibold text-sm text-white truncate leading-tight flex-1">
              DashBoard
              <br />
              Cacique&apos;s
            </span>
          )}
          <button
            onClick={() => setMobileOpen(false)}
            className="md:hidden text-sidebar-text/50 hover:text-white"
            aria-label="Fechar menu"
          >
            <X size={20} />
          </button>
        </div>

        {/* Store Selector */}
        {stores.length > 1 && !collapsed && (
          <div className="px-3 py-3 border-b border-white/10" ref={dropdownRef}>
            <button
              onClick={() => setStoreDropdownOpen(!storeDropdownOpen)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-left"
            >
              <MapPin size={14} className="text-accent shrink-0" />
              <span className="text-xs text-white truncate flex-1">
                {shortStoreName}
              </span>
              <ChevronDown
                size={14}
                className={`text-sidebar-text/50 transition-transform ${storeDropdownOpen ? "rotate-180" : ""}`}
              />
            </button>
            {storeDropdownOpen && (
              <div className="mt-1 bg-sidebar-bg border border-white/10 rounded-lg overflow-hidden shadow-xl">
                {stores.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setCurrentStore(s.id);
                      setStoreDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs transition-colors flex items-center gap-2 ${
                      s.id === currentStore
                        ? "bg-accent/20 text-accent"
                        : "text-sidebar-text/70 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <MapPin size={12} className="shrink-0" />
                    <span className="truncate">{s.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <nav className="flex-1 py-4 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg transition-colors ${
                  isActive
                    ? "bg-accent text-sidebar-bg font-medium"
                    : "text-sidebar-text/70 hover:bg-white/5 hover:text-white"
                }`}
                title={collapsed ? item.label : undefined}
              >
                <item.icon size={20} className="shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden md:flex items-center justify-center h-12 border-t border-white/10 text-sidebar-text/50 hover:text-white transition-colors"
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </aside>
    </>
  );
}
