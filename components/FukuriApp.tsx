"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";

const MENTOR_BADGES = [
  { id: "sprout", icon: "🌱", label: "芽吹き", desc: "初めて誰かを助けた", min: 1 },
  { id: "leaf", icon: "🌿", label: "若葉", desc: "10人支援", min: 10 },
  { id: "tree", icon: "🌳", label: "大樹", desc: "50人支援", min: 50 },
  { id: "forest", icon: "🌲", label: "森の人", desc: "100人支援", min: 100 },
  { id: "earth", icon: "🌍", label: "大地", desc: "コミュニティの根っこ", min: 200 },
];

const GRATITUDE_BADGES = [
  { id: "seed", icon: "✨", label: "種まき人", desc: "初めて「やってみる！」もらった", min: 1 },
  { id: "bloom", icon: "🌸", label: "咲かせた人", desc: "「成果でた！」が5件", min: 5 },
  { id: "clover", icon: "🍀", label: "変えた人", desc: "「あなたのおかげ」が20件", min: 20 },
  { id: "star", icon: "🌟", label: "人生を照らした人", desc: "感謝が50件", min: 50 },
];

const getMentorBadge = (count: number) =>
  [...MENTOR_BADGES].reverse().find(b => count >= b.min) || null;
const getGratitudeBadge = (count: number) =>
  [...GRATITUDE_BADGES].reverse().find(b => count >= b.min) || null;

function formatTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "たった今";
  if (minutes < 60) return `${minutes}分前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}時間前`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "昨日";
  return `${days}日前`;
}

type Post = {
  id: number;
  user: string;
  handle: string;
  avatar: string;
  role: string;
  content: string;
  tags: string[];
  reactions: { fight: number; try: number; same: number };
  myReaction: string | null;
  time: string;
  isHelp: boolean;
  mentorCount: number;
  gratitudeCount: number;
};

type Profile = {
  id: string;
  display_name: string;
  handle: string;
  avatar: string;
  role: string;
  mentor_count: number;
  gratitude_count: number;
};

const TABS = ["タイムライン", "助けて", "自分"];

