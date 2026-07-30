import { Link } from "@tanstack/react-router";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { semaforo, semaforoCor } from "@/lib/kpi-data";
import type { Indicator } from "@/lib/queries/indicators";
import type { Measurement } from "@/lib/queries/indicator-measurements";
import { SemaforoChip, TendenciaIcon } from "./shared";

function scoreIndicador(indicador: Indicator, ultimoValor: number | null) {
  if (ultimoValor === null) return 999;
  return indicador.polaridade === "menor_melhor"
    ? (indicador.meta / Math.max(ultimoValor, 0.001)) * 100
    : (ultimoValor / Math.max(indicador.meta, 0.001)) * 100;
}

export function TabelaIndicadores({
  indicadores,
  medicoesPorIndicador,
}: {
  indicadores: Indicator[];
  medicoesPorIndicador: Record<string, Measurement[]>;
}) {
  const ordenados = [...indicadores].sort((a, b) => {
    const va = medicoesPorIndicador[a.id];
    const vb = medicoesPorIndicador[b.id];
    const ultimoA = va?.length ? va[va.length - 1].valor : null;
    const ultimoB = vb?.length ? vb[vb.length - 1].valor : null;
    return scoreIndicador(a, ultimoA) - scoreIndicador(b, ultimoB);
  });

  return (
    <div className="overflow-hidden rounded-2xl border border-border/80">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40">
            <TableHead className="w-[110px] text-[11px]">Detalhamento</TableHead>
            <TableHead className="text-[11px]">Código</TableHead>
            <TableHead className="text-[11px]">Nome</TableHead>
            <TableHead className="text-[11px]">Objetivo</TableHead>
            <TableHead className="text-[11px]">Processo</TableHead>
            <TableHead className="text-[11px]">Meta</TableHead>
            <TableHead className="text-[11px]">Último resultado</TableHead>
            <TableHead className="text-[11px]">Tendência</TableHead>
            <TableHead className="text-[11px]">Status</TableHead>
            <TableHead className="text-[11px]">Responsável</TableHead>
            <TableHead className="text-[11px]">Última medição</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ordenados.map((k) => {
            const medicoes = medicoesPorIndicador[k.id] ?? [];
            const valores = medicoes.map((m) => m.valor);
            const v = valores.length ? valores[valores.length - 1] : null;
            const ultima = medicoes[medicoes.length - 1];
            return (
              <TableRow key={k.id} className="text-xs hover:bg-muted/40">
                <TableCell>
                  <Link to="/indicadores/$id" params={{ id: k.id }}>
                    <Button size="sm" variant="outline" className="h-7 rounded-lg text-[11px]">
                      <Eye className="mr-1 h-3 w-3" /> Ver
                    </Button>
                  </Link>
                </TableCell>
                <TableCell className="font-mono text-[10px] text-brand">{k.codigo}</TableCell>
                <TableCell className="font-medium text-foreground">{k.nome}</TableCell>
                <TableCell className="text-muted-foreground">{k.objetivoNome}</TableCell>
                <TableCell className="text-muted-foreground">{k.processo ?? "—"}</TableCell>
                <TableCell>
                  {k.meta}
                  {k.unidade}
                </TableCell>
                <TableCell className="font-semibold" style={{ color: semaforoCor[semaforo(v, k)] }}>
                  {v ?? "—"}
                  {v !== null ? k.unidade : ""}
                </TableCell>
                <TableCell>
                  <TendenciaIcon valores={valores} polaridade={k.polaridade} />
                </TableCell>
                <TableCell>
                  <SemaforoChip valor={v} indicador={k} />
                </TableCell>
                <TableCell className="text-muted-foreground">{k.responsavelMedicaoNome}</TableCell>
                <TableCell className="text-muted-foreground">
                  {ultima ? new Date(ultima.criadoEm).toLocaleDateString("pt-BR") : "—"}
                </TableCell>
              </TableRow>
            );
          })}
          {!ordenados.length && (
            <TableRow>
              <TableCell colSpan={11} className="py-8 text-center text-xs text-muted-foreground">
                Nenhum indicador encontrado.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
