-- Bug encontrado no teste de integração da Aba Financeiro: generate_invoice
-- calculava o vencimento como um dia fixo (dia 10 do mês de competência),
-- sem considerar o dia em que a fatura é de fato emitida. Gerar a fatura da
-- competência corrente depois do dia 10 (ex.: dia 31) produzia due_date no
-- passado em relação a issued_at = current_date, violando a constraint
-- `invoices_check` (due_date >= issued_at) e derrubando a chamada inteira.
--
-- Correção: due_date nunca fica antes de issued_at — usa o dia 10 da
-- competência quando isso já é hoje ou no futuro (caso normal, fatura
-- gerada em dia com folga de vencimento) e cai para o próprio dia de
-- emissão quando a geração acontece depois do dia 10 (caso de fatura
-- atrasada gerada manualmente pelo staff).
create or replace function public.generate_invoice(p_org_id uuid, p_competencia date)
returns invoices
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_contract contracts%rowtype;
  v_extra numeric(10,2) := 0;
  v_amount numeric(10,2);
  v_due_date date;
  v_invoice invoices%rowtype;
begin
  if not public.is_internal_staff() then
    raise exception 'Apenas a equipe interna Lynvex pode gerar faturas';
  end if;

  select * into v_contract from contracts where org_id = p_org_id and status = 'active';
  if not found then
    raise exception 'Organização não tem contrato ativo';
  end if;

  if exists (
    select 1 from invoices
    where org_id = p_org_id and competence = p_competencia
      and is_avulsa = false and status <> 'cancelled'
  ) then
    raise exception 'Já existe fatura da competência % para esta organização',
      to_char(p_competencia, 'MM/YYYY');
  end if;

  select coalesce(sum(extra_monthly_value), 0) into v_extra
  from contract_modules where contract_id = v_contract.id and enabled;

  select v_extra + coalesce(sum(cn.extra_monthly_value), 0) into v_extra
  from contract_norms cn where cn.contract_id = v_contract.id and cn.enabled;

  v_amount := v_contract.monthly_value + v_extra;
  v_due_date := greatest(date_trunc('month', p_competencia)::date + 9, current_date);

  insert into invoices (org_id, contract_id, competence, issued_at, due_date, amount, status, created_by)
  values (p_org_id, v_contract.id, p_competencia, current_date, v_due_date, v_amount, 'pending', auth.uid())
  returning * into v_invoice;

  insert into payment_events (org_id, invoice_id, event_type, detail, created_by)
  values (p_org_id, v_invoice.id, 'invoice_created',
    jsonb_build_object('amount', v_amount, 'competence', p_competencia, 'avulsa', false),
    auth.uid());

  perform public.log_admin_org_access(
    auth.uid(), p_org_id,
    format('Gerou fatura da competência %s', to_char(p_competencia, 'MM/YYYY'))
  );

  return v_invoice;
end;
$$;
