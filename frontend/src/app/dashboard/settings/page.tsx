"use client"

import { useEffect, useState } from "react"
import { KeyRound, Loader2, Mail, Save, User as UserIcon } from "lucide-react"
import { toast } from "sonner"
import { AppHeader } from "@/components/dashboard/app-header"
import { changePassword, updateProfile } from "@/features/auth/auth.service"

type Profile = {
  name?: string
  email?: string
  avatar?: string
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile>({})
  const [name, setName] = useState("")
  const [avatar, setAvatar] = useState("")

  const [savingProfile, setSavingProfile] = useState(false)

  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [savingPassword, setSavingPassword] = useState(false)

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("neurostack_user")
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as Profile
          setProfile(parsed)
          setName(parsed.name ?? "")
          setAvatar(parsed.avatar ?? "")
        } catch {
          // ignore
        }
      }
    }
  }, [])

  async function handleSaveProfile() {
    if (!name.trim() || name.trim().length < 2) {
      toast.error("Name must be at least 2 characters.")
      return
    }

    setSavingProfile(true)

    try {
      const result = await updateProfile({
        name: name.trim(),
        avatar: avatar.trim() || undefined,
      })

      toast.success(result.message || "Profile updated.")
      setProfile((prev) => ({
        ...prev,
        name: name.trim(),
        avatar: avatar.trim(),
      }))
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update profile."
      )
    } finally {
      setSavingProfile(false)
    }
  }

  async function handleChangePassword() {
    if (!currentPassword) {
      toast.error("Enter your current password.")
      return
    }

    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters.")
      return
    }

    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match.")
      return
    }

    setSavingPassword(true)

    try {
      const result = await changePassword({
        currentPassword,
        newPassword,
      })

      toast.success(result.message || "Password changed.")
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to change password."
      )
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <div className="flex flex-col h-full w-full bg-[#212121] text-[#ececec]">
      <AppHeader
        title="Settings"
        description="Manage your profile and account security"
      />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-6 space-y-5">
          {/* Profile */}
          <section className="rounded-2xl bg-[#2f2f2f] border border-white/10 overflow-hidden">
            <div className="border-b border-white/[0.08] px-5 py-4 flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-white/10 text-[#19c37d]">
                <UserIcon className="size-4" />
              </div>
              <div>
                <h2 className="text-[14px] font-semibold text-[#ececec]">
                  Profile
                </h2>
                <p className="text-[11px] text-[#8e8e8e]">
                  Update your display name and avatar
                </p>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-[12px] font-medium text-[#8e8e8e] mb-1.5">
                  Email (read-only)
                </label>
                <div className="flex items-center gap-2 rounded-xl bg-[#212121] border border-white/10 px-3 py-2.5">
                  <Mail className="size-4 text-[#8e8e8e]" />
                  <span className="text-[13.5px] text-[#ececec]">
                    {profile.email || "—"}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-medium text-[#8e8e8e] mb-1.5">
                  Display name
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="w-full rounded-xl bg-[#212121] border border-white/10 px-3 py-2.5 text-[13.5px] text-[#ececec] placeholder-[#8e8e8e] outline-none focus:border-white/30 transition-colors"
                />
              </div>

              <div>
                <label className="block text-[12px] font-medium text-[#8e8e8e] mb-1.5">
                  Avatar URL (optional)
                </label>
                <input
                  value={avatar}
                  onChange={(e) => setAvatar(e.target.value)}
                  placeholder="https://example.com/avatar.png"
                  className="w-full rounded-xl bg-[#212121] border border-white/10 px-3 py-2.5 text-[13.5px] text-[#ececec] placeholder-[#8e8e8e] outline-none focus:border-white/30 transition-colors"
                />
              </div>

              <div className="flex justify-end pt-1">
                <button
                  onClick={() => void handleSaveProfile()}
                  disabled={savingProfile}
                  className="flex items-center gap-2 rounded-xl bg-white text-black px-4 py-2.5 text-[13px] font-semibold hover:bg-white/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  {savingProfile ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Save className="size-4" />
                  )}
                  Save changes
                </button>
              </div>
            </div>
          </section>

          {/* Security */}
          <section className="rounded-2xl bg-[#2f2f2f] border border-white/10 overflow-hidden">
            <div className="border-b border-white/[0.08] px-5 py-4 flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-white/10 text-[#4da3ff]">
                <KeyRound className="size-4" />
              </div>
              <div>
                <h2 className="text-[14px] font-semibold text-[#ececec]">
                  Change password
                </h2>
                <p className="text-[11px] text-[#8e8e8e]">
                  Choose a strong password you don&apos;t use elsewhere
                </p>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-[12px] font-medium text-[#8e8e8e] mb-1.5">
                  Current password
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl bg-[#212121] border border-white/10 px-3 py-2.5 text-[13.5px] text-[#ececec] placeholder-[#8e8e8e] outline-none focus:border-white/30 transition-colors"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-medium text-[#8e8e8e] mb-1.5">
                    New password
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className="w-full rounded-xl bg-[#212121] border border-white/10 px-3 py-2.5 text-[13.5px] text-[#ececec] placeholder-[#8e8e8e] outline-none focus:border-white/30 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-medium text-[#8e8e8e] mb-1.5">
                    Confirm new password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                    className="w-full rounded-xl bg-[#212121] border border-white/10 px-3 py-2.5 text-[13.5px] text-[#ececec] placeholder-[#8e8e8e] outline-none focus:border-white/30 transition-colors"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  onClick={() => void handleChangePassword()}
                  disabled={savingPassword}
                  className="flex items-center gap-2 rounded-xl bg-white text-black px-4 py-2.5 text-[13px] font-semibold hover:bg-white/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  {savingPassword ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <KeyRound className="size-4" />
                  )}
                  Update password
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
