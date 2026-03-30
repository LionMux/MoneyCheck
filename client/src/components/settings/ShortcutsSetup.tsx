import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

// Определяем базовый URL сервера
const BASE_URL = window.location.origin;

function downloadShortcut(filename: string) {
  // Создаём временную ссылку и программно кликаем по ней
  // iOS Safari при переходе на .shortcut URL автоматически
  // открывает приложение «Команды» и предлагает добавить shortcut
  const link = document.createElement("a");
  link.href = `${BASE_URL}/api/ios/shortcuts/${filename}`;
  link.click();
}

export function ShortcutsSetup() {
  const { toast } = useToast();

  const handleDownload = (type: "expense" | "income") => {
    const filename =
      type === "expense" ? "FinWiseRashod.shortcut" : "FinWiseDohod.shortcut";
    const label = type === "expense" ? "расхода" : "дохода";

    try {
      downloadShortcut(filename);
      toast({
        title: "Открываем «Команды»",
        description: `Подтвердите добавление команды ${label} в приложении «Команды»`,
      });
    } catch {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Не удалось открыть файл. Убедитесь, что вы на iPhone.",
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Заголовок */}
      <div>
        <h3 className="text-base font-semibold">Быстрые кнопки для iPhone</h3>
        <p className="text-sm text-muted-foreground mt-0.5">
          Добавляйте расходы и доходы в один тап — с рабочего стола или экрана
          блокировки.
        </p>
      </div>

      {/* iOS badge */}
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground text-xs font-medium">
        <span>🍎</span>
        <span>Только для iOS</span>
      </div>

      {/* Карточки кнопок */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Расход */}
        <Card className="border">
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-col gap-3">
              <div>
                <p className="text-sm font-medium">Расход</p>
                <p className="text-xs text-muted-foreground">
                  Быстро внести трату с экрана iPhone
                </p>
              </div>
              <Button
                size="sm"
                className="w-full"
                onClick={() => handleDownload("expense")}
              >
                Добавить команду расхода
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Доход */}
        <Card className="border">
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-col gap-3">
              <div>
                <p className="text-sm font-medium">Доход</p>
                <p className="text-xs text-muted-foreground">
                  Быстро внести поступление с экрана iPhone
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() => handleDownload("income")}
              >
                Добавить команду дохода
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Подсказка */}
      <p className="text-xs text-muted-foreground">
        Если нет приложения «Команды» — скачайте его бесплатно в App Store.
      </p>
    </div>
  );
}
