import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AnimatePresence, motion } from "framer-motion";
import { GripVertical, Plus, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

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

// ─ useDragSort ───────────────────────────────────────────────────────────
function useDragSort(initial: Category[], onCommit: (order: number[]) => void) {
  const [items, setItems] = useState<Category[]>(initial);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const startY = useRef(0);
  const itemH = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);
  const prevKey = useRef("");
  const curKey = initial.map(c => `${c.id}:${c.name}:${c.color}`).join(",");
  if (curKey !== prevKey.current) { prevKey.current = curKey; setItems(initial); }

  const onPointerDown = useCallback((e: React.PointerEvent, id: number) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    startY.current = e.clientY;
    if (listRef.current) {
      const el = listRef.current.children[0] as HTMLElement;
      if (el) itemH.current = el.getBoundingClientRect().height + 8;
    }
    setDraggingId(id);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent, id: number) => {
    if (draggingId !== id) return;
    const steps = Math.round((e.clientY - startY.current) / (itemH.current || 60));
    if (!steps) return;
    setItems(prev => {
      const idx = prev.findIndex(c => c.id === id);
      if (idx === -1) return prev;
      const ni = Math.max(0, Math.min(prev.length - 1, idx + steps));
      if (ni === idx) return prev;
      const next = [...prev];
      const [m] = next.splice(idx, 1);
      next.splice(ni, 0, m);
      startY.current = e.clientY;
      return next;
    });
  }, [draggingId]);

  const onPointerUp = useCallback(() => {
    if (draggingId !== null) setItems(prev => { onCommit(prev.map(c => c.id)); return prev; });
    setDraggingId(null);
  }, [draggingId, onCommit]);

  return { items, draggingId, listRef, onPointerDown, onPointerMove, onPointerUp };
}

// ─ SwipeToDelete ────────────────────────────────────────────────────
// Fix: use ref for offsetX so onPointerUp closure always reads latest value
function SwipeToDelete({ canDelete, onDelete, children }: {
  canDelete: boolean; onDelete: () => void; children: React.ReactNode;
}) {
  const [ox, setOx] = useState(0);
  const oxRef = useRef(0); // mirrors ox but readable in closures
  const sx = useRef(0);
  const active = useRef(false);
  const dir = useRef<"x"|"y"|null>(null);
  const [isActive, setIsActive] = useState(false);

  const setOffset = (v: number) => { oxRef.current = v; setOx(v); };
  const opacity = Math.min(1, Math.abs(ox) / SWIPE_THRESHOLD);

  const pd = (e: React.PointerEvent) => {
    if (!canDelete) return;
    // Don't capture if clicking a button inside
    if ((e.target as HTMLElement).closest('button')) return;
    sx.current = e.clientX;
    active.current = true;
    dir.current = null;
    setIsActive(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const pm = (e: React.PointerEvent) => {
    if (!active.current) return;
    const dx = e.clientX - sx.current;
    const dy = e.clientY - (e.clientY); // unused, just for clarity
    if (!dir.current) {
      const adx = Math.abs(e.clientX - sx.current);
      // We need original Y — track it
      if (adx < 5) return;
      dir.current = "x";
    }
    if (dir.current === "y") return;
    e.preventDefault();
    setOffset(Math.min(0, dx));
  };

  const pu = () => {
    if (!active.current) return;
    active.current = false;
    setIsActive(false);
    if (oxRef.current < -SWIPE_THRESHOLD) {
      onDelete();
    } else {
      setOffset(0);
    }
  };

  if (!canDelete) return <>{children}</>;
  return (
    <div className="relative overflow-hidden rounded-xl" style={{ touchAction: "pan-y" }}>
      <div
        className="absolute inset-0 bg-destructive rounded-xl flex items-center justify-end pr-5"
        style={{ opacity }}
      >
        <motion.div
          animate={{ scale: 0.65 + 0.35 * opacity }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
        >
          <Trash2 size={20} className="text-white" />
        </motion.div>
      </div>
      <motion.div
        animate={{ x: ox }}
        transition={isActive ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 42 }}
        onPointerDown={pd} onPointerMove={pm} onPointerUp={pu} onPointerCancel={pu}
        className="relative"
      >
        {children}
      </motion.div>
    </div>
  );
}

// ─ CategoryItem ─────────────────────────────────────────────────────────
function CategoryItem({ cat, isDragging, onDragDown, onDragMove, onDragUp, onEdit }: {
  cat: Category; isDragging: boolean;
  onDragDown: (e: React.PointerEvent) => void;
  onDragMove: (e: React.PointerEvent) => void;
  onDragUp: () => void;
  onEdit: (cat: Category) => void;
}) {
  return (
    <motion.div
      layout={!isDragging}
      transition={{ type: "spring", stiffness: 380, damping: 36 }}
      animate={{
        scale: isDragging ? 1.03 : 1,
        boxShadow: isDragging ? "0 12px 32px rgba(0,0,0,0.18)" : "0 1px 3px rgba(0,0,0,0.05)",
      }}
      style={{ zIndex: isDragging ? 50 : "auto", position: "relative" }}
      className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card select-none"
    >
      <div
        className="p-1 -ml-1 flex-shrink-0 cursor-grab active:cursor-grabbing"
        style={{ touchAction: "none" }}
        onPointerDown={onDragDown}
        onPointerMove={onDragMove}
        onPointerUp={onDragUp}
        onPointerCancel={onDragUp}
      >
        <GripVertical size={16} className="text-muted-foreground/40" />
      </div>
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
        style={{ backgroundColor: cat.color }}
      >
        {cat.name.slice(0,1).toUpperCase()}
      </div>
      <span className="flex-1 text-sm font-medium truncate">{cat.name}</span>
      {!cat.isDefault && (
        <Button
          variant="ghost" size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground flex-shrink-0"
          onPointerDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); onEdit(cat); }}
        >
          <Pencil size={13} />
        </Button>
      )}
    </motion.div>
  );
}

