import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AnimatePresence, motion } from "framer-motion";
import { GripVertical, Plus, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  DndContext, DragOverlay, PointerSensor, TouchSensor,
  closestCenter, useSensor, useSensors,
  type DragStartEvent, type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface Category {
  id: number; name: string; type: string; icon: string;
  color: string; isDefault: boolean; sortOrder: number;
}

const COLOR_OPTIONS = [
  "#20808D","#437A22","#A84B2F","#7A39BB","#D19900",
  "#006494","#944454","#848456","#2E86AB","#E84855",
  "#3BB273","#F18F01",
];

const SWIPE_THRESHOLD = 90;

// ─ SwipeToDelete ─────────────────────────────────────────────────
function SwipeToDelete({ canDelete, onDelete, children }: {
  canDelete: boolean; onDelete: () => void; children: React.ReactNode;
}) {
  const [ox, setOx] = useState(0);
  const oxRef = useRef(0);
  const sx = useRef(0);
  const sy = useRef(0);
  const active = useRef(false);
  const dir = useRef<"x" | "y" | null>(null);
  const [dragging, setDragging] = useState(false);

  const setOffset = (v: number) => { oxRef.current = v; setOx(v); };
  const opacity = Math.min(1, Math.abs(ox) / SWIPE_THRESHOLD);

  const pd = (e: React.PointerEvent) => {
    if (!canDelete) return;
    if ((e.target as HTMLElement).closest("button")) return;
    sx.current = e.clientX; sy.current = e.clientY;
    active.current = true; dir.current = null;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const pm = (e: React.PointerEvent) => {
    if (!active.current) return;
    const dx = e.clientX - sx.current, dy = e.clientY - sy.current;
    if (!dir.current) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      dir.current = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    }
    if (dir.current === "y") return;
    e.preventDefault();
    if (!dragging) setDragging(true);
    setOffset(Math.min(0, dx));
  };
  const pu = () => {
    if (!active.current) return;
    active.current = false; setDragging(false);
    if (oxRef.current < -SWIPE_THRESHOLD) onDelete();
    else setOffset(0);
  };

  if (!canDelete) return <>{children}</>;
  return (
    <div className="relative overflow-hidden rounded-xl" style={{ touchAction: "pan-y" }}>
      <div className="absolute inset-0 bg-destructive rounded-xl flex items-center justify-end pr-5"
        style={{ opacity }}>
        <motion.div animate={{ scale: 0.65 + 0.35 * opacity }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}>
          <Trash2 size={20} className="text-white" />
        </motion.div>
      </div>
      <motion.div
        animate={{ x: ox }}
        transition={dragging ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 42 }}
        onPointerDown={pd} onPointerMove={pm} onPointerUp={pu} onPointerCancel={pu}
        className="relative"
      >{children}</motion.div>
    </div>
  );
}