export default function FukuriApp() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [myProfile, setMyProfile] = useState<Profile | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [isHelp, setIsHelp] = useState(false);
  const [newPost, setNewPost] = useState("");
  const [newTag, setNewTag] = useState("");
  const [newTags, setNewTags] = useState<string[]>([]);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [showBadgeModal, setShowBadgeModal] = useState(false);
  const [posting, setPosting] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState("");
  const [editHandle, setEditHandle] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editAvatar, setEditAvatar] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const fetchPosts = useCallback(async (supabase: ReturnType<typeof createClient>, userId: string) => {
    const { data } = await supabase
      .from("posts")
      .select(`
        id, content, is_help, created_at,
        profiles (display_name, handle, avatar, role, mentor_count, gratitude_count),
        post_tags (tag),
        reactions (type, user_id)
      `)
      .order("created_at", { ascending: false });

    if (data) {
      const transformed: Post[] = data.map((post: any) => {
        const reactionCounts = { fight: 0, try: 0, same: 0 };
        let myReaction: string | null = null;
        (post.reactions || []).forEach((r: any) => {
          if (r.type in reactionCounts) {
            reactionCounts[r.type as keyof typeof reactionCounts]++;
          }
          if (r.user_id === userId) myReaction = r.type;
        });
        const profile = post.profiles || {};
        return {
          id: post.id,
          user: profile.display_name || "ユーザー",
          handle: profile.handle || "",
          avatar: profile.avatar || "?",
          role: profile.role || "",
          content: post.content,
          tags: (post.post_tags || []).map((t: any) => t.tag),
          reactions: reactionCounts,
          myReaction,
          time: formatTime(post.created_at),
          isHelp: post.is_help,
          mentorCount: profile.mentor_count || 0,
          gratitudeCount: profile.gratitude_count || 0,
        };
      });
      setPosts(transformed);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setCurrentUserId(user.id);

      let { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (!profile) {
        const emailPrefix = (user.email || "user").split("@")[0];
        const { data: newProfile } = await supabase
          .from("profiles")
          .insert({
            id: user.id,
            display_name: emailPrefix,
            handle: emailPrefix,
            avatar: emailPrefix.charAt(0).toUpperCase(),
          })
          .select()
          .single();
        profile = newProfile;
      }

      setMyProfile(profile);
      await fetchPosts(supabase, user.id);
      setLoadingPosts(false);
    };

    init();
  }, [fetchPosts]);

  const handleReaction = async (postId: number, type: string) => {
    if (!currentUserId) return;
    const supabase = createClient();

    const post = posts.find(p => p.id === postId);
    if (!post) return;
    const prev = post.myReaction;

    // 画面を即座に更新（ボタンの反応を速くする）
    setPosts(posts.map(p => {
      if (p.id !== postId) return p;
      const reactions = { ...p.reactions };
      if (prev) reactions[prev as keyof typeof reactions] = Math.max(0, reactions[prev as keyof typeof reactions] - 1);
      if (prev !== type) reactions[type as keyof typeof reactions] = (reactions[type as keyof typeof reactions] || 0) + 1;
      return { ...p, reactions, myReaction: prev === type ? null : type };
    }));

    // Supabaseに保存
    if (prev) {
      await supabase.from("reactions").delete()
        .eq("post_id", postId).eq("user_id", currentUserId);
    }
    if (prev !== type) {
      await supabase.from("reactions").insert({
        post_id: postId,
        user_id: currentUserId,
        type,
      });
    }
  };

  const handlePost = async () => {
    if (!newPost.trim() || !myProfile) return;
    setPosting(true);
    const supabase = createClient();

    const { data: post } = await supabase
      .from("posts")
      .insert({ author_id: myProfile.id, content: newPost, is_help: isHelp })
      .select()
      .single();

    if (post && newTags.length > 0) {
      await supabase.from("post_tags").insert(
        newTags.map(tag => ({ post_id: post.id, tag }))
      );
    }

    setNewPost(""); setNewTags([]); setIsHelp(false); setShowModal(false);
    await fetchPosts(supabase, myProfile.id);
    setPosting(false);
  };

  const addTag = () => {
    if (newTag.trim() && !newTags.includes(newTag.trim())) {
      setNewTags([...newTags, newTag.trim()]);
    }
    setNewTag("");
  };

  const handleEditOpen = () => {
    setEditName(myProfile?.display_name || "");
    setEditHandle(myProfile?.handle || "");
    setEditRole(myProfile?.role || "");
    setEditAvatar(myProfile?.avatar || "");
    setEditMode(true);
  };

  const handleProfileSave = async () => {
    if (!myProfile) return;
    setSavingProfile(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("profiles")
      .update({
        display_name: editName,
        handle: editHandle,
        role: editRole,
        avatar: editAvatar.charAt(0) || myProfile.avatar,
      })
      .eq("id", myProfile.id)
      .select()
      .single();
    if (data) setMyProfile(data);
    setSavingProfile(false);
    setEditMode(false);
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const generateAI = async () => {
    setLoadingAI(true); setAiSummary(null);
    const content = posts.map(p => p.content).join("\n");
    try {
      const res = await fetch("/api/ai-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      setAiSummary(data.result || data.error || "分析結果を取得できませんでした。");
    } catch {
      setAiSummary("分析中にエラーが発生しました。");
    }
    setLoadingAI(false);
  };

  const filteredPosts = activeTab === 1 ? posts.filter(p => p.isHelp) : posts;
  const mentorBadge = getMentorBadge(myProfile?.mentor_count || 0);
  const gratitudeBadge = getGratitudeBadge(myProfile?.gratitude_count || 0);
  const postCount = posts.filter(p => p.handle === myProfile?.handle).length;

  return (
    <div style={{
      fontFamily: "'Hiragino Kaku Gothic ProN','Noto Sans JP',sans-serif",
      background: "#f7f5f0",
      minHeight: "100vh",
      color: "#1a1a1a",
      width: "100%",
      maxWidth: 430,
      margin: "0 auto",
      position: "relative",
      paddingBottom: 80,
    }}>

      {/* Header */}
      <div style={{
        padding: "18px 20px 12px",
        borderBottom: "1px solid #e8e2d8",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0,
        background: "#f7f5f0ee",
        backdropFilter: "blur(12px)", zIndex: 10,
      }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: "-1px", color: "#1a1a1a" }}>複利</div>
          <div style={{ fontSize: 10, color: "#999", letterSpacing: "3px" }}>FUKURI</div>
        </div>
        <button onClick={generateAI} style={{
          background: "#1a1a1a", color: "#f7f5f0",
          border: "none", borderRadius: 20, padding: "7px 14px",
          fontSize: 12, fontWeight: 700, cursor: "pointer", letterSpacing: "0.5px",
        }}>✦ AI分析</button>
      </div>

      {/* AI Summary */}
      {(loadingAI || aiSummary) && (
        <div style={{
          margin: "14px 16px", padding: "16px",
          background: "#fff", borderRadius: 16,
          border: "1px solid #e8e2d8",
          boxShadow: "0 2px 12px #0001",
        }}>
          <div style={{ fontSize: 11, color: "#5a8a5a", letterSpacing: "2px", marginBottom: 8, fontWeight: 700 }}>
            🌿 AIキャリア分析
          </div>
          {loadingAI
            ? <div style={{ color: "#aaa", fontSize: 13 }}>あなたの複利を分析中...</div>
            : <div style={{ fontSize: 13, lineHeight: 1.85, color: "#333", whiteSpace: "pre-wrap" }}>{aiSummary}</div>
          }
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid #e8e2d8", padding: "0 16px" }}>
        {TABS.map((tab, i) => (
          <button key={i} onClick={() => setActiveTab(i)} style={{
            flex: 1, padding: "12px 0", background: "none", border: "none",
            fontSize: 13, fontWeight: 700,
            color: activeTab === i ? "#1a1a1a" : "#999",
            borderBottom: activeTab === i ? "2px solid #5a8a5a" : "2px solid transparent",
            cursor: "pointer", transition: "all 0.2s",
          }}>{tab}</button>
        ))}
      </div>

      {/* Profile Tab */}
      {activeTab === 2 ? (
        <div style={{ padding: 20 }}>
          <div style={{
            background: "#fff", borderRadius: 20, padding: 24,
            border: "1px solid #e8e2d8", marginBottom: 16,
          }}>
            <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 20 }}>
              <div style={{
                width: 60, height: 60, borderRadius: "50%",
                background: "linear-gradient(135deg, #5a8a5a, #3d6b3d)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 24, fontWeight: 700, color: "#fff",
              }}>{myProfile?.avatar || "?"}</div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 17 }}>{myProfile?.display_name || "ユーザー"}</div>
                <div style={{ fontSize: 12, color: "#5a8a5a", marginTop: 2 }}>{myProfile?.role || "肩書き未設定"}</div>
                <div style={{ fontSize: 11, color: "#aaa" }}>@{myProfile?.handle || ""}</div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
              {[
                { label: "投稿", val: postCount },
                { label: "支援", val: myProfile?.mentor_count || 0 },
                { label: "感謝", val: myProfile?.gratitude_count || 0 },
              ].map(s => (
                <div key={s.label} style={{
                  flex: 1, textAlign: "center", background: "#f7f5f0",
                  borderRadius: 12, padding: "10px 0",
                }}>
                  <div style={{ fontSize: 20, fontWeight: 800 }}>{s.val}</div>
                  <div style={{ fontSize: 11, color: "#999" }}>{s.label}</div>
                </div>
              ))}
            </div>

            <div style={{ fontSize: 12, color: "#999", marginBottom: 10, fontWeight: 600, letterSpacing: "1px" }}>
              🏅 称号
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {mentorBadge && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 6,
                  background: "#f0f7f0", borderRadius: 20, padding: "6px 14px",
                  border: "1px solid #c8dfc8", fontSize: 13,
                }}>
                  <span style={{ fontSize: 18 }}>{mentorBadge.icon}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 12, color: "#3d6b3d" }}>{mentorBadge.label}</div>
                    <div style={{ fontSize: 10, color: "#7aaa7a" }}>{mentorBadge.desc}</div>
                  </div>
                </div>
              )}
              {gratitudeBadge && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 6,
                  background: "#fff8f0", borderRadius: 20, padding: "6px 14px",
                  border: "1px solid #f0d8b8", fontSize: 13,
                }}>
                  <span style={{ fontSize: 18 }}>{gratitudeBadge.icon}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 12, color: "#8b5e3c" }}>{gratitudeBadge.label}</div>
                    <div style={{ fontSize: 10, color: "#c8956a" }}>{gratitudeBadge.desc}</div>
                  </div>
                </div>
              )}
            </div>

            <button onClick={() => setShowBadgeModal(true)} style={{
              marginTop: 14, width: "100%", padding: "10px",
              background: "#f7f5f0", border: "1px solid #e8e2d8",
              borderRadius: 12, fontSize: 12, color: "#5a8a5a",
              cursor: "pointer", fontWeight: 600,
            }}>
              🌱 称号の成長を見る
            </button>

            <button onClick={handleEditOpen} style={{
              marginTop: 10, width: "100%", padding: "10px",
              background: "#f0f7f0", border: "1px solid #c8dfc8",
              borderRadius: 12, fontSize: 12, color: "#3d6b3d",
              cursor: "pointer", fontWeight: 600,
            }}>
              ✏️ プロフィールを編集する
            </button>

            <button onClick={handleLogout} style={{
              marginTop: 10, width: "100%", padding: "10px",
              background: "#fff", border: "1px solid #e8e2d8",
              borderRadius: 12, fontSize: 12, color: "#999",
              cursor: "pointer", fontWeight: 600,
            }}>
              ログアウト
            </button>
          </div>
        </div>
      ) : (
        /* Feed */
        <div>
          {loadingPosts ? (
            <div style={{ textAlign: "center", padding: 40, color: "#aaa", fontSize: 13 }}>
              読み込み中...
            </div>
          ) : filteredPosts.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: "#aaa", fontSize: 13 }}>
              まだ投稿がありません
            </div>
          ) : (
            filteredPosts.map((post, i) => (
              <div key={post.id} style={{
                padding: "18px 20px",
                borderBottom: "1px solid #eee8e0",
                background: post.isHelp ? "#fff8f5" : "#fff",
                animation: i === 0 ? "fadeIn 0.3s ease" : "none",
              }}>
                {post.isHelp && (
                  <div style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    background: "#ff6b4a22", color: "#ff6b4a",
                    borderRadius: 20, padding: "2px 10px", fontSize: 11,
                    fontWeight: 700, marginBottom: 10, border: "1px solid #ff6b4a44",
                  }}>
                    🆘 助けて！
                  </div>
                )}

                <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                  <div style={{
                    width: 42, height: 42, borderRadius: "50%", flexShrink: 0,
                    background: "linear-gradient(135deg, #5a8a5a, #3d6b3d)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 17, fontWeight: 700, color: "#fff",
                  }}>{post.avatar}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontWeight: 700, fontSize: 14 }}>{post.user}</span>
                      {getMentorBadge(post.mentorCount) && (
                        <span style={{ fontSize: 14 }} title={getMentorBadge(post.mentorCount)!.label}>
                          {getMentorBadge(post.mentorCount)!.icon}
                        </span>
                      )}
                      {getGratitudeBadge(post.gratitudeCount) && (
                        <span style={{ fontSize: 14 }} title={getGratitudeBadge(post.gratitudeCount)!.label}>
                          {getGratitudeBadge(post.gratitudeCount)!.icon}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: "#5a8a5a" }}>{post.role}</div>
                    <div style={{ fontSize: 11, color: "#bbb" }}>{post.time}</div>
                  </div>
                </div>

                <div style={{ fontSize: 14, lineHeight: 1.85, color: "#2a2a2a", marginBottom: 12 }}>
                  {post.content}
                </div>

                {post.tags.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                    {post.tags.map(tag => (
                      <span key={tag} style={{
                        fontSize: 11, padding: "3px 10px", borderRadius: 20,
                        background: "#f0f7f0", color: "#5a8a5a",
                        border: "1px solid #c8dfc8",
                      }}>#{tag}</span>
                    ))}
                  </div>
                )}

                <div style={{ display: "flex", gap: 8 }}>
                  {[
                    { key: "fight", label: "ファイト！", icon: "✊" },
                    { key: "try", label: "やってみる！", icon: "🌱" },
                    { key: "same", label: "経験したよ！", icon: "🔥" },
                  ].map(r => (
                    <button key={r.key} onClick={() => handleReaction(post.id, r.key)} style={{
                      display: "flex", alignItems: "center", gap: 4,
                      padding: "5px 10px", borderRadius: 20,
                      background: post.myReaction === r.key ? "#f0f7f0" : "#f7f5f0",
                      border: post.myReaction === r.key ? "1px solid #5a8a5a" : "1px solid #e8e2d8",
                      color: post.myReaction === r.key ? "#3d6b3d" : "#888",
                      fontSize: 11, fontWeight: post.myReaction === r.key ? 700 : 400,
                      cursor: "pointer", transition: "all 0.15s",
                    }}>
                      <span>{r.icon}</span>
                      <span style={{ fontSize: 10 }}>{r.label}</span>
                      <span style={{ fontWeight: 700 }}>{post.reactions[r.key as keyof typeof post.reactions]}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Post Modal */}
      {showModal && (
        <div style={{
          position: "fixed", inset: 0, background: "#0006",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 100, padding: 20,
        }}>
          <div style={{
            background: "#f7f5f0", borderRadius: 24,
            padding: "24px 20px 28px", width: "100%", maxWidth: 390,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontWeight: 800, fontSize: 16, color: "#1a1a1a" }}>🌱 今日の複利を記録</div>
              <button onClick={() => setShowModal(false)} style={{
                background: "none", border: "none", cursor: "pointer",
                fontSize: 20, color: "#bbb", lineHeight: 1,
              }}>✕</button>
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              {[
                { val: false, label: "📝 つぶやく" },
                { val: true, label: "🆘 助けて！" },
              ].map(opt => (
                <button key={String(opt.val)} onClick={() => setIsHelp(opt.val)} style={{
                  flex: 1, padding: "8px", borderRadius: 12,
                  background: isHelp === opt.val ? "#1a1a1a" : "#fff",
                  color: isHelp === opt.val ? "#fff" : "#888",
                  border: "1px solid #e8e2d8", fontSize: 13,
                  fontWeight: isHelp === opt.val ? 700 : 400, cursor: "pointer",
                }}>{opt.label}</button>
              ))}
            </div>

            <textarea value={newPost} onChange={e => setNewPost(e.target.value)}
              placeholder={isHelp ? "今、何で困ってる？気軽に投げてみて..." : "今日の経験・気づき・学びを気軽に..."}
              style={{
                width: "100%", minHeight: 110, background: "#fff",
                border: "1px solid #e8e2d8", borderRadius: 12,
                color: "#1a1a1a", fontSize: 14, padding: "12px",
                resize: "none", outline: "none", lineHeight: 1.7, boxSizing: "border-box",
              }} autoFocus />

            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
              {newTags.map(tag => (
                <span key={tag} style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  fontSize: 11, padding: "3px 10px", borderRadius: 20,
                  background: "#f0f7f0", color: "#5a8a5a", border: "1px solid #c8dfc8",
                }}>
                  #{tag}
                  <button onClick={() => setNewTags(newTags.filter(t => t !== tag))} style={{
                    background: "none", border: "none", cursor: "pointer",
                    color: "#aaa", fontSize: 11, padding: 0, lineHeight: 1,
                  }}>✕</button>
                </span>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <input value={newTag} onChange={e => setNewTag(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); addTag(); } }}
                placeholder="タグ (Enterで追加)"
                style={{
                  flex: 1, background: "#fff", border: "1px solid #e8e2d8",
                  borderRadius: 8, color: "#1a1a1a", fontSize: 12,
                  padding: "8px 12px", outline: "none",
                }} />
              <button onClick={addTag} style={{
                background: "#f0f7f0", border: "1px solid #c8dfc8",
                borderRadius: 8, color: "#5a8a5a", padding: "8px 12px",
                fontSize: 12, cursor: "pointer",
              }}>＋</button>
            </div>
            <button onClick={handlePost} disabled={posting} style={{
              width: "100%", marginTop: 16, padding: "14px",
              background: "#1a1a1a", color: "#f7f5f0",
              border: "none", borderRadius: 12, fontSize: 15,
              fontWeight: 800, cursor: posting ? "not-allowed" : "pointer",
              opacity: posting ? 0.7 : 1,
            }}>
              {posting ? "投稿中..." : isHelp ? "🆘 助けを求める" : "🌱 複利として記録する"}
            </button>
          </div>
        </div>
      )}

      {/* Profile Edit Modal */}
      {editMode && (
        <div style={{
          position: "fixed", inset: 0, background: "#0006",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 100, padding: 20,
        }} onMouseDown={e => e.target === e.currentTarget && setEditMode(false)}>
          <div style={{
            background: "#f7f5f0", borderRadius: 24,
            padding: "24px 20px 28px", width: "100%", maxWidth: 390,
          }}>
            <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 20, color: "#1a1a1a" }}>
              ✏️ プロフィール編集
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: "#999", marginBottom: 4 }}>アイコン文字（1文字）</div>
                <input value={editAvatar} onChange={e => setEditAvatar(e.target.value)}
                  placeholder="例：北"
                  maxLength={1}
                  style={{
                    width: "100%", padding: "10px 12px", borderRadius: 10,
                    border: "1px solid #e8e2d8", fontSize: 14, outline: "none",
                    background: "#fff", color: "#1a1a1a", boxSizing: "border-box",
                  }} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#999", marginBottom: 4 }}>表示名</div>
                <input value={editName} onChange={e => setEditName(e.target.value)}
                  placeholder="例：北原 健太"
                  style={{
                    width: "100%", padding: "10px 12px", borderRadius: 10,
                    border: "1px solid #e8e2d8", fontSize: 14, outline: "none",
                    background: "#fff", color: "#1a1a1a", boxSizing: "border-box",
                  }} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#999", marginBottom: 4 }}>ハンドル名（@の後ろ）</div>
                <input value={editHandle} onChange={e => setEditHandle(e.target.value)}
                  placeholder="例：kitahara_kenta"
                  style={{
                    width: "100%", padding: "10px 12px", borderRadius: 10,
                    border: "1px solid #e8e2d8", fontSize: 14, outline: "none",
                    background: "#fff", color: "#1a1a1a", boxSizing: "border-box",
                  }} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#999", marginBottom: 4 }}>肩書き</div>
                <input value={editRole} onChange={e => setEditRole(e.target.value)}
                  placeholder="例：営業部長 → 人事マネージャー"
                  style={{
                    width: "100%", padding: "10px 12px", borderRadius: 10,
                    border: "1px solid #e8e2d8", fontSize: 14, outline: "none",
                    background: "#fff", color: "#1a1a1a", boxSizing: "border-box",
                  }} />
              </div>
            </div>
            <button onClick={handleProfileSave} disabled={savingProfile} style={{
              width: "100%", marginTop: 20, padding: "14px",
              background: "#1a1a1a", color: "#f7f5f0",
              border: "none", borderRadius: 12, fontSize: 15,
              fontWeight: 800, cursor: savingProfile ? "not-allowed" : "pointer",
              opacity: savingProfile ? 0.7 : 1,
            }}>
              {savingProfile ? "保存中..." : "保存する"}
            </button>
          </div>
        </div>
      )}

      {/* Badge Modal */}
      {showBadgeModal && (
        <div style={{
          position: "fixed", inset: 0, background: "#0006",
          display: "flex", alignItems: "flex-end", zIndex: 100,
        }} onMouseDown={e => e.target === e.currentTarget && setShowBadgeModal(false)}>
          <div style={{
            background: "#f7f5f0", borderRadius: "24px 24px 0 0",
            padding: "24px 20px 44px", width: "100%", maxWidth: 430, margin: "0 auto",
          }}>
            <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>🌱 称号の成長</div>
            <div style={{ fontSize: 12, color: "#999", marginBottom: 20 }}>支援した数だけ、木が育っていく</div>

            <div style={{ fontSize: 12, color: "#5a8a5a", fontWeight: 700, marginBottom: 10 }}>🌿 メンター称号（支援した数）</div>
            {MENTOR_BADGES.map(b => {
              const active = (myProfile?.mentor_count || 0) >= b.min;
              return (
                <div key={b.id} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 14px", borderRadius: 12, marginBottom: 8,
                  background: active ? "#f0f7f0" : "#fff",
                  border: `1px solid ${active ? "#c8dfc8" : "#e8e2d8"}`,
                  opacity: active ? 1 : 0.5,
                }}>
                  <span style={{ fontSize: 24 }}>{b.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: active ? "#3d6b3d" : "#aaa" }}>{b.label}</div>
                    <div style={{ fontSize: 11, color: "#aaa" }}>{b.desc}</div>
                  </div>
                  {active && <span style={{ fontSize: 11, color: "#5a8a5a", fontWeight: 700 }}>✓ 達成</span>}
                </div>
              );
            })}

            <div style={{ fontSize: 12, color: "#c8956a", fontWeight: 700, margin: "16px 0 10px" }}>🌸 感謝称号</div>
            {GRATITUDE_BADGES.map(b => {
              const active = (myProfile?.gratitude_count || 0) >= b.min;
              return (
                <div key={b.id} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 14px", borderRadius: 12, marginBottom: 8,
                  background: active ? "#fff8f0" : "#fff",
                  border: `1px solid ${active ? "#f0d8b8" : "#e8e2d8"}`,
                  opacity: active ? 1 : 0.5,
                }}>
                  <span style={{ fontSize: 24 }}>{b.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: active ? "#8b5e3c" : "#aaa" }}>{b.label}</div>
                    <div style={{ fontSize: 11, color: "#aaa" }}>{b.desc}</div>
                  </div>
                  {active && <span style={{ fontSize: 11, color: "#c8956a", fontWeight: 700 }}>✓ 達成</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Bottom Nav */}
      <div style={{
        position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
        width: "100%", maxWidth: 430,
        background: "#f7f5f0ee", backdropFilter: "blur(16px)",
        borderTop: "1px solid #e8e2d8",
        display: "flex", justifyContent: "space-around",
        padding: "8px 0 20px", zIndex: 20,
      }}>
        {[
          { icon: "⊞", tabIdx: 0, isPost: false, disabled: false },
          { icon: "🆘", tabIdx: 1, isPost: false, disabled: false },
          { icon: "＋", tabIdx: null, isPost: true, disabled: false },
          { icon: "🔔", tabIdx: null, isPost: false, disabled: true },
          { icon: "○", tabIdx: 2, isPost: false, disabled: false },
        ].map((item, i) => (
          <button key={i}
            onClick={() => {
              if (item.disabled) return;
              if (item.isPost) setShowModal(true);
              else if (item.tabIdx !== null) setActiveTab(item.tabIdx);
            }}
            style={{
              background: item.isPost ? "#1a1a1a" : "none",
              border: "none", cursor: item.disabled ? "default" : "pointer",
              color: item.isPost ? "#fff" : item.disabled ? "#ddd" : (activeTab === item.tabIdx ? "#3d6b3d" : "#bbb"),
              fontSize: item.isPost ? 20 : 18,
              width: item.isPost ? 48 : 40, height: item.isPost ? 48 : 40,
              borderRadius: item.isPost ? "50%" : 8,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 700, marginTop: item.isPost ? -14 : 0,
              transition: "all 0.2s",
            }}>{item.icon}</button>
        ))}
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:translateY(0); } }
      `}</style>
    </div>
  );
}
