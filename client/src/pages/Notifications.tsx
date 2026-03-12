/**
 * Notifications page — shows in-app notifications with read/unread state.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bell, BellOff, CheckCheck, Info, AlertTriangle, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Notification {
  id: number;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
}

function notifIcon(type: string) {
  switch (type) {
    case "inactivity": return <Bell size={16} className="text-blue-500" />;
    case "credit_due": return <AlertTriangle size={16} className="text-orange-500" />;
    case "budget_exceeded": return <TrendingDown size={16} className="text-red-500" />;
    default: return <Info size={16} className="text-muted-foreground" />;
  }
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} мин назад`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ч назад`;
  const days = Math.floor(hours / 24);
  return `${days} дн назад`;
}

export default function NotificationsPage() {
  const qc = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
  });

  const markRead = useMutation({
    mutationFn: (id: number) => apiRequest("PATCH", `/api/notifications/${id}/read`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/notifications"] }),
  });

  const markAllRead = async () => {
    const unread = notifications.filter(n => !n.isRead);
    await Promise.all(unread.map(n => apiRequest("PATCH", `/api/notifications/${n.id}/read`, {})));
    qc.invalidateQueries({ queryKey: ["/api/notifications"] });
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            Уведомления
            {unreadCount > 0 && (
              <Badge className="bg-emerald-600 text-white text-xs">
                {unreadCount}
              </Badge>
            )}
          </h1>
          <p className="text-sm text-muted-foreground">
            {notifications.length === 0
              ? "Нет уведомлений"
              : `${notifications.length} уведомлений`}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={markAllRead}
            className="gap-2"
            data-testid="btn-mark-all-read"
          >
            <CheckCheck size={15} />
            Прочитать все
          </Button>
        )}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <CardContent className="pt-4">
                <div className="h-12 bg-muted animate-pulse rounded-lg" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && notifications.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <BellOff size={40} className="mx-auto text-muted-foreground mb-3" />
            <h3 className="font-semibold mb-1">Всё тихо</h3>
            <p className="text-sm text-muted-foreground">
              Уведомления появятся здесь, когда произойдут важные события
            </p>
          </CardContent>
        </Card>
      )}

      {/* Notification list */}
      {!isLoading && notifications.length > 0 && (
        <div className="space-y-2">
          {notifications.map(n => (
            <div
              key={n.id}
              data-testid={`notif-item-${n.id}`}
              className={cn(
                "flex items-start gap-3 p-4 rounded-xl border transition-colors cursor-pointer",
                n.isRead
                  ? "bg-card border-border opacity-70"
                  : "bg-card border-emerald-200 dark:border-emerald-800"
              )}
              onClick={() => !n.isRead && markRead.mutate(n.id)}
            >
              <div className="mt-0.5 flex-shrink-0">
                {notifIcon(n.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={cn("text-sm font-semibold", !n.isRead && "text-foreground")}>
                    {n.title}
                  </span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-muted-foreground">{timeAgo(n.createdAt)}</span>
                    {!n.isRead && (
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    )}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">{n.body}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
