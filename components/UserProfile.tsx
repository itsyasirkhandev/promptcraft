"use client";

import { useState, useRef, useEffect } from "react";
import { User } from "firebase/auth";
import Image from "next/image";
import { 
  SignOut, 
  EnvelopeSimple, 
  CaretDown,
  ShieldCheck 
} from "@phosphor-icons/react";

interface UserProfileProps {
  user: User;
  onLogout: () => void;
}

export default function UserProfile({ user, onLogout }: UserProfileProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const initials = user.displayName
    ? user.displayName.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase()
    : user.email ? user.email.substring(0, 2).toUpperCase() : "U";

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-2.5 pl-2.5 pr-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-all duration-200 cursor-pointer group shadow-sm active:scale-[0.98]"
        aria-label="User profile menu"
      >
        {user.photoURL ? (
          <div className="relative w-7 h-7 rounded-full overflow-hidden border border-slate-200 dark:border-slate-800 group-hover:border-slate-300 dark:group-hover:border-slate-700 transition-colors">
            <Image
              src={user.photoURL}
              alt={user.displayName || "User avatar"}
              fill
              sizes="28px"
              className="object-cover"
            />
          </div>
        ) : (
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-xs font-semibold select-none shadow-inner">
            {initials}
          </div>
        )}

        <div className="hidden sm:flex flex-col items-start leading-none text-left">
          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[100px]">
            {user.displayName || "Active User"}
          </span>
        </div>

        <CaretDown 
          size={14} 
          className={`text-slate-400 dark:text-slate-500 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 origin-top-right rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 shadow-xl z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="px-3.5 py-3 border-b border-slate-100 dark:border-slate-800/60 mb-1">
            <div className="flex items-center gap-3">
              {user.photoURL ? (
                <div className="relative w-10 h-10 rounded-full overflow-hidden border border-slate-200 dark:border-slate-800">
                  <Image
                    src={user.photoURL}
                    alt={user.displayName || "User avatar"}
                    fill
                    sizes="40px"
                    className="object-cover"
                  />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-semibold text-sm">
                  {initials}
                </div>
              )}
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                  {user.displayName || "User"}
                </span>
                <span className="text-xs text-slate-400 dark:text-slate-500 truncate flex items-center gap-1">
                  <EnvelopeSimple size={12} className="flex-shrink-0" />
                  {user.email}
                </span>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
              <ShieldCheck size={12} />
              <span>Verified Account</span>
            </div>
          </div>

          <button
            onClick={() => {
              setIsOpen(false);
              onLogout();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-xl transition-all duration-150 cursor-pointer font-medium active:scale-[0.98]"
          >
            <SignOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      )}
    </div>
  );
}