// ─ CategorySection ────────────────────────────────────────────────────
function CategorySection({ title, type, categories, onReorder, onEdit, onDelete, onAdd }: {
  title: string; type: "income"|"expense"; categories: Category[];
  onReorder: (type: "income"|"expense", order: number[]) => void;
  onEdit: (cat: Category) => void;
  onDelete: (id: number) => void;
  onAdd: (type: "income"|"expense") => void;
}) {
  const commit = useCallback((o: number[]) => onReorder(type, o), [type, onReorder]);
  const { items, draggingId, listRef, onPointerDown, onPointerMove, onPointerUp } = useDragSort(categories, commit);
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
        <div ref={listRef} className="flex flex-col gap-2">
          <AnimatePresence initial={false}>
            {items.map(cat => (
              <motion.div
                key={cat.id}
                layout
                initial={{ opacity: 0, scale: 0.94, y: -6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.88, x: -80, transition: { duration: 0.22, ease: [0.4,0,0.2,1] } }}
                transition={{ type: "spring", stiffness: 380, damping: 36 }}
              >
                <SwipeToDelete canDelete={!cat.isDefault} onDelete={() => onDelete(cat.id)}>
                  <CategoryItem
                    cat={cat}
                    isDragging={draggingId === cat.id}
                    onDragDown={e => onPointerDown(e, cat.id)}
                    onDragMove={e => onPointerMove(e, cat.id)}
                    onDragUp={onPointerUp}
                    onEdit={onEdit}
                  />
                </SwipeToDelete>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

// ─ Root ────────────────────────────────────────────────────────────────────
export default function CategoryManager() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [addType, setAddType] = useState<"income"|"expense">("expense");
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(COLOR_OPTIONS[0]);
  const [editCat, setEditCat] = useState<Category|null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");

  const { data: categories = [], isLoading } = useQuery<Category[]>({ queryKey: ["/api/categories"] });
  const inc = [...categories.filter(c => c.type==="income")].sort((a,b) => a.sortOrder-b.sortOrder);
  const exp = [...categories.filter(c => c.type==="expense")].sort((a,b) => a.sortOrder-b.sortOrder);

  const addM = useMutation({
    mutationFn: async (d: {name:string;type:string;icon:string;color:string}) =>
      (await apiRequest("POST","/api/categories",d)).json(),
    onSuccess: () => {
      toast({title:"Категория создана"});
      qc.invalidateQueries({queryKey:["/api/categories"]});
      setAddOpen(false); setNewName("");
    },
    onError: () => toast({title:"Ошибка создания",variant:"destructive"}),
  });
  const editM = useMutation({
    mutationFn: async ({id,data}:{id:number;data:Partial<Category>}) =>
      (await apiRequest("PATCH",`/api/categories/${id}`,data)).json(),
    onSuccess: () => {
      toast({title:"Категория обновлена"});
      qc.invalidateQueries({queryKey:["/api/categories"]});
      setEditCat(null);
    },
    onError: () => toast({title:"Ошибка",variant:"destructive"}),
  });
  const delM = useMutation({
    mutationFn: async (id:number) => apiRequest("DELETE",`/api/categories/${id}`),
    onSuccess: () => {
      toast({title:"Категория удалена"});
      qc.invalidateQueries({queryKey:["/api/categories"]});
    },
    onError: () => toast({title:"Ошибка удаления",variant:"destructive"}),
  });
  const reorderM = useMutation({
    mutationFn: async ({type,order}:{type:"income"|"expense";order:number[]}) =>
      apiRequest("PATCH","/api/categories/reorder",{type,order}),
    onSuccess: () => qc.invalidateQueries({queryKey:["/api/categories"]}),
  });

  if (isLoading) return <div className="text-sm text-muted-foreground py-6 text-center">Загрузка…</div>;

  const colorPicker = (selected: string, onSelect: (c:string)=>void) => (
    <div className="flex flex-wrap gap-2">
      {COLOR_OPTIONS.map(c => (
        <button key={c} type="button" onClick={() => onSelect(c)}
          className={`w-7 h-7 rounded-full border-2 transition-transform ${selected===c?"border-foreground scale-110":"border-transparent"}`}
          style={{backgroundColor:c}} />
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      <CategorySection title="Доходы" type="income" categories={inc}
        onReorder={(t,o) => reorderM.mutate({type:t,order:o})}
        onEdit={cat => { setEditCat(cat); setEditName(cat.name); setEditColor(cat.color); }}
        onDelete={id => delM.mutate(id)}
        onAdd={t => { setAddType(t); setAddOpen(true); }} />
      <CategorySection title="Расходы" type="expense" categories={exp}
        onReorder={(t,o) => reorderM.mutate({type:t,order:o})}
        onEdit={cat => { setEditCat(cat); setEditName(cat.name); setEditColor(cat.color); }}
        onDelete={id => delM.mutate(id)}
        onAdd={t => { setAddType(t); setAddOpen(true); }} />

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Новая категория</DialogTitle>
            <DialogDescription>{addType==="income"?"Категория доходов":"Категория расходов"}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Название</label>
              <Input placeholder="Например: Кафе, Аренда…" value={newName}
                onChange={e=>setNewName(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&addM.mutate({name:newName.trim(),type:addType,icon:"Tag",color:newColor})}
                autoFocus />
            </div>
            <div className="space-y-1.5"><label className="text-sm font-medium">Цвет</label>{colorPicker(newColor,setNewColor)}</div>
            <Button className="w-full"
              onClick={()=>addM.mutate({name:newName.trim(),type:addType,icon:"Tag",color:newColor})}
              disabled={!newName.trim()||addM.isPending}>
              {addM.isPending?"Создаётся…":"Создать"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editCat} onOpenChange={o=>{ if(!o) setEditCat(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Редактировать категорию</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Название</label>
              <Input value={editName} onChange={e=>setEditName(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&editM.mutate({id:editCat!.id,data:{name:editName,color:editColor}})}
                autoFocus />
            </div>
            <div className="space-y-1.5"><label className="text-sm font-medium">Цвет</label>{colorPicker(editColor,setEditColor)}</div>
            <Button className="w-full"
              onClick={()=>editM.mutate({id:editCat!.id,data:{name:editName,color:editColor}})}
              disabled={!editName.trim()||editM.isPending}>
              {editM.isPending?"Сохраняется…":"Сохранить"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
