import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Reorder, useDragControls } from "framer-motion";
import {
  GripVertical, Plus, Trash2, Pencil
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

const COLOR_OPTIONS = [
  "#20808D", "#437A22", "#A84B2F", "#7A39BB", "#D19900",
  "#006494", "#944454", "#848456", "#2E86AB", "#E84855",
  "#3BB273", "#F18F01",
];

function CategoryItem({
  cat,
  onEdit,
  onDelete,
}: {
  cat: Category;
  onEdit: (cat: Category) => void;
  onDelete: (cat: Category) => void;
}) {
  const controls = useDragControls();

  return (
    <Reorder.Item
      value={cat}
      dragListener={false}
      dragControls={controls}
      className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card shadow-sm select-none touch-none"
      whileDrag={{ scale: 1.03, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 50 }}
      layout
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
    >
      {/* Drag handle — единственная зона для перетаскивания */}
      <div
        className="cursor-grab active:cursor-grabbing touch-none p-1 -ml-1 flex-shrink-0"
        onPointerDown={(e) => controls.start(e)}
      >
        <GripVertical size={16} className="text-muted-foreground/50" />
      </div>

      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-sm font-bold flex-shrink-0 shadow-sm"
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
    </Reorder.Item>
  );
}

function CategorySection({
  title,
  type,
  categories,
  onReorder,
  onEdit,
  onDelete,
  onAdd,
}: {
  title: string;
  type: "income" | "expense";
  categories: Category[];
  onReorder: (type: "income" | "expense", order: number[]) => void;
  onEdit: (cat: Category) => void;
  onDelete: (cat: Category) => void;
  onAdd: (type: "income" | "expense") => void;
}) {
  const [items, setItems] = useState<Category[]>(categories);

  // sync when server data updates
  if (
    categories.length !== items.length ||
    categories.some((c, i) => c.id !== items[i]?.id || c.name !== items[i]?.name || c.color !== items[i]?.color)
  ) {
    setItems(categories);
  }

  const handleReorderEnd = () => {
    onReorder(type, items.map(c => c.id));
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
        <div className="text-xs text-muted-foreground text-center py-6 rounded-xl border border-dashed border-border">
          Нет категорий
        </div>
      ) : (
        <Reorder.Group
          axis="y"
          values={items}
          onReorder={setItems}
          className="space-y-2"
          as="div"
        >
          {items.map(cat => (
            <CategoryItem
              key={cat.id}
              cat={cat}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </Reorder.Group>
      )}

      {/* invisible drop zone to trigger save */}
      <div onPointerUp={handleReorderEnd} className="h-0" />
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

  const [editCat, setEditCat] = useState<Category | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");

  const [deleteCat, setDeleteCat] = useState<Category | null>(null);

  const { data: categories = [], isLoading } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const incomeCategories = [...categories.filter(c => c.type === "income")].sort((a, b) => a.sortOrder - b.sortOrder);
  const expenseCategories = [...categories.filter(c => c.type === "expense")].sort((a, b) => a.sortOrder - b.sortOrder);

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
        onDelete={setDeleteCat}
        onAdd={(t) => { setAddType(t); setAddOpen(true); }}
      />
      <CategorySection
        title="Расходы"
        type="expense"
        categories={expenseCategories}
        onReorder={(type, order) => reorderMutation.mutate({ type, order })}
        onEdit={(cat) => { setEditCat(cat); setEditName(cat.name); setEditColor(cat.color); }}
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
                onKeyDown={e => e.key === "Enter" && addMutation.mutate({ name: newName.trim(), type: addType, icon: "Tag", color: newColor })}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Цвет</label>
              <div className="flex flex-wrap gap-2">
                {COLOR_OPTIONS.map(c => (
                  <button
                    key={c} type="button"
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
                  <button
                    key={c} type="button"
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
              onClick={() => editMutation.mutate({ id: editCat!.id, data: { name: editName, color: editColor } })}
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