// ─ CategoryCard (pure display, used both in list and DragOverlay) ──────
function CategoryCard({ cat, onEdit, overlay = false }: {
  cat: Category; onEdit?: (cat: Category) => void; overlay?: boolean;
}) {
  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl border border-border bg-card select-none
      ${overlay ? "shadow-2xl ring-2 ring-primary/20 opacity-95" : "shadow-sm"}`}>
      <div className="p-1 -ml-1 flex-shrink-0 text-muted-foreground/40 cursor-grab">
        <GripVertical size={16} />
      </div>
      <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
        style={{ backgroundColor: cat.color }}>
        {cat.name.slice(0, 1).toUpperCase()}
      </div>
      <span className="flex-1 text-sm font-medium truncate">{cat.name}</span>
      {!cat.isDefault && onEdit && (
        <Button variant="ghost" size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground flex-shrink-0"
          onPointerDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); onEdit(cat); }}>
          <Pencil size={13} />
        </Button>
      )}
    </div>
  );
}

// ─ SortableRow ────────────────────────────────────────────────────
function SortableRow({ cat, onEdit, onDelete }: {
  cat: Category; onEdit: (cat: Category) => void; onDelete: (id: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: cat.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition ?? "transform 200ms cubic-bezier(0.25, 1, 0.5, 1)",
    opacity: isDragging ? 0 : 1,
    zIndex: isDragging ? 10 : ("auto" as any),
  };

  return (
    <div ref={setNodeRef} style={style}>
      <SwipeToDelete canDelete={!cat.isDefault} onDelete={() => onDelete(cat.id)}>
        <div {...attributes}>
          <CategoryCard cat={cat} onEdit={onEdit} />
          <div {...listeners}
            className="absolute left-0 top-0 w-10 h-full cursor-grab active:cursor-grabbing"
            style={{ touchAction: "none" }}
          />
        </div>
      </SwipeToDelete>
    </div>
  );
}

// ─ CategorySection ───────────────────────────────────────────────
function CategorySection({ title, type, categories, onReorder, onEdit, onDelete, onAdd }: {
  title: string; type: "income" | "expense"; categories: Category[];
  onReorder: (type: "income" | "expense", order: number[]) => void;
  onEdit: (cat: Category) => void; onDelete: (id: number) => void;
  onAdd: (type: "income" | "expense") => void;
}) {
  const [items, setItems] = useState<Category[]>(categories);
  const [activeId, setActiveId] = useState<number | null>(null);

  const prevKey = useRef("");
  const curKey = categories.map(c => `${c.id}:${c.sortOrder}`).join(",");
  if (curKey !== prevKey.current) { prevKey.current = curKey; setItems(categories); }

  const activeCat = activeId != null ? items.find(c => c.id === activeId) : null;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
  );

  const handleDragStart = (e: DragStartEvent) => setActiveId(e.active.id as number);

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setItems(prev => {
      const oi = prev.findIndex(c => c.id === active.id);
      const ni = prev.findIndex(c => c.id === over.id);
      const next = arrayMove(prev, oi, ni);
      onReorder(type, next.map(c => c.id));
      return next;
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{title}</h3>
        <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => onAdd(type)}>
          <Plus size={13} /> Добавить
        </Button>
      </div>
      {items.length === 0 ? (
        <div className="text-xs text-muted-foreground text-center py-6 rounded-xl border border-dashed border-border">Нет категорий</div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter}
          onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map(c => c.id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-2">
              <AnimatePresence initial={false}>
                {items.map(cat => (
                  <motion.div
                    key={cat.id}
                    initial={{ opacity: 0, scale: 0.95, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, x: -60, transition: { duration: 0.2 } }}
                    transition={{ type: "spring", stiffness: 400, damping: 38 }}
                    layout={false}
                  >
                    <SortableRow cat={cat} onEdit={onEdit} onDelete={onDelete} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </SortableContext>
          <DragOverlay dropAnimation={{
            duration: 220,
            easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)",
          }}>
            {activeCat && <CategoryCard cat={activeCat} overlay />}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}

// ─ Root ───────────────────────────────────────────────────────────────────
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

  const { data: categories = [], isLoading } = useQuery<Category[]>({ queryKey: ["/api/categories"] });
  const inc = [...categories.filter(c => c.type === "income")].sort((a, b) => a.sortOrder - b.sortOrder);
  const exp = [...categories.filter(c => c.type === "expense")].sort((a, b) => a.sortOrder - b.sortOrder);

  const addM = useMutation({
    mutationFn: async (d: { name: string; type: string; icon: string; color: string }) =>
      (await apiRequest("POST", "/api/categories", d)).json(),
    onSuccess: () => { toast({ title: "Категория создана" }); qc.invalidateQueries({ queryKey: ["/api/categories"] }); setAddOpen(false); setNewName(""); },
    onError: () => toast({ title: "Ошибка создания", variant: "destructive" }),
  });
  const editM = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Category> }) =>
      (await apiRequest("PATCH", `/api/categories/${id}`, data)).json(),
    onSuccess: () => { toast({ title: "Категория обновлена" }); qc.invalidateQueries({ queryKey: ["/api/categories"] }); setEditCat(null); },
    onError: () => toast({ title: "Ошибка", variant: "destructive" }),
  });
  const delM = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/categories/${id}`),
    onSuccess: () => { toast({ title: "Категория удалена" }); qc.invalidateQueries({ queryKey: ["/api/categories"] }); },
    onError: () => toast({ title: "Ошибка удаления", variant: "destructive" }),
  });
  const reorderM = useMutation({
    mutationFn: async ({ type, order }: { type: "income" | "expense"; order: number[] }) =>
      apiRequest("PATCH", "/api/categories/reorder", { type, order }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/categories"] }),
  });

  if (isLoading) return <div className="text-sm text-muted-foreground py-6 text-center">Загрузка…</div>;

  const colorPicker = (selected: string, onSelect: (c: string) => void) => (
    <div className="flex flex-wrap gap-2">
      {COLOR_OPTIONS.map(c => (
        <button key={c} type="button" onClick={() => onSelect(c)}
          className={`w-7 h-7 rounded-full border-2 transition-transform ${selected === c ? "border-foreground scale-110" : "border-transparent"}`}
          style={{ backgroundColor: c }} />
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      <CategorySection title="Доходы" type="income" categories={inc}
        onReorder={(t, o) => reorderM.mutate({ type: t, order: o })}
        onEdit={cat => { setEditCat(cat); setEditName(cat.name); setEditColor(cat.color); }}
        onDelete={id => delM.mutate(id)}
        onAdd={t => { setAddType(t); setAddOpen(true); }} />
      <CategorySection title="Расходы" type="expense" categories={exp}
        onReorder={(t, o) => reorderM.mutate({ type: t, order: o })}
        onEdit={cat => { setEditCat(cat); setEditName(cat.name); setEditColor(cat.color); }}
        onDelete={id => delM.mutate(id)}
        onAdd={t => { setAddType(t); setAddOpen(true); }} />

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Новая категория</DialogTitle>
            <DialogDescription>{addType === "income" ? "Категория доходов" : "Категория расходов"}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Название</label>
              <Input placeholder="Например: Кафе, Аренда…" value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addM.mutate({ name: newName.trim(), type: addType, icon: "Tag", color: newColor })}
                autoFocus />
            </div>
            <div className="space-y-1.5"><label className="text-sm font-medium">Цвет</label>{colorPicker(newColor, setNewColor)}</div>
            <Button className="w-full"
              onClick={() => addM.mutate({ name: newName.trim(), type: addType, icon: "Tag", color: newColor })}
              disabled={!newName.trim() || addM.isPending}>
              {addM.isPending ? "Создаётся…" : "Создать"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editCat} onOpenChange={o => { if (!o) setEditCat(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Редактировать категорию</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Название</label>
              <Input value={editName} onChange={e => setEditName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && editM.mutate({ id: editCat!.id, data: { name: editName, color: editColor } })}
                autoFocus />
            </div>
            <div className="space-y-1.5"><label className="text-sm font-medium">Цвет</label>{colorPicker(editColor, setEditColor)}</div>
            <Button className="w-full"
              onClick={() => editM.mutate({ id: editCat!.id, data: { name: editName, color: editColor } })}
              disabled={!editName.trim() || editM.isPending}>
              {editM.isPending ? "Сохраняется…" : "Сохранить"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
