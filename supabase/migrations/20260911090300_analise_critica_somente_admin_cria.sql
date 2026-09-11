-- Bloco 3, item 6: somente o Administrador do Cliente cria análise crítica.
--
-- ESTADO ANTERIOR: a policy de INSERT exigia apenas org_can_write(org_id) —
-- qualquer perfil com escrita na organização podia programar uma análise
-- crítica, inclusive Colaborador.
--
-- ALCANCE: a trava é só de CRIAÇÃO, por decisão explícita. O UPDATE segue
-- aberto a quem já podia, porque a seção 6 do Guia atribui ao Gestor da
-- Qualidade "executa análise crítica" — ele continua preenchendo pauta,
-- deliberações e ações depois que a reunião existe. Fosse admin-only também
-- no update, esse papel do Guia deixaria de existir na prática.
--
-- A regra vive AQUI, não só na tela: esconder o botão no frontend não
-- impede uma chamada direta à API. A UI passa a esconder o botão também,
-- mas como conveniência — quem barra é esta policy.

drop policy if exists critical_analysis_meetings_insert_org on critical_analysis_meetings;

create policy critical_analysis_meetings_insert_org
  on critical_analysis_meetings for insert
  with check (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.org_can_write(org_id)
    and public.user_role_in_org(org_id) = 'admin'
  );

-- Pauta e participantes nascem junto com a reunião, no mesmo fluxo de
-- criação. Se continuassem aceitando insert de qualquer perfil, um usuário
-- não-admin poderia adicionar pautas ou participantes a uma reunião criada
-- por outra pessoa — o que a trava acima pretende impedir.
--
-- O escopo por organização já era verificado via join com a reunião; o que
-- muda é a exigência do papel.

drop policy if exists critical_analysis_agenda_items_insert_org on critical_analysis_agenda_items;
create policy critical_analysis_agenda_items_insert_org
  on critical_analysis_agenda_items for insert
  with check (
    exists (
      select 1 from critical_analysis_meetings m
      where m.id = meeting_id
        and m.org_id = (auth.jwt() ->> 'org_id')::uuid
        and public.org_can_write(m.org_id)
        and public.user_role_in_org(m.org_id) = 'admin'
    )
  );

drop policy if exists critical_analysis_participants_insert_org on critical_analysis_participants;
create policy critical_analysis_participants_insert_org
  on critical_analysis_participants for insert
  with check (
    exists (
      select 1 from critical_analysis_meetings m
      where m.id = meeting_id
        and m.org_id = (auth.jwt() ->> 'org_id')::uuid
        and public.org_can_write(m.org_id)
        and public.user_role_in_org(m.org_id) = 'admin'
    )
  );
