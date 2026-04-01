import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface Props {
  id: number;
  children: ReactNode;
  /** Disable drag for transfer incoming-leg rows (they are hidden) */
  disabled?: boolean;
}

export function DraggableTransactionItem({ id, children, disabled = false }: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    position: isDragging ? ("relative" as const) : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group/drag relative",
        isDragging && "opacity-60 shadow-lg rounded-lg bg-background",
      )}
    >
      {/* Drag handle — only visible on hover */}
      {!disabled && (
        <button
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label="Перетащить транзакцию"
          className={cn(
            "absolute left-0 top-1/2 -translate-y-1/2 z-10",
            "flex items-center justify-center w-5 h-full",
            "opacity-0 group-hover/drag:opacity-100 transition-opacity",
            "cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground",
            "touch-none",
          )}
        >
          <GripVertical size={14} />
        </button>
      )}
      {/* Shift content right to make room for handle */}
      <div className={cn(!disabled && "pl-5")}>
        {children}
      </div>
    </div>
  );
}
