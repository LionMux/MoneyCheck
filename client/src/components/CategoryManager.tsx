import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AnimatePresence, motion, useMotionValue, useTransform } from "framer-motion";
import { GripVertical, Plus, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogDescription
} from "@/components/ui/dialog";

interface Category {
  id: number;
  name: string;
  type: string;
  icon: string;
  color: string;
  isDefault: boolean;
  sortOrder: number;
}

const COLOR_OPTIONS = [
  "#20808D", "#437A22", "#A84B2F", "#7A39BB", "#D19900",
  "#006494", "#944454", "#848456", "#2E86AB", "#E84855",
  "#3BB273", "#F18F01",
];

// ─── useDragSort hook ──────────────────────────────────────────────────────

function useDragSort(initial: Category[], onCommit: (order: number[]) => void) {
  const [items, setItems] = useState<Category[]>(initial);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const pointerStartY = useRef(0);
  const itemHeightRef = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);

  const prevKey = useRef(initial.map(c => `${c.id}:${c.name}:${c.color}`).join(","));
  const curKey = initial.map(c => `${c.id}:${c.name}:${c.color}`).join(",");
  if (curKey !== prevKey.current) {
    prevKey.current = curKey;
    setItems(initial);
  }

  const onPointerDown = useCallback((e: React.PointerEvent, id: number) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointerStartY.current = e.clientY;
    if (listRef.current) {
      const first = listRef.current.children[0] as HTMLElement;
      if (first) itemHeightRef.current = first.getBoundingClientRect().height + 8;
    }
    setDraggingId(id);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent, id: number) => {
    if (draggingId !== id) return;
    const dy = e.clientY - pointerStartY.current;
    const steps = Math.round(dy / (itemHeightRef.current || 60));
    if (steps === 0) return;
    setItems(prev => {
      const idx = prev.findIndex(c => c.id === id);
      if (idx === -1) return prev;
      const newIdx = Math.max(0, Math.min(prev.length - 1, idx + steps));
      if (newIdx === idx) return prev;
      const next = [...prev];
      const [moved] = next.splice(idx, 1);
      next.splice(newIdx, 0, moved);
      pointerStartY.current = e.clientY;
      return next;
    });
  }, [draggingId]);

  const onPointerUp = useCallback(() => {
    if (draggingId !== null) {
      setItems(prev => { onCommit(prev.map(c => c.id)); return prev; });
    }
    setDraggingId(null);
  }, [draggingId, onCommit]);

  return { items, draggingId, listRef, onPointerDown, onPointerMove, onPointerUp };
}

// ─── SwipeToDelete wrapper ───────────────────────────────────────────────

const DELETE_THRESHOLD = 80;

function SwipeToDelete({
  canDelete,
  onDelete,
  children,
}: {
  canDelete: boolean;
  onDelete: () => void;
  children: React.ReactNode;
}) {
  const x = useMotionValue(0);
  const deleteOpacity = useTransform(x, [-DELETE_THRESHOLD, -DELETE_THRESHOLD / 2], [1, 0]);
  const deleteScale = useTransform(x, [-DELETE_THRESHOLD, -DELETE_THRESHOLD / 2], [1, 0.7]);
  const cardOpacity = useTransform(x, [-DELETE_THRESHOLD * 1.5, -DELETE_THRESHOLD], [0, 1]);

  const handleDragEnd = () => {
    if (x.get() < -DELETE_THRESHOLD) {
      onDelete();
    } else {
      // snap back
      x.set(0);
    }
  };

  if (!canDelete) return <>{children}</>;

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Red background with trash icon */}
      <motion.div
        className="absolute inset-0 bg-destructive rounded-xl flex items-center justify-end pr-4"
        style={{ opacity: deleteOpacity }}
      >
        <motion.div style={{ scale: deleteScale }}>
          <Trash2 size={20} className="text-white" />
        </motion.div>
      </motion.div>

      {/* Draggable card */}
      <motion.div
        drag="x"
        dragConstraints={{ left: -DELETE_THRESHOLD * 1.6, right: 0 }}
        dragElastic={{ left: 0.15, right: 0 }}
        style={{ x, opacity: cardOpacity }}
        onDragEnd={handleDragEnd}
        dragMomentum={false}
        className="relative cursor-grab active:cursor-grabbing"
      >
        {children}
      </motion.div>
    </div>
  );
}

