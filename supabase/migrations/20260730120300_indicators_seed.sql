-- Seed dos 6 objetivos padrão da qualidade em toda organização nova.
--
-- Escolha: trigger AFTER INSERT ON organizations, não uma função chamada no
-- provisionamento. Motivo: o painel administrativo (onde o time Lynvex
-- provisiona empresas) ainda não existe neste repositório — hoje toda
-- organização nasce por INSERT direto (supabase/seed.sql local, e o mesmo
-- vale pra qualquer fixture de teste ou, futuramente, o admin.jawda.com.br
-- quando for construído). Uma função "chame isso ao provisionar" depende de
-- todo caminho de criação de empresa lembrar de chamá-la — exatamente o
-- tipo de acoplamento por convenção que já causou os gaps de GRANT
-- descobertos nas ABAs 4/5 (seção 18 do Guia). Um trigger no INSERT da
-- própria tabela `organizations` garante os 6 objetivos em qualquer
-- caminho, presente ou futuro, sem coordenação entre módulos.
create or replace function public.seed_default_quality_objectives()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into quality_objectives (org_id, name, description, coherence_with_policy, status)
  values
    (new.id, 'Aumentar a satisfação do cliente',
     'Elevar a percepção de valor dos clientes e reduzir reclamações recorrentes.',
     'Objetivo padrão Jáwda — todo SGQ deve perseguir a satisfação do cliente como resultado central da Política da Qualidade (requisito 6.2a).',
     'active'),
    (new.id, 'Reduzir desperdício e retrabalho',
     'Diminuir custos da não qualidade nos processos produtivos e administrativos.',
     'Objetivo padrão Jáwda — coerente com o compromisso de eficiência e melhoria contínua da Política da Qualidade.',
     'active'),
    (new.id, 'Aumentar a eficiência operacional',
     'Elevar a relação entre resultado entregue e recurso consumido nos processos-chave.',
     'Objetivo padrão Jáwda — sustenta o compromisso de melhoria contínua de processos previsto na Política da Qualidade.',
     'active'),
    (new.id, 'Qualificar a cadeia de fornecimento',
     'Garantir fornecedores aderentes aos requisitos de prazo e qualidade contratados.',
     'Objetivo padrão Jáwda — atende ao requisito de controle de processos providos externamente (8.4) alinhado à Política da Qualidade.',
     'active'),
    (new.id, 'Fortalecer a competência e conscientização das pessoas',
     'Desenvolver o time, reduzir rotatividade e ampliar a adesão ao SGQ.',
     'Objetivo padrão Jáwda — coerente com o compromisso de desenvolvimento de pessoas da Política da Qualidade (requisito 7.2/7.3).',
     'active'),
    (new.id, 'Melhoria contínua do sistema de gestão da qualidade',
     'Tratar não conformidades com eficácia e evoluir o SGQ ciclo após ciclo.',
     'Objetivo padrão Jáwda — atende diretamente ao compromisso de melhoria contínua da Política da Qualidade (requisitos 9.1/10.2/10.3).',
     'active');
  return new;
end;
$$;

create trigger organizations_seed_quality_objectives
  after insert on organizations
  for each row execute function public.seed_default_quality_objectives();
