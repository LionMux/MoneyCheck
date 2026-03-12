import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Lesson as LessonBase, UserProgress } from "@shared/schema";

// The API enriches Lesson objects with a `completed` boolean
type Lesson = LessonBase & { completed?: boolean };
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import {
  BookOpen, CheckCircle2, Lock, Star, Zap,
  PieChart, TrendingUp, Shield, Activity, BarChart3, Receipt
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const ICONS: Record<string, React.ReactNode> = {
  PieChart: <PieChart size={22} />,
  Shield: <Shield size={22} />,
  TrendingUp: <TrendingUp size={22} />,
  BarChart3: <BarChart3 size={22} />,
  Activity: <Activity size={22} />,
  Receipt: <Receipt size={22} />,
  BookOpen: <BookOpen size={22} />,
};

const DIFF_LABEL: Record<string, string> = {
  beginner: "Начинающий",
  intermediate: "Средний",
  advanced: "Продвинутый",
};
const DIFF_COLOR: Record<string, string> = {
  beginner: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  intermediate: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  advanced: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

function renderMarkdown(text: string) {
  return text
    .split("\n")
    .map((line, i) => {
      const bold = line.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
      if (line.startsWith("- ")) return <li key={i} className="ml-4 text-sm" dangerouslySetInnerHTML={{ __html: bold.slice(2) }} />;
      if (line === "") return <br key={i} />;
      return <p key={i} className="text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: bold }} />;
    });
}

export default function Learn() {
  const { toast } = useToast();
  const [selected, setSelected] = useState<Lesson | null>(null);
  const [quizAnswer, setQuizAnswer] = useState<number | null>(null);
  const [quizDone, setQuizDone] = useState(false);
  const [filter, setFilter] = useState<"all" | "pending" | "completed">("all");

  const { data: lessons = [] } = useQuery<Lesson[]>({ queryKey: ["/api/lessons"] });
  const { data: progress } = useQuery<UserProgress>({ queryKey: ["/api/progress"] });

  const completeMut = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/lessons/${id}/complete`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lessons"] });
      queryClient.invalidateQueries({ queryKey: ["/api/progress"] });
    },
  });

  const filtered = lessons.filter(l => {
    if (filter === "pending") return !l.completed;
    if (filter === "completed") return l.completed;
    return true;
  });

  const completedCount = lessons.filter(l => l.completed).length;
  const totalXp = lessons.filter(l => l.completed).reduce((s, l) => s + l.xpReward, 0);

  const openLesson = (l: Lesson) => {
    setSelected(l);
    setQuizAnswer(null);
    setQuizDone(false);
  };

  const handleQuizAnswer = (idx: number) => {
    if (quizDone) return;
    setQuizAnswer(idx);
    const correct = idx === selected?.quizAnswer;
    setQuizDone(true);
    if (correct && selected && !selected.completed) {
      completeMut.mutate(selected.id);
      toast({ title: `+${selected.xpReward} XP! Правильно!` });
    } else if (!correct) {
      toast({ title: "Неверно, попробуй ещё раз", variant: "destructive" });
    } else if (selected?.completed) {
      toast({ title: "Урок уже пройден" });
    }
  };

  const xpInLevel = progress ? progress.totalXp % 200 : 0;
  const xpPct = Math.round((xpInLevel / 200) * 100);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="heading-learn">Финансовая грамотность</h1>
        <p className="text-sm text-muted-foreground">Учись и зарабатывай XP за каждый урок</p>
      </div>

      {/* Progress bar */}
      {progress && (
        <Card className="border-primary/20 bg-primary/5 dark:bg-primary/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
                <Star size={22} className="text-primary" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold">Уровень {progress.level}</span>
                  <span className="text-xs text-muted-foreground">{xpInLevel} / 200 XP</span>
                </div>
                <Progress value={xpPct} className="h-2" />
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-xs text-muted-foreground">{completedCount} из {lessons.length} уроков пройдено</span>
                  <div className="flex items-center gap-1">
                    <Zap size={12} className="text-yellow-500" />
                    <span className="text-xs font-medium">{progress.streak} дней</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filter */}
      <div className="flex gap-2">
        {(["all", "pending", "completed"] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            data-testid={`lesson-filter-${f}`}
            className={cn(
              "px-4 py-1.5 rounded-full text-sm font-medium transition-all",
              filter === f ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-secondary"
            )}
          >
            {{ all: "Все", pending: "Не пройдены", completed: "Пройдены" }[f]}
          </button>
        ))}
      </div>

      {/* Lesson cards */}
      <div className="grid grid-cols-1 gap-3">
        {filtered.map(lesson => (
          <button
            key={lesson.id}
            data-testid={`lesson-card-${lesson.id}`}
            onClick={() => openLesson(lesson)}
            className={cn(
              "w-full text-left rounded-xl border bg-card p-4 flex items-center gap-4 transition-all hover:shadow-md hover:border-primary/30",
              lesson.completed && "opacity-80"
            )}
          >
            <div className={cn(
              "w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0",
              lesson.completed ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
            )}>
              {ICONS[lesson.icon] ?? <BookOpen size={22} />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold">{lesson.title}</span>
                {lesson.completed && <CheckCircle2 size={14} className="text-primary flex-shrink-0" />}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{lesson.description}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", DIFF_COLOR[lesson.difficulty])}>
                  {DIFF_LABEL[lesson.difficulty]}
                </span>
                <span className="flex items-center gap-0.5 text-xs text-yellow-600 dark:text-yellow-400 font-medium">
                  <Zap size={11} />+{lesson.xpReward} XP
                </span>
                <Badge variant="secondary" className="text-xs h-4 px-1.5">{lesson.category}</Badge>
              </div>
            </div>
            {!lesson.completed && (
              <div className="text-muted-foreground flex-shrink-0">
                <BookOpen size={16} />
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Lesson Dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        {selected && (
          <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center gap-3 mb-1">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  {ICONS[selected.icon] ?? <BookOpen size={18} />}
                </div>
                <div>
                  <DialogTitle className="text-base leading-tight">{selected.title}</DialogTitle>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={cn("text-xs px-1.5 py-0 rounded-full font-medium", DIFF_COLOR[selected.difficulty])}>
                      {DIFF_LABEL[selected.difficulty]}
                    </span>
                    <span className="text-xs text-yellow-600 dark:text-yellow-400 flex items-center gap-0.5">
                      <Zap size={10} /> {selected.xpReward} XP
                    </span>
                  </div>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-3">
              {/* Content */}
              <div className="prose-sm space-y-2 text-foreground">
                {renderMarkdown(selected.content)}
              </div>

              {/* Quiz */}
              {selected.quizQuestion && selected.quizOptions && (
                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-sm font-semibold mb-3">Проверь себя</p>
                  <p className="text-sm text-muted-foreground mb-3">{selected.quizQuestion}</p>
                  <div className="space-y-2">
                    {selected.quizOptions.map((opt, i) => {
                      const isSelected = quizAnswer === i;
                      const isCorrect = quizDone && i === selected.quizAnswer;
                      const isWrong = quizDone && isSelected && i !== selected.quizAnswer;
                      return (
                        <button
                          key={i}
                          onClick={() => handleQuizAnswer(i)}
                          data-testid={`quiz-option-${i}`}
                          disabled={quizDone}
                          className={cn(
                            "w-full text-left px-4 py-2.5 rounded-lg border text-sm transition-all",
                            !quizDone && "hover:border-primary hover:bg-primary/5",
                            isCorrect && "border-primary bg-primary/10 text-primary",
                            isWrong && "border-destructive bg-destructive/10 text-destructive",
                            !quizDone && "border-border"
                          )}
                        >
                          <span className="font-medium mr-2">{String.fromCharCode(65 + i)}.</span>
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                  {quizDone && quizAnswer === selected.quizAnswer && (
                    <div className="flex items-center gap-2 mt-3 text-primary text-sm font-medium">
                      <CheckCircle2 size={16} />
                      {selected.completed ? "Урок уже был пройден" : "Урок пройден! XP начислены"}
                    </div>
                  )}
                </div>
              )}

              <Button variant="outline" className="w-full" onClick={() => setSelected(null)}>
                Закрыть
              </Button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
