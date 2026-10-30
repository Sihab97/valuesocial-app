
"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";

type ChatUser = {
  id: string;
  name: string;
  username: string;
  image: string | null;
};

type Message = {
  id: string;
  content: string;
  createdAt: string;
  readAt: string | null;
  senderId: string;
  sender: ChatUser;
};

type Conversation = {
  id: string;
  otherUser: ChatUser;
  lastMessage: {
    content: string;
    createdAt: string;
    senderId: string;
    readAt: string | null;
  } | null;
  unreadCount: number;
};

type SearchUser = ChatUser & {
  bio: string | null;
};

export default function MessagesPage() {
  const { data: session, status } = useSession();

  const currentUser = session?.user as
    | { id?: string }
    | undefined;

  const currentUserId = currentUser?.id;

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<ChatUser | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState("");

  const selectedConversation = conversations.find(
    (conversation) => conversation.id === selectedId
  );

  const activeUser = selectedConversation?.otherUser || selectedUser;

  const loadConversations = useCallback(async () => {
    try {
      const response = await fetch("/api/messages");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to load conversations.");
      }

      setConversations(data.conversations || []);
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Unable to load messages."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMessages = useCallback(async (conversationId: string) => {
    try {
      const response = await fetch(
        `/api/messages?conversationId=${encodeURIComponent(conversationId)}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to load chat.");
      }

      setMessages(data.messages || []);

      const readResponse = await fetch("/api/messages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId }),
      });

      if (readResponse.ok) {
        // Refresh unread counts after marking this conversation as read.
        await loadConversations();
      }

    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Unable to load chat."
      );
    }
  }, [loadConversations]);

  useEffect(() => {
    if (!currentUserId) return;

    loadConversations();

    const interval = window.setInterval(loadConversations, 5000);

    return () => window.clearInterval(interval);
  }, [currentUserId, loadConversations]);

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }

    setLoadingMessages(true);

    loadMessages(selectedId).finally(() => {
      setLoadingMessages(false);
    });

    const interval = window.setInterval(() => {
      loadMessages(selectedId);
    }, 3000);

    return () => window.clearInterval(interval);
  }, [selectedId, loadMessages]);

  // Search users to start a new conversation
  useEffect(() => {
    const query = search.trim();

    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    const controller = new AbortController();

    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(query)}`,
          { signal: controller.signal }
        );

        const data = await response.json();

        if (response.ok) {
          setSearchResults(
            (data as SearchUser[]).filter(
              (user) => user.id !== currentUserId
            )
          );
        }
      } catch (error) {
        if (error instanceof Error && error.name !== "AbortError") {
          console.error("User search failed:", error);
        }
      }
    }, 400);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [search, currentUserId]);

  const handleSelectUser = (user: ChatUser) => {
    const existing = conversations.find(
      (conversation) => conversation.otherUser.id === user.id
    );

    setNotice("");
    setSelectedUser(user);
    setSearch("");
    setSearchResults([]);

    if (existing) {
      setSelectedId(existing.id);
    } else {
      setSelectedId("");
      setMessages([]);
    }
  };

  const handleSendMessage = async () => {
    const content = newMessage.trim();

    if (!content || !activeUser || sending) return;

    setSending(true);
    setNotice("");

    try {
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientId: activeUser.id,
          content,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to send message.");
      }

      setNewMessage("");
      setSelectedUser(activeUser);
      setSelectedId(data.conversationId);

      await loadConversations();

      if (data.message) {
        setMessages((previous) => {
          if (previous.some((message) => message.id === data.message.id)) {
            return previous;
          }

          return [...previous, data.message];
        });
      }
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Unable to send message."
      );
    } finally {
      setSending(false);
    }
  };

  const formatMessageTime = (date: string) =>
    new Date(date).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

  const formatLastMessageTime = (date: string) =>
    new Date(date).toLocaleDateString([], {
      month: "short",
      day: "numeric",
    });

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        Loading...
      </div>
    );
  }

  if (!currentUserId) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Please login to access messages.</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 p-3 dark:bg-gray-950 sm:p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-5">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Messages
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Connect and communicate with your community.
          </p>
        </div>

        {notice && (
          <div className="mb-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-700">
            {notice}
          </div>
        )}

        <div className="grid min-h-[650px] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900 md:grid-cols-[320px_1fr]">

          {/* Conversation Sidebar */}
          <aside className={`border-r border-gray-200 dark:border-gray-800 ${
            selectedId || selectedUser ? "hidden md:block" : "block"
          }`}>
            <div className="border-b border-gray-200 p-4 dark:border-gray-800">
              <h2 className="mb-3 font-bold text-gray-900 dark:text-white">
                Your Conversations
              </h2>

              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search people..."
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />

              {searchResults.length > 0 && (
                <div className="mt-2 max-h-52 overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-700">
                  {searchResults.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => handleSelectUser(user)}
                      className="flex w-full items-center gap-3 p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      <Avatar user={user} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold dark:text-white">
                          {user.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          @{user.username}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {search.trim().length >= 2 && searchResults.length === 0 && (
                <p className="mt-2 text-xs text-gray-500">
                  No users found. Try another search.
                </p>
              )}
            </div>

            <div className="max-h-[520px] overflow-y-auto">
              {loading ? (
                <p className="p-6 text-center text-sm text-gray-500">
                  Loading conversations...
                </p>
              ) : conversations.length === 0 ? (
                <p className="p-6 text-center text-sm text-gray-500">
                  No conversations yet. Search for a user to start chatting.
                </p>
              ) : (
                conversations.map((conversation) => (
                  <button
                    key={conversation.id}
                    onClick={() => {
                      setSelectedUser(conversation.otherUser);
                      setSelectedId(conversation.id);
                    }}
                    className={`flex w-full items-center gap-3 border-b border-gray-100 p-4 text-left transition dark:border-gray-800 ${
                      selectedId === conversation.id
                        ? "bg-indigo-50 dark:bg-gray-800"
                        : "hover:bg-gray-50 dark:hover:bg-gray-800"
                    }`}
                  >
                    <Avatar user={conversation.otherUser} />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className={`truncate text-sm ${
                          conversation.unreadCount > 0
                            ? "font-extrabold text-gray-900 dark:text-white"
                            : "font-bold text-gray-900 dark:text-white"
                        }`}>
                          {conversation.otherUser.name}
                        </p>

                        {conversation.unreadCount > 0 && (
                          <span
                            className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 px-1.5 text-[10px] font-bold text-white"
                            aria-label={`${conversation.unreadCount} unread messages`}
                          >
                            {conversation.unreadCount > 99
                              ? "99+"
                              : conversation.unreadCount}
                          </span>
                        )}
                      </div>

                      <p className={`mt-1 truncate text-xs ${
                        conversation.unreadCount > 0
                          ? "font-semibold text-gray-700 dark:text-gray-200"
                          : "text-gray-500"
                      }`}>
                        {conversation.lastMessage?.content || "Start chatting"}
                      </p>
                    </div>

                    {conversation.lastMessage && (
                      <span className="shrink-0 text-[10px] text-gray-400">
                        {formatLastMessageTime(
                          conversation.lastMessage.createdAt
                        )}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          </aside>

          {/* Chat Window */}
          <section className={`flex min-h-[650px] flex-col ${
            selectedId || selectedUser ? "flex" : "hidden md:flex"
          }`}>
            {activeUser ? (
              <>
                <div className="flex items-center gap-3 border-b border-gray-200 p-4 dark:border-gray-800">
                  <button
                    onClick={() => {
                      setSelectedId("");
                      setSelectedUser(null);
                    }}
                    className="mr-1 text-xl text-gray-500 md:hidden"
                    aria-label="Back to conversations"
                  >
                    ←
                  </button>

                  <Avatar user={activeUser} />

                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white">
                      {activeUser.name}
                    </h3>
                    <p className="text-xs text-gray-500">
                      @{activeUser.username}
                    </p>
                  </div>
                </div>

                <div className="flex flex-1 flex-col gap-3 overflow-y-auto bg-gray-50 p-4 dark:bg-gray-950">
                  {loadingMessages ? (
                    <p className="m-auto text-sm text-gray-500">
                      Loading messages...
                    </p>
                  ) : messages.length === 0 ? (
                    <div className="m-auto text-center">
                      <div className="mb-3 text-4xl">💬</div>
                      <p className="font-semibold text-gray-700 dark:text-white">
                        Start a conversation
                      </p>
                      <p className="mt-1 text-sm text-gray-500">
                        Send your first message to {activeUser.name}.
                      </p>
                    </div>
                  ) : (
                    messages.map((message) => {
                      const isMine = message.senderId === currentUserId;

                      return (
                        <div
                          key={message.id}
                          className={`flex ${
                            isMine ? "justify-end" : "justify-start"
                          }`}
                        >
                          <div
                            className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                              isMine
                                ? "rounded-br-sm bg-indigo-600 text-white"
                                : "rounded-bl-sm bg-white text-gray-800 shadow-sm dark:bg-gray-800 dark:text-white"
                            }`}
                          >
                            <p className="whitespace-pre-wrap break-words text-sm leading-6">
                              {message.content}
                            </p>

                            <div className={`mt-1 flex items-center justify-end gap-2 text-[10px] ${
                              isMine ? "text-indigo-100" : "text-gray-400"
                            }`}>
                              {formatMessageTime(message.createdAt)}
                              {isMine && (
                                <span>{message.readAt ? "✓✓ Read" : "✓ Sent"}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="border-t border-gray-200 p-4 dark:border-gray-800">
                  <div className="flex items-center gap-2">
                    <input
                      value={newMessage}
                      onChange={(event) => setNewMessage(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      maxLength={2000}
                      placeholder="Type your message..."
                      className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />

                    <button
                      onClick={handleSendMessage}
                      disabled={!newMessage.trim() || sending}
                      className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {sending ? "Sending..." : "Send"}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
                <div className="mb-4 text-6xl">💬</div>
                <h2 className="text-xl font-bold text-gray-800 dark:text-white">
                  Welcome to ValueSocial Messages
                </h2>
                <p className="mt-2 max-w-sm text-sm text-gray-500">
                  Select a conversation or search for a user to start a private chat.
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function Avatar({ user }: { user: ChatUser }) {
  if (user.image) {
    return (
      <img
        src={user.image}
        alt={user.name}
        className="h-11 w-11 shrink-0 rounded-full object-cover"
      />
    );
  }

  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-indigo-100 font-bold text-indigo-700">
      {user.name?.charAt(0).toUpperCase() || "U"}
    </div>
  );
}
