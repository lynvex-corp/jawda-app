import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Indicator } from "@/lib/queries/indicators";

export function ConfigTab({
  indicador,
  onSalvar,
}: {
  indicador: Indicator;
  onSalvar: (patch: {
    nome: string;
    descricao: string;
    formula: string;
    unidade: string;
    toleranciaPct: number;
    ciclosParaDisparo: number;
  }) => void;
}) {
  const [nome, setNome] = useState(indicador.nome);
  const [descricao, setDescricao] = useState(indicador.descricao);
  const [formula, setFormula] = useState(indicador.formula);
  const [unidade, setUnidade] = useState(indicador.unidade);
  const [toleranciaPct, setToleranciaPct] = useState(indicador.toleranciaPct);
  const [ciclosParaDisparo, setCiclosParaDisparo] = useState(indicador.ciclosParaDisparo);

  return (
    <Card className="rounded-2xl border-border/80">
      <CardContent className="grid gap-4 p-5 md:grid-cols-2">
        <Campo label="Nome">
          <Input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="rounded-lg text-sm"
          />
        </Campo>
        <Campo label="Código">
          <Input
            value={indicador.codigo}
            readOnly
            className="rounded-lg bg-muted/40 font-mono text-xs"
          />
        </Campo>
        <Campo label="Descrição" full>
          <Textarea
            rows={2}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            className="rounded-lg text-sm"
          />
        </Campo>
        <Campo label="Fórmula" full>
          <Textarea
            rows={2}
            value={formula}
            onChange={(e) => setFormula(e.target.value)}
            className="rounded-lg font-mono text-xs"
          />
        </Campo>
        <Campo label="Unidade">
          <Input
            value={unidade}
            onChange={(e) => setUnidade(e.target.value)}
            className="rounded-lg text-sm"
          />
        </Campo>
        <Campo label="Meta">
          <Input
            value={`${indicador.meta}${indicador.unidade}`}
            readOnly
            className="rounded-lg bg-muted/40 text-sm"
          />
          <p className="mt-1 text-[10px] text-muted-foreground">
            Edite pelo menu "Editar meta" no topo — preserva histórico.
          </p>
        </Campo>
        <Campo label="Tolerância para amarelo (%)">
          <Input
            type="number"
            value={toleranciaPct}
            onChange={(e) => setToleranciaPct(Number(e.target.value))}
            className="rounded-lg text-sm"
          />
        </Campo>
        <Campo label="Responsável pela medição">
          <Input
            value={indicador.responsavelMedicaoNome}
            readOnly
            className="rounded-lg bg-muted/40 text-sm"
          />
        </Campo>
        <Campo label="Responsável pela análise">
          <Input
            value={indicador.responsavelAnaliseNome}
            readOnly
            className="rounded-lg bg-muted/40 text-sm"
          />
        </Campo>
        <Campo label="Ciclos fora antes de sugerir NC">
          <Input
            type="number"
            value={ciclosParaDisparo}
            onChange={(e) => setCiclosParaDisparo(Number(e.target.value))}
            className="rounded-lg text-sm"
          />
        </Campo>
        <div className="md:col-span-2">
          <Button
            className="rounded-lg bg-brand text-white hover:bg-brand/90"
            onClick={() =>
              onSalvar({ nome, descricao, formula, unidade, toleranciaPct, ciclosParaDisparo })
            }
          >
            Salvar configuração
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Campo({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={full ? "space-y-1.5 md:col-span-2" : "space-y-1.5"}>
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
