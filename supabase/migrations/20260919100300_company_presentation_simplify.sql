-- Bloco 7, item 1: Apresentação da Empresa não é exigida pela norma e não
-- precisa de controle formal de versão — só a Política da Qualidade e as
-- Diretrizes Estratégicas (compromissos formais da Direção) mantêm o ciclo
-- rascunho → formalizada → nova versão numerada.
--
-- Fluxo simplificado: escreve, clica Formalizar (sem rótulo, sem dialog de
-- versão), e a partir daí o texto pode ser reaberto para edição direta
-- ("Editar") sem nunca criar uma linha nova. `version_label` fica sem uso —
-- não é dropada a coluna (mudança não-destrutiva, sem motivo pra reescrever
-- schema por uma coluna nullable já sem leitor).

-- Deixa de bloquear edição de conteúdo já formalizado — é exatamente essa
-- trava que a simplificação remove.
create or replace function public.enforce_company_presentation_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'formalizada' and (tg_op = 'INSERT' or old.status <> 'formalizada') then
    new.formalized_by := coalesce(new.formalized_by, auth.uid());
    new.formalized_at := coalesce(new.formalized_at, now());
  end if;

  return new;
end;
$$;

-- Sem versionamento, sem RPC de "nova versão".
drop function if exists public.start_new_company_presentation_version();

drop function if exists public.formalize_company_presentation(uuid, text);

create or replace function public.formalize_company_presentation(p_id uuid)
returns company_presentation
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_result company_presentation;
begin
  update company_presentation
     set status = 'formalizada'
   where id = p_id and status = 'rascunho'
   returning * into v_result;

  if v_result.id is null then
    raise exception 'Apresentação não encontrada, sem acesso, ou já formalizada';
  end if;

  return v_result;
end;
$$;

-- Trilha de auditoria passa a cobrir edição de conteúdo pós-formalização —
-- antes isso não existia porque editar depois de formalizar era proibido.
create or replace function public.log_company_presentation_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    return coalesce(new, old);
  end if;

  if tg_op = 'INSERT' then
    insert into activity_log (org_id, actor_id, action, entity_type, entity_id, detail)
    values (new.org_id, v_actor, 'criou', 'company_presentation', new.id,
      jsonb_build_object('status', new.status));
  elsif tg_op = 'UPDATE' and new.status = 'formalizada' and old.status = 'rascunho' then
    insert into activity_log (org_id, actor_id, action, entity_type, entity_id, detail)
    values (new.org_id, v_actor, 'formalizou', 'company_presentation', new.id, '{}'::jsonb);
  elsif tg_op = 'UPDATE' and old.status = 'formalizada' and new.status = 'formalizada'
        and new.content is distinct from old.content then
    insert into activity_log (org_id, actor_id, action, entity_type, entity_id, detail)
    values (new.org_id, v_actor, 'editou', 'company_presentation', new.id, '{}'::jsonb);
  end if;

  return coalesce(new, old);
end;
$$;
