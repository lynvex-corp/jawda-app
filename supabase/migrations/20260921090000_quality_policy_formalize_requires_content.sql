-- Correção de causa raiz — Política da Qualidade formalizada em branco
-- (achado em produção, Cedro Engenharia).
--
-- Investigação: a linha vazia (`quality_policy.id = 223dbc94-...`,
-- version_label = '.') foi criada e formalizada em 2026-09-14, ANTES desta
-- entrega existir — na época, `formalize_quality_policy(p_id, p_version_label)`
-- (20260825100200) só validava que o RÓTULO digitado não fosse vazio
-- (`btrim(p_version_label) = ''`); nunca validou o CONTEÚDO. O rótulo "."
-- confirma que foi formalizado por essa função antiga (rótulo livre, não
-- o padrão automático introduzido depois em 20260919100100).
--
-- A versão atual de `formalize_quality_policy(p_id)` (20260919100100, sem
-- mais rótulo manual) herdou a mesma lacuna: também não valida conteúdo.
-- Ou seja, o mesmo problema pode se repetir hoje, em qualquer organização,
-- caso alguém formalize um rascunho com o texto vazio ou só espaços. Esta
-- migração fecha a lacuna na função vigente.
create or replace function public.formalize_quality_policy(p_id uuid)
returns quality_policy
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_result quality_policy;
  v_label text;
  v_content text;
begin
  select content into v_content
    from quality_policy
    where id = p_id and status = 'rascunho'
    for update;

  if not found then
    raise exception 'Política não encontrada, sem acesso, ou já formalizada';
  end if;

  if v_content is null or btrim(v_content) = '' then
    raise exception 'Preencha o texto da Política da Qualidade antes de formalizar';
  end if;

  v_label := public.next_quality_policy_version_label();

  update quality_policy
    set status = 'formalizada', version_label = v_label
    where id = p_id
    returning * into v_result;

  return v_result;
end;
$$;
