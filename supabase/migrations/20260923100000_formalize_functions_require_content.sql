-- Mesma correção de causa raiz de 20260921090000
-- (formalize_quality_policy), aplicada nas 3 funções irmãs que têm a
-- mesma lacuna: formalizar sem validar que existe conteúdo. Preventivo —
-- não há incidente conhecido nestas três hoje, mas é a mesma classe de
-- bug que gerou o dado quebrado da Cedro em quality_policy (ver
-- 20260923090000).
--
-- "Conteúdo vazio" é definido por documento, não existe uma coluna
-- `content` única nos três:
--   - company_presentation: tem `content` (mesmo desenho de quality_policy).
--   - strategic_directives: 3 campos (missao/visao/proposito) — bloqueia
--     só se os TRÊS estiverem vazios (mesmo padrão frouxo já usado por
--     `enforce_company_presentation_rules`, que também não exige todos os
--     campos preenchidos — só impede formalizar 100% em branco).
--   - stakeholder_analyses: não tem texto próprio, o conteúdo é a lista de
--     `stakeholders` vinculada — bloqueia se a análise não tem nenhuma
--     parte interessada cadastrada.

create or replace function public.formalize_company_presentation(p_id uuid)
returns company_presentation
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_result company_presentation;
  v_content text;
begin
  select content into v_content
    from company_presentation
    where id = p_id and status = 'rascunho'
    for update;

  if not found then
    raise exception 'Apresentação não encontrada, sem acesso, ou já formalizada';
  end if;

  if v_content is null or btrim(v_content) = '' then
    raise exception 'Preencha o texto da Apresentação da Empresa antes de formalizar';
  end if;

  update company_presentation
     set status = 'formalizada'
   where id = p_id
   returning * into v_result;

  return v_result;
end;
$$;

create or replace function public.formalize_strategic_directives(p_id uuid)
returns strategic_directives
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_result strategic_directives;
  v_label text;
  v_missao text;
  v_visao text;
  v_proposito text;
begin
  select missao, visao, proposito into v_missao, v_visao, v_proposito
    from strategic_directives
    where id = p_id and status = 'rascunho'
    for update;

  if not found then
    raise exception 'Diretrizes não encontradas, sem acesso, ou já formalizadas';
  end if;

  if coalesce(btrim(v_missao), '') = ''
     and coalesce(btrim(v_visao), '') = ''
     and coalesce(btrim(v_proposito), '') = '' then
    raise exception 'Preencha ao menos um dos campos (Missão, Visão ou Propósito) antes de formalizar';
  end if;

  v_label := public.next_strategic_directives_version_label();

  update strategic_directives
    set status = 'formalizada', version_label = v_label
    where id = p_id
    returning * into v_result;

  return v_result;
end;
$$;

create or replace function public.formalize_stakeholder_analysis(p_analysis_id uuid)
returns stakeholder_analyses
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_result stakeholder_analyses;
  v_label text;
  v_has_stakeholder boolean;
begin
  perform 1 from stakeholder_analyses where id = p_analysis_id and status = 'rascunho' for update;
  if not found then
    raise exception 'Análise não encontrada, sem acesso, ou já formalizada';
  end if;

  select exists (
    select 1 from stakeholders
    where stakeholder_analysis_id = p_analysis_id
      and btrim(coalesce(nome, '')) <> ''
  ) into v_has_stakeholder;

  if not v_has_stakeholder then
    raise exception 'Cadastre ao menos uma parte interessada antes de formalizar';
  end if;

  v_label := public.next_stakeholder_analysis_version_label();

  update stakeholder_analyses
    set status = 'formalizada',
        version_label = v_label,
        formalized_at = now(),
        formalized_by = auth.uid()
    where id = p_analysis_id
    returning * into v_result;

  return v_result;
end;
$$;
