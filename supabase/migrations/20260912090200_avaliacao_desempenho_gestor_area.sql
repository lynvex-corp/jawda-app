-- Bloco 4, item 9: quem faz a avaliação de desempenho é o Gestor de Área e
-- o Administrador — não o Gestor da Qualidade, ao contrário do que o
-- código anterior permitia (RLS de INSERT em performance_evaluations não
-- restringia papel nenhum; qualquer um com escrita podia se nomear
-- avaliador de qualquer pessoa).
--
-- Duas checagens, não uma: quem PROGRAMA a avaliação (o INSERT) precisa
-- ter o papel — E o avaliador_user_id apontado também precisa ter o papel.
-- Sem a segunda checagem, um Gestor de Área poderia programar a própria
-- avaliação e nomear um Colaborador qualquer como avaliador, contornando a
-- regra pela porta lateral.
--
-- performance_cycles (configuração de periodicidade/meta) NÃO é tocado
-- aqui — item 9 fala especificamente de "fazer a avaliação", não de
-- configurar o ciclo. Fica org_can_write, como já era.

drop policy if exists performance_evaluations_insert_org on performance_evaluations;
create policy performance_evaluations_insert_org
  on performance_evaluations for insert
  with check (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.org_can_write(org_id)
    and public.user_role_in_org(org_id) in ('admin', 'area_manager')
    and exists (
      select 1 from user_organizations uo
      where uo.user_id = avaliador_user_id
        and uo.org_id = org_id
        and uo.is_active
        and uo.role in ('admin', 'area_manager')
    )
  );
