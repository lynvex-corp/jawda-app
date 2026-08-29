import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Plus, LifeBuoy } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useMyTickets,
  useCreateTicket,
  type SupportTicketType,
  type SupportTicketStatus,
} from "@/lib/queries/support";

const TYPE_LABEL: Record<SupportTicketType, string> = {
  duvida: "Dúvida",
  erro_bug: "Erro / Bug",
  melhoria: "Melhoria",
  suporte_metodologico: "Suporte Metodológico",
  treinamento: "Treinamento",
};

const STATUS_LABEL: Record<SupportTicketStatus, string> = {
  aberto: "Aberto",
  em_atendimento: "Em Atendimento",
  aguardando_cliente: "Aguardando Você",
  resolvido: "Resolvido",
  fechado: "Fechado",
};

const STATUS_CLASSES: Record<SupportTicketStatus, string> = {
  aberto:
    "bg-[color:var(--severity-high)]/15 text-[color:var(--severity-high)] border-[color:var(--severity-high)]/30",
  em_atendimento: "bg-brand/15 text-brand border-brand/30",
  aguardando_cliente:
    "bg-[color:var(--warning)]/20 text-[color:var(--warning)] border-[color:var(--warning)]/40",
  resolvido:
    "bg-[color:var(--success)]/15 text-[color:var(--success)] border-[color:var(--success)]/30",
  fechado: "bg-muted text-muted-foreground border-border",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function SuportePage() {
  const { data: tickets = [], isLoading } = useMyTickets();
  const createTicket = useCreateTicket();

  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [type, setType] = useState<SupportTicketType | "">("");
  const [description, setDescription] = useState("");

  function resetForm() {
    setSubject("");
    setType("");
    setDescription("");
  }

  function handleSubmit() {
    if (!subject.trim() || !type || !description.trim()) {
      toast.error("Preencha assunto, tipo e descrição.");
      return;
    }
    createTicket.mutate(
      { subject: subject.trim(), type, description: description.trim() },
      {
        onSuccess: () => {
          toast.success("Chamado aberto com sucesso.");
          setOpen(false);
          resetForm();
        },
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : "Erro ao abrir chamado."),
      },
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-[1100px] space-y-5">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
              <LifeBuoy className="h-6 w-6 text-brand" />
              Suporte
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Fale com a equipe Jáwda. Horário comercial, resposta em até 1 dia útil.
            </p>
          </div>
          <Dialog
            open={open}
            onOpenChange={(v) => {
              setOpen(v);
              if (!v) resetForm();
            }}
          >
            <DialogTrigger asChild>
              <Button className="rounded-lg bg-brand text-white hover:bg-brand/90">
                <Plus className="mr-1.5 h-4 w-4" />
                Novo Chamado
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Abrir novo chamado</DialogTitle>
                <DialogDescription>
                  Descreva sua dúvida, problema ou sugestão. Nossa equipe responde em até 1 dia
                  útil.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Assunto</label>
                  <Input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Resumo do chamado"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Tipo</label>
                  <Select value={type} onValueChange={(v) => setType(v as SupportTicketType)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(TYPE_LABEL) as SupportTicketType[]).map((t) => (
                        <SelectItem key={t} value={t}>
                          {TYPE_LABEL[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Descrição</label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Conte com detalhes o que está acontecendo"
                    rows={5}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  className="bg-brand text-white hover:bg-brand/90"
                  onClick={handleSubmit}
                  disabled={createTicket.isPending}
                >
                  {createTicket.isPending ? "Abrindo..." : "Abrir Chamado"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </header>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Assunto</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Aberto em</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                      Carregando...
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && tickets.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                      Nenhum chamado aberto ainda.
                    </TableCell>
                  </TableRow>
                )}
                {tickets.map((t) => (
                  <TableRow key={t.id} className="cursor-pointer hover:bg-muted/40">
                    <TableCell>
                      <Link
                        to="/suporte/$id"
                        params={{ id: t.id }}
                        className="block font-medium text-foreground"
                      >
                        {t.subject}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {TYPE_LABEL[t.type]}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_CLASSES[t.status]}>
                        {STATUS_LABEL[t.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(t.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Link to="/suporte/$id" params={{ id: t.id }}>
                        <Button variant="ghost" size="sm">
                          Abrir
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