// ─── CategoryItem ───────────────────────────────────────────────────────────

function CategoryItem({
  cat,
  isDragging,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onEdit,
  onDelete,
}: {
  cat: Category;
  isDragging: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: () => void;
  onEdit: (cat: Category) => void;
  onDelete: (cat: Category) => void;
}) {
  return (
    <motion.div
      layout
      layoutId={`cat-${cat.id}`}
      transition={{ type: "spring", stiffness: 500, damping: 40 }}
      animate={{
        scale: isDragging ? 1.03 : 1,
        boxShadow: isDragging
          ? "0 12px 32px rgba(0,0,0,0.18)"
          : "0 1px 3px rgba(0,0,0,0.06)",
      }}
      style={{ zIndex: isDragging ? 50 : "auto", position: "relative" }}
      className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card select-none"
    >
      {/* Drag handle */}
      <div
        className="touch-none cursor-grab active:cursor-grabbing p-1 -ml-1 flex-shrink-0"
        style={{ touchAction: "none" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <GripVertical size={16} className="text-muted-foreground/40" />
      </div>

      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
        style={{ backgroundColor: cat.color }}
      >
        {cat.name.slice(0, 1).toUpperCase()}
      </div>

      <span className="flex-1 text-sm font-medium truncate">{cat.name}</span>

      {!cat.isDefault && (
        <Button
          variant="ghost" size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground flex-shrink-0"
          onClick={() => onEdit(cat)}
        >
          <Pencil size={13} />
        </Button>
      )}
    </motion.div>
  );
}

// ─── CategorySection ─────────────────────────────────────────────────────

function CategorySection({
  title, type, categories, onReorder, onEdit, onDelete, onAdd,
}: {
  title: string;
  type: "income" | "expense";
  categories: Category[];
  onReorder: (type: "income" | "expense", order: number[]) => void;
  onEdit: (cat: Category) => void;
  onDelete: (id: number) => void;
  onAdd: (type: "income" | "expense") => void;
}) {
  const commit = useCallback((order: number[]) => onReorder(type, order), [type, onReorder]);
  const { items, draggingId, listRef, onPointerDown, onPointerMove, onPointerUp } =
    useDragSort(categories, commit);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{title}</h3>
        <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => onAdd(type)}>
          <Plus size={13} /> Добавить
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="text-xs text-muted-foreground text-center py-6 rounded-xl border border-dashed border-border">
          Нет категорий
        </div>
      ) : (
        <motion.div ref={listRef} className="flex flex-col gap-2" layout>
          <AnimatePresence initial={false}>
            {items.map(cat => (
              <motion.div
                key={cat.id}
                layout
                initial={{ opacity: 0, scale: 0.92, y: -8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.88, x: -60, transition: { duration: 0.25, ease: [0.4, 0, 0.2, 1] } }}
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
              >
                <SwipeToDelete
                  canDelete={!cat.isDefault}
                  onDelete={() => onDelete(cat.id)}
                >
                  <CategoryItem
                    cat={cat}
                    isDragging={draggingId === cat.id}
                    onPointerDown={(e) => onPointerDown(e, cat.id)}
                    onPointerMove={(e) => onPointerMove(e, cat.id)}
                    onPointerUp={onPointerUp}
                    onEdit={onEdit}
                    onDelete={() => onDelete(cat.id)}
                  />
                </SwipeToDelete>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function CategoryManager() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [addOpen, setAddOpen] = useState(false);
  const [addType, setAddType] = useState<"income" | "expense">("expense");
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(COLOR_OPTIONS[0]);

  const [editCat, setEditCat] = useState<Category | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");

  const { data: categories = [], isLoading } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const incomeCategories = [...categories.filter(c => c.type === "income")]
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const expenseCategories = [...categories.filter(c => c.type === "expense")]
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const addMutation = useMutation({
    mutationFn: async (data: { name: string; type: string; icon: string; color: string }) => {
      const res = await apiRequest("POST", "/api/categories", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Категория создана" });
      qc.invalidateQueries({ queryKey: ["/api/categories"] });
      setAddOpen(false);
      setNewName("");
    },
    onError: () => toast({ title: "Ошибка создания", variant: "destructive" }),
  });

  const editMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Category> }) => {
      const res = await apiRequest("PATCH", `/api/categories/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Категория обновлена" });
      qc.invalidateQueries({ queryKey: ["/api/categories"] });
      setEditCat(null);
    },
    onError: () => toast({ title: "Ошибка обновления", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/categories/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Категория удалена" });
      qc.invalidateQueries({ queryKey: ["/api/categories"] });
    },
    onError: () => toast({ title: "Ошибка удаления", variant: "destructive" }),
  });

  const reorderMutation = useMutation({
    mutationFn: async ({ type, order }: { type: "income" | "expense"; order: number[] }) => {
      await apiRequest("PATCH", "/api/categories/reorder", { type, order });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/categories"] }),
  });

  if (isLoading) {
    return <div className="text-sm text-muted-foreground py-6 text-center">Загрузка…</div>;
  }

  return (
    <div className="space-y-6">
      <CategorySection
        title="Доходы"
        type="income"
        categories={incomeCategories}
        onReorder={(type, order) => reorderMutation.mutate({ type, order })}
        onEdit={(cat) => { setEditCat(cat); setEditName(cat.name); setEditColor(cat.color); }}
        onDelete={(id) => deleteMutation.mutate(id)}
        onAdd={(t) => { setAddType(t); setAddOpen(true); }}
      />
      <CategorySection
        title="Расходы"
        type="expense"
        categories={expenseCategories}
        onReorder={(type, order) => reorderMutation.mutate({ type, order })}
        onEdit={(cat) => { setEditCat(cat); setEditName(cat.name); setEditColor(cat.color); }}
        onDelete={(id) => deleteMutation.mutate(id)}
        onAdd={(t) => { setAddType(t); setAddOpen(true); }}
      />

      {/* DIALOG: ADD */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Новая категория</DialogTitle>
            <DialogDescription>
              {addType === "income" ? "Категория доходов" : "Категория расходов"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Название</label>
              <Input
                placeholder="Например: Кафе, Аренда…"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addMutation.mutate({ name: newName.trim(), type: addType, icon: "Tag", color: newColor })}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Цвет</label>
              <div className="flex flex-wrap gap-2">
                {COLOR_OPTIONS.map(c => (
                  <button key={c} type="button" onClick={() => setNewColor(c)}
                    className={`w-7 h-7 rounded-full border-2 transition-transform ${
                      newColor === c ? "border-foreground scale-110" : "border-transparent"
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <Button
              className="w-full"
              onClick={() => addMutation.mutate({ name: newName.trim(), type: addType, icon: "Tag", color: newColor })}
              disabled={!newName.trim() || addMutation.isPending}
            >
              {addMutation.isPending ? "Создаётся…" : "Создать"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* DIALOG: EDIT */}
      <Dialog open={!!editCat} onOpenChange={(o) => { if (!o) setEditCat(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Редактировать категорию</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Название</label>
              <Input
                value={editName}
                onChange={e => setEditName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && editMutation.mutate({ id: editCat!.id, data: { name: editName, color: editColor } })}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Цвет</label>
              <div className="flex flex-wrap gap-2">
                {COLOR_OPTIONS.map(c => (
                  <button key={c} type="button" onClick={() => setEditColor(c)}
                    className={`w-7 h-7 rounded-full border-2 transition-transform ${
                      editColor === c ? "border-foreground scale-110" : "border-transparent"
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <Button
              className="w-full"
              onClick={() => editMutation.mutate({ id: editCat!.id, data: { name: editName, color: editColor } })}
              disabled={!editName.trim() || editMutation.isPending}
            >
              {editMutation.isPending ? "Сохраняется…" : "Сохранить"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
