-- Bloco 2, item 3: a versão da Análise de Cenário passa a ser sequencial
-- (001, 002, 003…) gerada pelo banco, em vez de rótulo de texto livre
-- digitado pelo usuário no modal de formalização.
--
-- Por que no banco e não na exibição: numerar por posição na listagem
-- (1º, 2º, 3º…) faria o número de uma versão mudar retroativamente se
-- outra fosse inserida ou reordenada — e versão formalizada é evidência de
-- auditoria, o identificador não pode se mexer depois de emitido. É o mesmo
-- motivo pelo qual scope_documents já usa revision_number persistido com
-- unique(org_id, revision_number).
--
-- version_label é PRESERVADA, não removida: as análises já formalizadas têm
-- rótulos que alguém escreveu e que podem estar citados em ata ou auditoria.
-- Apagá-los destruiria evidência. A coluna deixa de ser alimentada daqui em
-- diante e some da UI de formalização; o histórico continua exibindo o
-- rótulo antigo ao lado do número quando ele existir.

alter table swot_analyses
  add column if not exists version_number int;

-- Backfill: numera o que já está formalizado na ordem em que foi formalizado.
with numeradas as (
  select id,
         row_number() over (partition by org_id order by formalized_at, created_at) as n
  from swot_analyses
  where status = 'formalizada'
)
update swot_analyses a
   set version_number = numeradas.n
  from numeradas
 where a.id = numeradas.id
   and a.version_number is null;

alter table swot_analyses
  drop constraint if exists swot_analyses_version_number_unico;
alter table swot_analyses
  add constraint swot_analyses_version_number_unico unique (org_id, version_number);

-- O check original exigia version_label preenchida ao formalizar. Como o
-- rótulo livre deixa de ser pedido, a exigência passa para version_number —
-- senão a nova RPC não conseguiria formalizar nada.
do $$
declare
  v_nome text;
begin
  select con.conname into v_nome
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'swot_analyses'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%version_label%'
  limit 1;

  if v_nome is not null then
    execute format('alter table swot_analyses drop constraint %I', v_nome);
  end if;
end $$;

alter table swot_analyses
  add constraint swot_analyses_formalizada_completa
  check (
    status <> 'formalizada'
    or (version_number is not null and formalized_at is not null and formalized_by is not null)
  );

-- ============================================================
-- RPC de formalização: número gerado pelo banco, sem parâmetro de rótulo.
--
-- A assinatura antiga (p_analysis_id, p_version_label) é derrubada para não
-- ficarem duas sobrecargas ativas — com as duas no catálogo, uma chamada
-- antiga continuaria funcionando e gravando rótulo livre sem número, que é
-- exatamente o estado que esta migração elimina.
-- ============================================================

drop function if exists public.formalize_swot_analysis(uuid, text);

create or replace function public.formalize_swot_analysis(
  p_analysis_id uuid
)
returns swot_analyses
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_org_id uuid := (auth.jwt() ->> 'org_id')::uuid;
  v_proximo int;
  v_result swot_analyses;
begin
  -- coalesce para o caso de ser a primeira versão da organização
  select coalesce(max(version_number), 0) + 1 into v_proximo
    from swot_analyses
   where org_id = v_org_id;

  update swot_analyses
     set status = 'formalizada',
         version_number = v_proximo,
         formalized_at = now(),
         formalized_by = auth.uid()
   where id = p_analysis_id
     and status = 'rascunho'
     and org_id = v_org_id
   returning * into v_result;

  if v_result.id is null then
    raise exception 'Análise não encontrada, sem acesso, ou já formalizada';
  end if;

  return v_result;
end;
$$;

-- ============================================================
-- Bloco 2, item 4: escolher qual análise anterior serve de modelo.
--
-- Antes a RPC copiava sempre a última formalizada, sem perguntar. Agora
-- recebe a origem: um id específico copia aquela análise; null começa em
-- branco.
--
-- O default null preserva a compatibilidade de ASSINATURA (uma chamada sem
-- argumento continua válida e não dá erro), mas NÃO a de comportamento: ela
-- passou de "copia a última formalizada" para "cria rascunho vazio". Quem
-- escolhe a origem agora é o usuário, no modal de nova versão — copiar por
-- omissão traria cards que ele não pediu. A mesma ressalva está repetida
-- dentro do corpo da função e no comment on function, no fim do arquivo.
-- ============================================================

create or replace function public.start_new_swot_version(
  p_source_analysis_id uuid default null
)
returns swot_analyses
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_org_id uuid := (auth.jwt() ->> 'org_id')::uuid;
  v_new_id uuid;
  v_result swot_analyses;
begin
  -- ATENÇÃO A QUEM FOR ALTERAR ESTA FUNÇÃO:
  -- o default de p_source_analysis_id é NULL e NULL significa "começar em
  -- branco". Até 2026-09-10 esta função não tinha parâmetro nenhum e sempre
  -- copiava os cards da última versão formalizada. Portanto uma chamada sem
  -- argumento NÃO faz mais o que fazia antes: hoje ela cria um rascunho
  -- vazio. Quem escolhe a origem é o usuário, no modal de nova versão da
  -- Análise de Cenário — copiar por omissão traria cards que ele não pediu.
  if exists (select 1 from swot_analyses where org_id = v_org_id and status = 'rascunho') then
    raise exception 'Já existe um rascunho aberto. Formalize-o antes de iniciar uma nova versão.';
  end if;

  -- Valida a origem antes de criar o rascunho: sem isso, um id de outra
  -- organização criaria a versão nova e só depois copiaria zero cards,
  -- deixando o usuário com um rascunho vazio sem explicação.
  if p_source_analysis_id is not null
     and not exists (
       select 1 from swot_analyses
        where id = p_source_analysis_id
          and org_id = v_org_id
          and status = 'formalizada'
     ) then
    raise exception 'Análise de origem não encontrada ou não formalizada';
  end if;

  insert into swot_analyses (org_id, status)
    values (v_org_id, 'rascunho')
    returning id into v_new_id;

  if p_source_analysis_id is not null then
    insert into swot_cards (org_id, swot_analysis_id, quadrant, category, description, source_nc_id)
    select org_id, v_new_id, quadrant, category, description, source_nc_id
      from swot_cards
     where swot_analysis_id = p_source_analysis_id
       and deleted_at is null;   -- card removido no rascunho de origem não ressuscita
  end if;

  select * into v_result from swot_analyses where id = v_new_id;
  return v_result;
end;
$$;

-- Documentação no catálogo do Postgres: aparece em \df+ e no inspetor de
-- funções do SQL Editor, para quem for mexer sem abrir este arquivo.
comment on function public.start_new_swot_version(uuid) is
  'Cria um novo rascunho da Análise de Cenário. p_source_analysis_id = id de uma versão formalizada copia os cards dela; NULL (o default) começa em branco. MUDANÇA DE COMPORTAMENTO em 2026-09-10: antes a função não tinha parâmetro e sempre copiava a última versão formalizada — chamada sem argumento hoje cria rascunho VAZIO.';

comment on function public.formalize_swot_analysis(uuid) is
  'Formaliza a Análise de Cenário e gera o número sequencial da versão (exibido como 001, 002...). MUDANÇA em 2026-09-10: a assinatura anterior (uuid, text) recebia um rótulo de texto livre e foi removida; o número agora é gerado pelo banco.';
