"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleGoogle = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback` },
    });
  };

  const handleSubmit = async () => {
    setError("");
    setMessage("");
    setLoading(true);
    const supabase = createClient();

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setError(error.message);
      } else {
        setMessage("確認メールを送りました。メールのリンクをクリックしてからログインしてください。");
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError("メールアドレスまたはパスワードが間違っています。");
      } else {
        router.push("/");
        router.refresh();
      }
    }
    setLoading(false);
  };

  return (
    <div style={{
      fontFamily: "'Hiragino Kaku Gothic ProN','Noto Sans JP',sans-serif",
      background: "#f7f5f0",
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
    }}>
      <div style={{
        background: "#fff",
        borderRadius: 24,
        padding: 32,
        width: "100%",
        maxWidth: 390,
        border: "1px solid #e8e2d8",
      }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 32, fontWeight: 900, letterSpacing: "-1px", color: "#1a1a1a" }}>複利</div>
          <div style={{ fontSize: 11, color: "#999", letterSpacing: "3px" }}>FUKURI</div>
          <div style={{ fontSize: 13, color: "#888", marginTop: 12 }}>仕事の経験を、未来の力に。</div>
        </div>

        {/* Mode toggle */}
        <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          {[
            { val: "login", label: "ログイン" },
            { val: "signup", label: "新規登録" },
          ].map(opt => (
            <button key={opt.val} onClick={() => { setMode(opt.val as "login" | "signup"); setError(""); setMessage(""); }} style={{
              flex: 1, padding: "10px", borderRadius: 12,
              background: mode === opt.val ? "#1a1a1a" : "#f7f5f0",
              color: mode === opt.val ? "#fff" : "#888",
              border: "1px solid #e8e2d8",
              fontSize: 14, fontWeight: mode === opt.val ? 700 : 400,
              cursor: "pointer",
            }}>{opt.label}</button>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input
            type="email"
            placeholder="メールアドレス"
            value={email}
            onChange={e => setEmail(e.target.value)}
            style={{
              padding: "12px 14px", borderRadius: 12,
              border: "1px solid #e8e2d8", fontSize: 14,
              outline: "none", background: "#fff", color: "#1a1a1a",
            }}
          />
          <input
            type="password"
            placeholder="パスワード（6文字以上）"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSubmit()}
            style={{
              padding: "12px 14px", borderRadius: 12,
              border: "1px solid #e8e2d8", fontSize: 14,
              outline: "none", background: "#fff", color: "#1a1a1a",
            }}
          />
        </div>

        {error && (
          <div style={{ marginTop: 12, padding: "10px 14px", background: "#fff0f0", borderRadius: 10, fontSize: 13, color: "#c0392b" }}>
            {error}
          </div>
        )}
        {message && (
          <div style={{ marginTop: 12, padding: "10px 14px", background: "#f0f7f0", borderRadius: 10, fontSize: 13, color: "#3d6b3d" }}>
            {message}
          </div>
        )}

        <button onClick={handleSubmit} disabled={loading} style={{
          width: "100%", marginTop: 20, padding: "14px",
          background: "#1a1a1a", color: "#f7f5f0",
          border: "none", borderRadius: 12, fontSize: 15,
          fontWeight: 800, cursor: loading ? "not-allowed" : "pointer",
          opacity: loading ? 0.7 : 1,
        }}>
          {loading ? "処理中..." : mode === "login" ? "ログイン" : "アカウントを作成"}
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0" }}>
          <div style={{ flex: 1, height: 1, background: "#e8e2d8" }} />
          <span style={{ fontSize: 12, color: "#bbb" }}>または</span>
          <div style={{ flex: 1, height: 1, background: "#e8e2d8" }} />
        </div>

        <button onClick={handleGoogle} style={{
          width: "100%", padding: "13px",
          background: "#fff", color: "#1a1a1a",
          border: "1px solid #e8e2d8", borderRadius: 12, fontSize: 14,
          fontWeight: 600, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
        }}>
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
            <path fill="#FBBC05" d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.039l3.007-2.332z"/>
            <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z"/>
          </svg>
          Googleでログイン
        </button>
      </div>
    </div>
  );
}
