import { AppShell } from "@/components/app/app-shell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { ApresentacaoEmpresaTab } from "@/components/identidade/apresentacao-empresa";
import { PoliticaQualidadeTab } from "@/components/identidade/politica-qualidade";
import { DiretrizesEstrategicasPage } from "@/components/estrategia/diretrizes-estrategicas";

/* ============================================================
 * Identidade Organizacional (Bloco 2, item 10; regra de permissão revista
 * no Bloco 7, item 2).
 *
 * Reúne no topo de Estratégia as três peças que respondem "quem é esta
 * organização": a apresentação institucional, a Política da Qualidade (que
 * vinha de Documentos) e as diretrizes de Missão/Visão/Valores (que estavam
 * soltas no menu de Estratégia).
 *
 * O submódulo inteiro — as 3 abas — é criado e editado exclusivamente pela
 * Diretoria (role 'admin', "Administrador do Cliente" no vocabulário do
 * sistema). Gestor da Qualidade deixou de poder elaborar rascunho aqui
 * (podia antes do Bloco 7); o módulo Documentos, à parte, continua aberto
 * também a Gestor da Qualidade.
 * ============================================================ */

export function IdentidadeOrganizacionalPage() {
  const { currentOrg } = useAuth();
  const isDiretoria = currentOrg?.role === "admin";

  return (
    <AppShell>
      <div className="mx-auto max-w-[1100px] space-y-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Identidade Organizacional
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Registre quem é a organização, a política que orienta a qualidade e as diretrizes que
            guiam as decisões.
          </p>
        </header>

        <Tabs defaultValue="apresentacao">
          <TabsList className="rounded-lg bg-muted/60 p-1">
            <TabsTrigger value="apresentacao" className="rounded-md text-xs">
              Apresentação da Empresa
            </TabsTrigger>
            <TabsTrigger value="politica" className="rounded-md text-xs">
              Política da Qualidade
            </TabsTrigger>
            <TabsTrigger value="diretrizes" className="rounded-md text-xs">
              Missão, Visão, Valores e Propósito
            </TabsTrigger>
          </TabsList>

          <TabsContent value="apresentacao" className="mt-4">
            <ApresentacaoEmpresaTab isDiretoria={isDiretoria} />
          </TabsContent>

          <TabsContent value="politica" className="mt-4">
            <PoliticaQualidadeTab isDiretoria={isDiretoria} />
          </TabsContent>

          <TabsContent value="diretrizes" className="mt-4">
            <DiretrizesEstrategicasPage embedded />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
