
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Notification = {
  id: string;
  type: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  actor: {
    id: string;
    name: string;
    username: string;
    image: string | null;
  };
  post: {
    id: string;
    content: string;
  } | null;
};

export default function NotificationsPage() {
  const router = useRouter();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Fetch notifications
  const fetchNotifications = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/notifications");

      if (response.status === 401) {
        router.push("/login");
        return;
      }

      if (!response.ok) {
        throw new Error("Unable to load notifications.");
      }

      const data = await response.json();

      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (err) {
      console.error(err);
      setError("Failed to load notifications. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  // Mark one notification as read
  const markAsRead = async (notificationId: string) => {
    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ notificationId }),
      });

      if (!response.ok) {
        throw new Error("Unable to update notification.");
      }

      setNotifications((previous) =>
        previous.map((notification) =>
          notification.id === notificationId
            ? { ...notification, isRead: true }
            : notification
        )
      );

      setUnreadCount((previous) => Math.max(0, previous - 1));
    } catch (err) {
      console.error(err);
      alert("Unable to mark notification as read.");
    }
  };

  // Mark all notifications as read
  const markAllAsRead = async () => {
    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ markAllRead: true }),
      });

      if (!response.ok) {
        throw new Error("Unable to update notifications.");
      }

      setNotifications((previous) =>
        previous.map((notification) => ({
          ...notification,
          isRead: true,
        }))
      );

      setUnreadCount(0);
    } catch (err) {
      console.error(err);
      alert("Unable to mark all notifications as read.");
    }
  };

  // Open notification destination
  const openNotification = async (notification: Notification) => {
    if (!notification.isRead) {
      await markAsRead(notification.id);
    }

    if (notification.type === "FOLLOW") {
      router.push(`/user/${notification.actor.id}`);
    } else if (notification.post) {
      router.push(`/?postId=${notification.post.id}`);
    } else {
      router.push("/");
    }
  };

  // Format date
  const formatDate = (date: string) => {
    return new Date(date).toLocaleString();
  };

  // Notification icon
  const getIcon = (type: string) => {
    switch (type) {
      case "LIKE":
        return "❤️";
      case "COMMENT":
        return "💬";
      case "FOLLOW":
        return "👤";
      default:
        return "🔔";
    }
  };

  return (
    <main className="min-h-screen bg-gray-100 px-4 py-8">
      <div className="mx-auto max-w-3xl">

        {/* Header */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Notifications 🔔
            </h1>

            <p className="mt-1 text-sm text-gray-600">
              You have {unreadCount} unread notifications.
            </p>
          </div>

          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Mark All as Read
            </button>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div className="rounded-xl bg-white p-8 text-center shadow-sm">
            <p className="text-gray-600">
              Loading notifications...
            </p>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="rounded-xl bg-white p-8 text-center shadow-sm">
            <p className="text-red-600">{error}</p>

            <button
              onClick={fetchNotifications}
              className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-white"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && notifications.length === 0 && (
          <div className="rounded-xl bg-white p-10 text-center shadow-sm">
            <div className="mb-3 text-5xl">🔔</div>

            <h2 className="text-lg font-semibold text-gray-800">
              No Notifications Yet
            </h2>

            <p className="mt-2 text-sm text-gray-500">
              When someone likes, comments on your posts or follows you,
              notifications will appear here.
            </p>
          </div>
        )}

        {/* Notification List */}
        {!loading && !error && notifications.length > 0 && (
          <div className="space-y-3">
            {notifications.map((notification) => (
              <button
                key={notification.id}
                onClick={() => openNotification(notification)}
                className={`flex w-full items-start gap-4 rounded-xl border p-4 text-left shadow-sm transition hover:bg-gray-50 ${
                  notification.isRead
                    ? "border-gray-200 bg-white"
                    : "border-blue-200 bg-blue-50"
                }`}
              >
                {/* Profile Picture */}
                {notification.actor.image ? (
                  <img
                    src={notification.actor.image}
                    alt={notification.actor.name}
                    className="h-12 w-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-600 text-lg font-bold text-white">
                    {notification.actor.name
                      ?.charAt(0)
                      .toUpperCase()}
                  </div>
                )}

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm text-gray-800">
                      <span className="font-bold">
                        {notification.actor.name}
                      </span>{" "}
                      {notification.message}
                    </p>

                    <span className="shrink-0 text-xl">
                      {getIcon(notification.type)}
                    </span>
                  </div>

                  <p className="mt-1 text-xs text-gray-500">
                    @{notification.actor.username}
                  </p>

                  {notification.post && (
                    <p className="mt-2 line-clamp-2 text-sm text-gray-600">
                      {notification.post.content}
                    </p>
                  )}

                  <p className="mt-2 text-xs text-gray-400">
                    {formatDate(notification.createdAt)}
                  </p>

                  {!notification.isRead && (
                    <span className="mt-2 inline-block rounded-full bg-blue-600 px-2 py-1 text-xs font-semibold text-white">
                      New
                    </span>
                  )}
                </div>

                {/* Unread Indicator */}
                {!notification.isRead && (
                  <span className="mt-2 h-3 w-3 shrink-0 rounded-full bg-blue-600" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
