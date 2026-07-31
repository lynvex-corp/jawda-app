-- Agenda run_delinquency_check() para rodar 1x por dia, às 3h (horário de
-- menor uso). pg_cron já habilitado no projeto (confirmar antes de aplicar:
-- select * from pg_extension where extname = 'pg_cron';).
--
-- cron.schedule com um nome (1º argumento) é idempotente: rodar esta
-- migração de novo apenas atualiza o agendamento existente em vez de
-- duplicar o job.
select cron.schedule(
  'run_delinquency_check_daily',
  '0 3 * * *',
  $$select public.run_delinquency_check();$$
);
