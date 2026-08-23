-- Fix: enforce_scope_document_approval (20260823130200) travava a
-- transição de aprovação mas não impedia editar `declaracao_texto` de um
-- documento que já não está em rascunho — a RLS de scope_documents só
-- checa org_id/org_can_write, sem olhar status. Isso violava a regra
-- explícita do prompt desta aba: "nova revisão gera novo scope_document,
-- nunca edita o vigente diretamente" (também vale para
-- 'aguardando_aprovacao' — só volta a ser editável numa nova revisão).

create or replace function public.enforce_scope_document_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  if old.status <> 'rascunho' and new.declaracao_texto is distinct from old.declaracao_texto then
    raise exception 'Documento vigente ou aguardando aprovação não pode ser editado diretamente — crie uma nova revisão';
  end if;

  if new.status in ('aguardando_aprovacao', 'vigente') and old.status = 'rascunho' then
    if exists (
      select 1 from scope_not_applicable_items i
      where i.scope_document_id = new.id and (i.justification is null or btrim(i.justification) = '')
    ) then
      raise exception 'Existem itens não aplicáveis sem justificativa — trate antes de enviar para aprovação';
    end if;
  end if;

  if new.status = 'vigente' and old.status <> 'vigente' then
    select role into v_role
    from user_organizations
    where user_id = auth.uid() and org_id = new.org_id and is_active;

    if v_role is null or v_role <> 'admin' then
      raise exception 'Somente o Administrador do Cliente (Alta Direção) pode aprovar o escopo';
    end if;

    new.approved_by := coalesce(new.approved_by, auth.uid());
    new.approved_at := coalesce(new.approved_at, now());
  end if;

  return new;
end;
$$;
