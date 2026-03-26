import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  GripVertical, Plus, Trash2, Pencil, Check, X, Tag
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogDescription
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";

interface Category {
  id: number;
  name: string;
  type: string;
  icon: string;
  color: string;
  isDefault: boolean;
  sortOrder: number;
}

const ICON_OPTIONS = [
  "Tag", "ShoppingCart", "Car", "Home", "Heart", "Briefcase",
  "Coffee", "Gamepad2", "Dumbbell", "BookOpen", "Shirt", "Plane",
  "Gift", "Music", "UtensilsCrossed", "Tv", "Zap", "DollarSign",
  "Laptop", "Shield", "TrendingUp", "Receipt",
];

const COLOR_OPTIONS = [
  "#20808D", "#437A22", "#A84B2F", "#7A39BB", "#D19900",
  "#006494", "#944454", "#848456", "#2E86AB", "#E84855",
  "#3BB273", "#F18F01",
];

interface DraggableTileProps {
  cat: Category;
  index: number;
  onDragStart: (index: number) => void;
  onDragOver: (index: number) => void;
  onDragEnd: () => void;
  draggingIndex: number | null;
  onEdit: (cat: Category) => void;
  onDelete: (cat: Category) => void;
}

function CategoryTile({ cat, index, onDragStart, onDragOver, onDragEnd, draggingIndex, onEdit, onDelete }: DraggableTileProps) {
  const isDragging = draggingIndex === index;
  return (
    <div
      draggable
      onDragStart={() => onDragStart(index)}
      onDragOver={(e) => { e.preventDefault(); onDragOver(index); }}
      onDragEnd={onDragEnd}
      className={`flex items-center gap-3 p-3 rounded-xl border bg-card shadow-sm transition-all duration-150 cursor-grab active:cursor-grabbing select-none
        ${
          isDragging
            ? "opacity-40 scale-95 border-primary/40 shadow-none"
            : "border-border hover:border-primary/30 hover:shadow-md"
        }`}
    >
      <GripVertical size={16} className="text-muted-foreground/50 flex-shrink-0" />
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-sm"
        style={{ backgroundColor: cat.color }}
      >
        {cat.name.slice(0, 1).toUpperCase()}
      </div>
      <span className="flex-1 text-sm font-medium truncate">{cat.name}</span>
      {!cat.isDefault && (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost" size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={() => onEdit(cat)}
          >
            <Pencil size={13} />
          </Button>
          <Button
            variant="ghost" size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={() => onDelete(cat)}
          >
            <Trash2 size={13} />
          </Button>
        </div>
      )}
    </div>
  );
}

interface SectionProps {
  title: string;
  type: "income" | "expense";
  categories: Category[];
  onReorder: (type: "income" | "expense", newOrder: number[]) => void;
  onEdit: (cat: Category) => void;
  onDelete: (cat: Category) => void;
  onAdd: (type: "income" | "expense") => void;
}

function CategorySection({ title, type, categories, onReorder, onEdit, onDelete, onAdd }: SectionProps) {
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [localOrder, setLocalOrder] = useState<Category[] | null>(null);

  const displayed = localOrder ?? categories;

  const handleDragStart = (index: number) => {
    setDraggingIndex(index);
    setLocalOrder([...displayed]);
  };

  const handleDragOver = (overIndex: number) => {
    if (draggingIndex === null || draggingIndex === overIndex) return;
    const updated = [...(localOrder ?? categories)];
    const [moved] = updated.splice(draggingIndex, 1);
    updated.splice(overIndex, 0, moved);
    setLocalOrder(updated);
    setDraggingIndex(overIndex);
  };

  const handleDragEnd = () => {
    if (localOrder) {
      onReorder(type, localOrder.map(c => c.id));
    }
    setDraggingIndex(null);
    setLocalOrder(null);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{title}</h3>
        <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => onAdd(type)}>
          <Plus size={13} /> Добавить
        </Button>
      </div>
      <div className="space-y-2">
        {displayed.length === 0 && (
          <div className="text-xs text-muted-foreground text-center py-4 rounded-xl border border-dashed border-border">
            Нет категорий
          </div>
        )}
        {displayed.map((cat, index) => (
          <CategoryTile
            key={cat.id}
            cat={cat}
            index={index}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            draggingIndex={draggingIndex}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  );
}

export default function CategoryManager() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [addOpen, setAddOpen] = useState(false);
  const [addType, setAddType] = useState<"income" | "expense">("expense");
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(COLOR_OPTIONS[0]);
  const [newIcon, setNewIcon] = useState(ICON_OPTIONS[0]);

  const [editCat, setEditCat] = useState<Category | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");

  const [deleteCat, setDeleteCat] = useState<Category | null>(null);

  const { data: categories = [], isLoading } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const incomeCategories = categories.filter(c => c.type === "income");
  const expenseCategories = categories.filter(c => c.type === "expense");

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
      setDeleteCat(null);
    },
    onError: () => toast({ title: "Ошибка удаления", variant: "destructive" }),
  });

  const reorderMutation = useMutation({
    mutationFn: async ({ type, order }: { type: "income" | "expense"; order: number[] }) => {
      await apiRequest("PATCH", "/api/categories/reorder", { type, order });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/categories"] });
    },
  });

  const handleAdd = () => {
    if (!newName.trim()) return;
    addMutation.mutate({ name: newName.trim(), type: addType, icon: newIcon, color: newColor });
  };

  const handleEdit = (cat: Category) => {
    setEditCat(cat);
    setEditName(cat.name);
    setEditColor(cat.color);
  };

  const handleEditSave = () => {
    if (!editCat) return;
    editMutation.mutate({ id: editCat.id, data: { name: editName, color: editColor } });
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground py-6 text-center">Загрузка категорий…</div>;
  }

  return (
    <div className="space-y-6">
      <CategorySection
        title="Доходы"
        type="income"
        categories={incomeCategories}
        onReorder={(type, order) => reorderMutation.mutate({ type, order })}
        onEdit={handleEdit}
        onDelete={setDeleteCat}
        onAdd={(t) => { setAddType(t); setAddOpen(true); }}
      />
      <CategorySection
        title="Расходы"
        type="expense"
        categories={expenseCategories}
        onReorder={(type, order) => reorderMutation.mutate({ type, order })}
        onEdit={handleEdit}
        onDelete={setDeleteCat}
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
                onKeyDown={e => e.key === "Enter" && handleAdd()}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Цвет</label>
              <div className="flex flex-wrap gap-2">
                {COLOR_OPTIONS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewColor(c)}
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
              onClick={handleAdd}
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
                onKeyDown={e => e.key === "Enter" && handleEditSave()}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Цвет</label>
              <div className="flex flex-wrap gap-2">
                {COLOR_OPTIONS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setEditColor(c)}
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
              onClick={handleEditSave}
              disabled={!editName.trim() || editMutation.isPending}
            >
              {editMutation.isPending ? "Сохраняется…" : "Сохранить"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ALERT: DELETE */}
      <AlertDialog open={!!deleteCat} onOpenChange={(o) => { if (!o) setDeleteCat(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить категорию?</AlertDialogTitle>
            <AlertDialogDescription>
              Категория «{deleteCat?.name}» будет удалена. Транзакции с этой категорией сохранятся.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteCat && deleteMutation.mutate(deleteCat.id)}
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
