import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, MapPin, Clock, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuditPlanItems, useUpsertPlanItem } from "@/lib/queries/audits";
import { useOrgMembers } from "@/lib/queries/action-plans";

export function AbaPlano({ auditId }: { auditId: string }) {
  const { data: items = [] } = useAuditPlanItems(auditId);
  const { data: members = [] } = useOrgMembers();
  const upsertPlanItem = useUpsertPlanItem();

  const [dayNumber, setDayNumber] = useState("1");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("12:00");
  const [process, setProcess] = useState("");
  const [requirements, setRequirements] = useState("");
  const [auditorId, setAuditorId] = useState<string | undefined>(undefined);

  const byDay = useMemo(() => {
    const map = new Map<number, typeof items>();
    for (const item of items) {
      if (!map.has(item.day_number)) map.set(item.day_number, []);
      map.get(item.day_number)!.push(item);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [items]);

  function addItem() {
    if (!process.trim()) {
      toast.error("Informe o processo/área a ser auditado.");
      return;
    }
    upsertPlanItem.mutate(
      {
        auditId,
        dayNumber: Number(dayNumber) || 1,
        startTime,
        endTime,
        process,
        requirements: requirements
          .split(",")
          .map((r) => r.trim())
          .filter(Boolean),
        auditorId,
        notes: undefined,
      },
      {
        onSuccess: () => {
          toast.success("Bloco adicionado ao plano");
          setProcess("");
          setRequirements("");
        },
      },
    );
  }

  return (
    <div className="space-y-4">
      <Card className="rounded-xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Adicionar bloco à agenda</CardTitle>
          <p className="text-xs text-muted-foreground">
            Um bloco por dia/horário/processo. A agenda fica visível para toda a equipe auditora.
          </p>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-6">
          <div>
            <Label className="text-xs">Dia</Label>
            <Input
              type="number"
              min={1}
              value={dayNumber}
              onChange={(e) => setDayNumber(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">Início</Label>
            <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Fim</Label>
            <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs">Processo/área</Label>
            <Input
              value={process}
              onChange={(e) => setProcess(e.target.value)}
              placeholder="Ex.: Comercial"
            />
          </div>
          <div>
            <Label className="text-xs">Auditor</Label>
            <Select value={auditorId} onValueChange={setAuditorId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar" />
              </SelectTrigger>
              <SelectContent>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-5">
            <Label className="text-xs">Requisitos cobertos (separados por vírgula)</Label>
            <Input
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
              placeholder="Ex.: 4.3, 8.1"
            />
          </div>
          <div className="flex items-end">
            <Button
              className="w-full gap-1.5 bg-brand hover:bg-brand/90"
              onClick={addItem}
              disabled={upsertPlanItem.isPending}
            >
              <Plus className="h-4 w-4" /> Adicionar
            </Button>
          </div>
        </CardContent>
      </Card>

      {byDay.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhum bloco cadastrado ainda.</p>
      )}

      {byDay.map(([day, dayItems]) => (
        <Card key={day} className="rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Dia {day}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {dayItems.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/20 p-3 text-sm"
              >
                <span className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  {item.start_time.slice(0, 5)}–{item.end_time.slice(0, 5)}
                </span>
                <span className="inline-flex items-center gap-1 font-medium text-foreground">
                  <MapPin className="h-3.5 w-3.5 text-brand" />
                  {item.process}
                </span>
                {item.requirements.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {item.requirements.map((r) => (
                      <span
                        key={r}
                        className="rounded bg-brand-soft px-1.5 py-0.5 font-mono text-[10px] text-brand"
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                )}
                {item.auditor && (
                  <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <User className="h-3.5 w-3.5" /> {item.auditor.full_name}
                  </span>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
