-- Notificação da pesquisa organizacional — decisão confirmada com o
-- Matheus: dispara no momento em que a pesquisa é PROGRAMADA (avisando a
-- janela), não exatamente quando a janela abre. Não existe job/cron rodando
-- em background neste sistema hoje (confirmado ao investigar: toda
-- notificação real nasce de um trigger no instante em que algo acontece,
-- nunca de uma varredura agendada — essa é uma dívida arquitetural mais
-- antiga, registrada desde o Bloco 3, que fica de fora deste aditivo).
--
-- Alcança todo membro ATIVO da organização (user_organizations.is_active),
-- não só quem tem registro em `employees` — pesquisa de clima é para todo
-- mundo que usa o sistema, célula RH à parte.

create or replace function public.notify_org_climate_survey_scheduled()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into notifications (org_id, user_id, title, description, tone, link, entity_type, entity_id)
  select
    new.org_id,
    uo.user_id,
    'Pesquisa de clima organizacional',
    'Responda entre ' || to_char(new.janela_inicio, 'DD/MM/YYYY')
      || ' e ' || to_char(new.janela_fim, 'DD/MM/YYYY') || '.',
    'info',
    '/avaliacao-performance?aba=organizacional',
    'org_climate_surveys',
    new.id
  from user_organizations uo
  where uo.org_id = new.org_id and uo.is_active;

  return new;
end;
$$;

drop trigger if exists org_climate_surveys_notify on org_climate_surveys;
create trigger org_climate_surveys_notify
  after insert on org_climate_surveys
  for each row execute function public.notify_org_climate_survey_scheduled();
