
"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";

type Post = {
  id: string;
  authorId: string;
  name: string;
  username: string;
  initials: string;
  image: string | null;
  color: string;
  time: string;
  content: string;
  likes: number;
  comments: number;
  liked: boolean;
  tag: string;
};

type ApiPost = {
  id: string;
  content: string;
  createdAt: string;
  author: {
    id: string;
    name: string;
    username: string;
    image: string | null;
  };
  _count: {
    likes: number;
    comments: number;
  };
};

type ApiComment = {
  id: string;
  content: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
    username: string;
    image: string | null;
  };
};


const avatarColors = [
  "bg-violet-100 text-violet-700",
  "bg-rose-100 text-rose-700",
  "bg-emerald-100 text-emerald-700",
  "bg-indigo-100 text-indigo-700",
];

function formatPostTime(dateString: string) {
  const elapsed = Math.max(
    0,
    Date.now() - new Date(dateString).getTime(),
  );

  const minutes = Math.floor(elapsed / 60000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }

  const days = Math.floor(hours / 24);

  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function mapApiPost(apiPost: ApiPost, index: number): Post {
  const name = apiPost.author.name;

  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return {
    id: apiPost.id,
    authorId: apiPost.author.id,
    name,
    username: `@${apiPost.author.username}`,
    initials: initials || "U",
    image: apiPost.author.image,
    color: avatarColors[index % avatarColors.length],
    time: formatPostTime(apiPost.createdAt),
    content: apiPost.content,
    likes: apiPost._count.likes,
    comments: apiPost._count.comments,
    liked: false,
    tag: "Community",
  };
}

const navItems = [
  { icon: "⌂", label: "Home" },
  { icon: "⌕", label: "Search" },
  { icon: "♡", label: "Notifications" },
  { icon: "✉", label: "Messages" },
];

export default function Home() {
  const router = useRouter();
  const { data: session } = useSession();

  const currentUser = session?.user as
    | {
        id: string;
        name?: string | null;
        email?: string | null;
        username?: string;
      }
    | undefined;

  const currentUserId = currentUser?.id;

  const currentUserName = currentUser?.name || "User";

  const currentUsername = currentUser?.username || "";

  const initials = currentUserName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  const [posts, setPosts] = useState<Post[]>([]);
  const [followingUsers, setFollowingUsers] = useState<Record<string, boolean>>({});
  const [followLoadingUsers, setFollowLoadingUsers] = useState<Record<string, boolean>>({});
  const [currentUserImage, setCurrentUserImage] = useState<string | null>(null);
  const [openCommentsPostId, setOpenCommentsPostId] = useState<string | null>(null);
  const [comments, setComments] = useState<ApiComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [isPublishing, setIsPublishing] = useState(false);
  const [newPost, setNewPost] = useState("");
  const [search, setSearch] = useState("");
  const [activeNav, setActiveNav] = useState("Home");
  const [timerRunning, setTimerRunning] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [notice, setNotice] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);

  // Load the logged-in user's profile picture.
  useEffect(() => {
    let cancelled = false;

    async function loadCurrentProfile() {
      try {
        const response = await fetch("/api/profile");
        if (!response.ok) return;

        const data = await response.json();
        if (!cancelled) {
          setCurrentUserImage(data.user?.image ?? null);
        }
      } catch (error) {
        console.error("Failed to load profile image:", error);
      }
    }

    loadCurrentProfile();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load unread message count and refresh it every 5 seconds.
  useEffect(() => {
    let cancelled = false;

    async function loadUnreadMessageCount() {
      try {
        const response = await fetch("/api/messages");
        if (!response.ok) return;

        const data = await response.json();
        if (!cancelled) {
          setUnreadMessageCount(
            typeof data.unreadCount === "number" ? data.unreadCount : 0,
          );
        }
      } catch (error) {
        console.error("Failed to load unread message count:", error);
      }
    }

    loadUnreadMessageCount();
    const interval = window.setInterval(loadUnreadMessageCount, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  // Load unread notification count and refresh it every 30 seconds.
  useEffect(() => {
    let cancelled = false;

    async function loadUnreadCount() {
      try {
        const response = await fetch("/api/notifications");
        if (!response.ok) return;

        const data = await response.json();
        if (!cancelled) {
          setUnreadCount(
            typeof data.unreadCount === "number" ? data.unreadCount : 0,
          );
        }
      } catch (error) {
        console.error("Failed to load notification count:", error);
      }
    }

    loadUnreadCount();
    const interval = window.setInterval(loadUnreadCount, 30000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  // Load posts from the database.
  useEffect(() => {
    let cancelled = false;

    async function loadPosts() {
      try {
        const response = await fetch("/api/posts");

        if (!response.ok) {
          throw new Error("Could not load posts.");
        }

        const data: { posts: ApiPost[] } = await response.json();

        if (!cancelled) {
          setPosts(
            data.posts.map((post, index) =>
              mapApiPost(post, index),
            ),
          );
        }
      } catch (error) {
        console.error("Failed to load posts:", error);

        if (!cancelled) {
          setNotice(
            "Posts could not be loaded. Please refresh the page.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingPosts(false);
        }
      }
    }

    loadPosts();

    return () => {
      cancelled = true;
    };
  }, []);

  // Open a specific post when arriving from a notification.
  useEffect(() => {
    if (loadingPosts || posts.length === 0) return;

    const params = new URLSearchParams(window.location.search);
    const postId = params.get("postId");

    if (!postId) return;

    const postExists = posts.some((post) => post.id === postId);

    if (postExists) {
      window.requestAnimationFrame(() => {
        document
          .getElementById(`post-${postId}`)
          ?.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
      });
    }
  }, [loadingPosts, posts]);

  // Load follow status for the authors shown in the feed.
  const feedAuthorIds = Array.from(
    new Set(posts.map((post) => post.authorId).filter((id) => id !== currentUserId)),
  ).join(",");

  useEffect(() => {
    if (!currentUserId || !feedAuthorIds) return;

    let cancelled = false;

    async function loadFollowStatuses() {
      const authorIds = feedAuthorIds.split(",");

      await Promise.all(
        authorIds.map(async (userId) => {
          try {
            const response = await fetch(
              `/api/follow?userId=${encodeURIComponent(userId)}`,
            );
            if (!response.ok) return;

            const data = await response.json();
            if (!cancelled) {
              setFollowingUsers((previous) => ({
                ...previous,
                [userId]: Boolean(data.isFollowing ?? data.following),
              }));
            }
          } catch (error) {
            console.error("Failed to load follow status:", error);
          }
        }),
      );
    }

    loadFollowStatuses();

    return () => {
      cancelled = true;
    };
  }, [currentUserId, feedAuthorIds]);

  // Follow or unfollow a post author.
  const handleFollow = async (userId: string) => {
    if (!currentUserId) {
      setNotice("Please login to follow people.");
      return;
    }

    setFollowLoadingUsers((previous) => ({ ...previous, [userId]: true }));
    setNotice("");

    try {
      const response = await fetch("/api/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });

      const data = await response.json();

      if (!response.ok || typeof data.following !== "boolean") {
        throw new Error(data.error || "Unable to update follow status.");
      }

      setFollowingUsers((previous) => ({
        ...previous,
        [userId]: data.following,
      }));
      setNotice(data.following ? "You are now following this user." : "You unfollowed this user.");
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Unable to update follow status.",
      );
    } finally {
      setFollowLoadingUsers((previous) => ({ ...previous, [userId]: false }));
    }
  };

  // Focus timer.
  useEffect(() => {
    if (!timerRunning) return;

    const interval = window.setInterval(() => {
      setSeconds((previous) => previous + 1);
    }, 1000);

    return () => window.clearInterval(interval);
  }, [timerRunning]);

  const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;

    return [hours, minutes, secs]
      .map((number) => String(number).padStart(2, "0"))
      .join(":");
  };

  // Publish a post to PostgreSQL.
  const handleCreatePost = async () => {
    if (!currentUserId) {
  setNotice("Please login to create a post.");
  return;
}
    const content = newPost.trim();

    if (!content) {
      setNotice("Please write something before posting.");
      return;
    }

    if (content.length > 2000) {
      setNotice("Post content cannot exceed 2000 characters.");
      return;
    }

    setIsPublishing(true);
    setNotice("");

    try {
      const response = await fetch("/api/posts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content,
          authorId: currentUserId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to publish your post.",
        );
      }

      const createdPost = mapApiPost(data.post as ApiPost, 0);

      setPosts((previous) => [createdPost, ...previous]);
      setNewPost("");
      setNotice("Your post has been saved to the database.");
    } catch (error) {
      console.error("Failed to publish post:", error);

      setNotice(
        error instanceof Error
          ? error.message
          : "Unable to publish your post.",
      );
    } finally {
      setIsPublishing(false);
    }
  };

  // Load comments for a selected post.
  const handleOpenComments = async (postId: string) => {
    if (openCommentsPostId === postId) {
      setOpenCommentsPostId(null);
      setComments([]);
      setNewComment("");
      return;
    }

    setOpenCommentsPostId(postId);
    setComments([]);
    setLoadingComments(true);
    setNewComment("");
    setNotice("");

    try {
      const response = await fetch(
        `/api/comments?postId=${encodeURIComponent(postId)}`,
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to load comments.");
      }

      setComments(data.comments as ApiComment[]);
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Unable to load comments.",
      );
    } finally {
      setLoadingComments(false);
    }
  };

  // Save a new comment to the database.
  const handleCreateComment = async (postId: string) => {
    if (!currentUserId) {
  setNotice("Please login to comment.");
  return;
}
    const content = newComment.trim();

    if (!content) {
      setNotice("Please write a comment first.");
      return;
    }

    setSubmittingComment(true);
    setNotice("");

    try {
      const response = await fetch("/api/comments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: currentUserId,
          postId,
          content,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to add comment.");
      }

      setComments((previous) => [...previous, data.comment as ApiComment]);
      setNewComment("");

      setPosts((previous) =>
        previous.map((post) =>
          post.id === postId
            ? { ...post, comments: post.comments + 1 }
            : post,
        ),
      );

      setNotice("Comment added successfully!");
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Unable to add comment.",
      );
    } finally {
      setSubmittingComment(false);
    }
  };

  // Like or unlike a post using the API.
  const handleLike = async (id: string) => {
    if (!currentUserId) {
  setNotice("Please login to like a post.");
  return;
}
    setNotice("");

    try {
      const response = await fetch("/api/likes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: currentUserId,
          postId: id,
        }),
      });

      const data: { liked?: boolean; error?: string } =
        await response.json();

      if (!response.ok || typeof data.liked !== "boolean") {
        setNotice(data.error || "Unable to update like.");
        return;
      }

      setPosts((previous) =>
        previous.map((post) =>
          post.id === id
            ? {
                ...post,
                liked: data.liked as boolean,
                likes: Math.max(
                  0,
                  post.likes + (data.liked ? 1 : -1),
                ),
              }
            : post,
        ),
      );

      setNotice(data.liked ? "Post liked!" : "Like removed.");
    } catch (error) {
      console.error("Failed to update like:", error);
      setNotice("Could not connect to the server. Please try again.");
    }
  };

  // Search posts.
  const filteredPosts = posts.filter((post) => {
    const query = search.toLowerCase();

    return (
      post.content.toLowerCase().includes(query) ||
      post.name.toLowerCase().includes(query) ||
      post.tag.toLowerCase().includes(query)
    );
  });

  return (
    <main className="min-h-screen bg-[#f7f8fc] text-slate-800">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-[72px] max-w-[1400px] items-center justify-between gap-4 px-4 sm:px-6">
          <a href="#" className="flex shrink-0 items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-xl font-black text-white">
              V
            </span>

            <span className="text-2xl font-extrabold tracking-tight text-slate-900">
              Value<span className="text-indigo-600">Social</span>
            </span>
          </a>

          <div className="hidden w-full max-w-md md:block">
            <label className="flex items-center gap-3 rounded-xl bg-slate-100 px-4 py-3">
              <span className="text-xl text-slate-400">⌕</span>

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search people, posts and ideas..."
                className="w-full bg-transparent text-sm outline-none"
              />
            </label>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={() => router.push("/profile")}
              className="flex items-center gap-2 rounded-full border border-slate-200 p-1.5 pr-3 hover:bg-slate-50"
            >
              {currentUserImage ? (
                <img
                  src={currentUserImage}
                  alt="Profile"
                  className="h-9 w-9 rounded-full object-cover"
                />
              ) : (
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">
                  {initials || "U"}
                </span>
              )}

              <span className="hidden text-sm font-semibold sm:inline">
                {currentUserName}
              </span>
            </button>

            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-100"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[230px_minmax(0,1fr)_290px]">
        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-5">
            <nav className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
              {navItems.map((item) => (
                <button
                  key={item.label}
                  onClick={() => {
                    setActiveNav(item.label);

                    if (item.label === "Notifications") {
                      router.push("/notifications");
                    } else if (item.label === "Search") {
                      router.push("/search");
                    } else if (item.label === "Messages") {
                      router.push("/messages");
                    } else {
                      setNotice("");
                    }
                  }}
                  className={`mb-1 flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold transition ${
                    activeNav === item.label
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <span className="relative w-6 text-center text-xl">
                    {item.icon}
                    {item.label === "Notifications" && unreadCount > 0 && (
                      <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white">
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </span>
                    )}
                    {item.label === "Messages" && unreadMessageCount > 0 && (
                      <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-600 px-1 text-[10px] font-bold leading-none text-white">
                        {unreadMessageCount > 99 ? "99+" : unreadMessageCount}
                      </span>
                    )}
                  </span>

                  {item.label}
                </button>
              ))}
            </nav>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                Our principle
              </p>

              <h3 className="mt-3 text-lg font-bold leading-7 text-slate-900">
                Value per minute, not minutes per user.
              </h3>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                Spend your time discovering ideas that matter.
              </p>

              <div className="mt-4 h-1.5 rounded-full bg-indigo-100">
                <div className="h-1.5 w-2/3 rounded-full bg-indigo-600" />
              </div>
            </div>

            <p className="px-2 text-xs leading-6 text-slate-400">
              About · Community Guidelines · Privacy
              <br />
              © 2026 ValueSocial
            </p>
          </div>
        </aside>

        <section className="min-w-0 space-y-5">
          <div className="rounded-2xl bg-gradient-to-r from-indigo-700 via-indigo-600 to-violet-600 p-6 text-white shadow-sm sm:p-8">
            <p className="text-sm font-semibold text-indigo-100">
              YOUR COMMUNITY, YOUR GROWTH
            </p>

            <h1 className="mt-3 max-w-xl text-3xl font-extrabold leading-tight sm:text-4xl">
              Discover ideas.
              <br />
              Share real value.
            </h1>

            <p className="mt-3 max-w-lg text-sm leading-6 text-indigo-100 sm:text-base">
              A space to share knowledge, learn from people, and make every
              minute meaningful.
            </p>

            <button
              onClick={() =>
                document.getElementById("create-post")?.focus()
              }
              className="mt-5 rounded-xl bg-white px-5 py-3 text-sm font-bold text-indigo-700 transition hover:bg-indigo-50"
            >
              + Share something valuable
            </button>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-start gap-3">
              {currentUserImage ? (
                <img
                  src={currentUserImage}
                  alt="Your profile"
                  className="h-11 w-11 shrink-0 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-indigo-100 font-bold text-indigo-700">
                  {initials || "U"}
                </div>
              )}

              <div className="min-w-0 flex-1">
                <h2 className="font-bold text-slate-900">Create a post</h2>

                <p className="mt-1 text-xs text-slate-500">
                  Share a useful idea with your community.
                </p>

                <textarea
                  id="create-post"
                  value={newPost}
                  onChange={(event) => setNewPost(event.target.value)}
                  placeholder="What valuable idea would you like to share?"
                  rows={3}
                  maxLength={2000}
                  className="mt-4 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />

                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs text-slate-400">
                    {newPost.length}/2000 characters
                  </span>

                  <button
                    onClick={handleCreatePost}
                    disabled={isPublishing}
                    className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isPublishing ? "Publishing..." : "Publish post"}
                  </button>
                </div>

                {notice && (
                  <p
                    aria-live="polite"
                    className="mt-3 text-sm text-indigo-700"
                  >
                    {notice}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900">
                Your feed
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Ideas from your community
              </p>
            </div>

            <span className="rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700">
              {filteredPosts.length} posts
            </span>
          </div>

          {loadingPosts && (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
              Loading posts from the database...
            </div>
          )}

          {!loadingPosts && filteredPosts.length === 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
              <p className="font-semibold text-slate-700">No posts found</p>

              <p className="mt-2 text-sm text-slate-500">
                Try a different search or publish a new post.
              </p>
            </div>
          )}

          {filteredPosts.map((post) => (
            <article
              id={`post-${post.id}`}
              key={post.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md sm:p-6"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  {post.image ? (
                    <img
                      src={post.image}
                      alt={post.name}
                      className="h-11 w-11 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-extrabold ${post.color}`}
                    >
                      {post.initials}
                    </div>
                  )}

                  <div className="min-w-0">
                    <h3 className="truncate font-bold text-slate-900">
                      {post.name}
                    </h3>

                    <p className="mt-0.5 text-xs text-slate-500">
                      {post.username} · {post.time}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {post.authorId !== currentUserId && (
                    <button
                      onClick={() => handleFollow(post.authorId)}
                      disabled={Boolean(followLoadingUsers[post.authorId])}
                      aria-pressed={Boolean(followingUsers[post.authorId])}
                      className={`rounded-full px-3 py-1.5 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                        followingUsers[post.authorId]
                          ? "border border-slate-200 bg-white text-slate-600 hover:bg-rose-50 hover:text-rose-600"
                          : "bg-indigo-600 text-white hover:bg-indigo-700"
                      }`}
                    >
                      {followLoadingUsers[post.authorId]
                        ? "Please wait..."
                        : followingUsers[post.authorId]
                          ? "Following"
                          : "Follow"}
                    </button>
                  )}
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                    {post.tag}
                  </span>
                </div>
              </div>

              <p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-slate-700 sm:text-base">
                {post.content}
              </p>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                <button
                  onClick={() => handleLike(post.id)}
                  aria-pressed={post.liked}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                    post.liked
                      ? "bg-rose-50 text-rose-600"
                      : "text-slate-500 hover:bg-slate-50 hover:text-rose-600"
                  }`}
                >
                  <span className="text-lg">
                    {post.liked ? "♥" : "♡"}
                  </span>

                  {post.likes} Likes
                </button>

                <button
                  onClick={() => handleOpenComments(post.id)}
                  aria-expanded={openCommentsPostId === post.id}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-indigo-600"
                >
                  <span className="text-lg">▢</span>
                  {post.comments} Comments
                </button>

                <button
                  onClick={() =>
                    setNotice(
                      "Save post functionality will be added in a future stage.",
                    )
                  }
                  className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-indigo-600"
                >
                  ♧ Save
                </button>
              </div>

              {openCommentsPostId === post.id && (
                <div className="mt-4 border-t border-slate-100 pt-4">
                  <h4 className="font-bold text-slate-900">Comments</h4>

                  {loadingComments ? (
                    <p className="mt-3 text-sm text-slate-500">
                      Loading comments...
                    </p>
                  ) : comments.length === 0 ? (
                    <p className="mt-3 text-sm text-slate-500">
                      No comments yet. Be the first to comment.
                    </p>
                  ) : (
                    <div className="mt-3 space-y-3">
                      {comments.map((comment) => (
                        <div
                          key={comment.id}
                          className="rounded-xl bg-slate-50 p-3"
                        >
                          <div className="flex items-start gap-3">
                            {comment.user.image ? (
                              <img
                                src={comment.user.image}
                                alt={comment.user.name}
                                className="h-9 w-9 shrink-0 rounded-full object-cover"
                              />
                            ) : (
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                                {comment.user.name
                                  .split(" ")
                                  .filter(Boolean)
                                  .slice(0, 2)
                                  .map((part) => part[0])
                                  .join("")
                                  .toUpperCase() || "U"}
                              </div>
                            )}

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-slate-800">
                                    {comment.user.name}
                                  </p>
                                  <p className="text-xs text-slate-500">
                                    @{comment.user.username}
                                  </p>
                                </div>
                                <p className="text-xs text-slate-400">
                                  {formatPostTime(comment.createdAt)}
                                </p>
                              </div>

                              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                                {comment.content}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <input
                      value={newComment}
                      onChange={(event) => setNewComment(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          handleCreateComment(post.id);
                        }
                      }}
                      maxLength={1000}
                      placeholder="Write a comment..."
                      className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    />
                    <button
                      onClick={() => handleCreateComment(post.id)}
                      disabled={submittingComment || !newComment.trim()}
                      className="rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {submittingComment ? "Sending..." : "Comment"}
                    </button>
                  </div>
                </div>
              )}
            </article>
          ))}
        </section>

        <aside className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="font-extrabold text-slate-900">Focus session</h2>

              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                {timerRunning ? "Active" : "Ready"}
              </span>
            </div>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Make your time count. Focus on content that adds value.
            </p>

            <div className="my-5 rounded-xl bg-indigo-50 px-4 py-6 text-center">
              <p className="text-xs font-bold uppercase tracking-widest text-indigo-500">
                Session time
              </p>

              <p className="mt-2 font-mono text-3xl font-extrabold tracking-wider text-indigo-800">
                {formatTime(seconds)}
              </p>
            </div>

            <button
              onClick={() => setTimerRunning((previous) => !previous)}
              className={`w-full rounded-xl px-4 py-3 text-sm font-bold transition ${
                timerRunning
                  ? "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  : "bg-indigo-600 text-white hover:bg-indigo-700"
              }`}
            >
              {timerRunning ? "Pause session" : "Start focus session"}
            </button>

            <button
              onClick={() => {
                setTimerRunning(false);
                setSeconds(0);
              }}
              className="mt-2 w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-500 hover:bg-slate-50"
            >
              Reset timer
            </button>

            <p className="mt-3 text-xs leading-5 text-slate-400">
              Demo timer only. Usage is not yet saved to a database.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-extrabold text-slate-900">
              Trending topics
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Explore what people are sharing
            </p>

            <div className="mt-4 space-y-4">
              {[
                ["#Learning", "Education"],
                ["#Technology", "Innovation"],
                ["#Productivity", "Personal growth"],
                ["#Ideas", "Community"],
              ].map(([topic, description]) => (
                <button
                  key={topic}
                  onClick={() => setSearch(topic.replace("#", ""))}
                  className="block w-full text-left"
                >
                  <p className="text-sm font-bold text-indigo-700 hover:text-indigo-900">
                    {topic}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    {description}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-slate-900 p-5 text-white">
            <span className="text-2xl">✦</span>

            <h2 className="mt-3 text-lg font-extrabold">
              Make it meaningful
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-300">
              Share knowledge. Respect others. Choose value over endless
              scrolling.
            </p>
          </div>
        </aside>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-slate-200 bg-white px-2 py-2 lg:hidden">
        {navItems.map((item) => (
          <button
            key={item.label}
            onClick={() => {
              setActiveNav(item.label);

              if (item.label === "Notifications") {
                router.push("/notifications");
              } else if (item.label === "Search") {
                router.push("/search");
              } else if (item.label === "Messages") {
                router.push("/messages");
              } else {
                setNotice("");
              }

              window.scrollTo({
                top: 0,
                behavior: "smooth",
              });
            }}
            className={`flex flex-col items-center gap-1 rounded-lg py-1 text-xs font-semibold ${
              activeNav === item.label
                ? "text-indigo-700"
                : "text-slate-500"
            }`}
          >
            <span className="relative text-xl">
              {item.icon}
              {item.label === "Notifications" && unreadCount > 0 && (
                <span className="absolute -right-3 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
              {item.label === "Messages" && unreadMessageCount > 0 && (
                <span className="absolute -right-3 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-600 px-1 text-[10px] font-bold leading-none text-white">
                  {unreadMessageCount > 99 ? "99+" : unreadMessageCount}
                </span>
              )}
            </span>
            {item.label}
          </button>
        ))}
      </nav>

      <div className="h-20 lg:hidden" />
    </main>
  );
}
