-- Bloco 4, item 5: carga horária do treinamento precisa dizer se é hora ou
-- minuto. carga_horaria era numeric puro, sem unidade — sempre foi
-- implícito "horas", o que quebra silenciosamente para um treinamento
-- rápido de instrução (ex.: 15 minutos de briefing de segurança) registrado
-- como "15", lido como 15 horas.
--
-- Default 'hora' para não mudar o significado de nenhum registro já
-- existente (todo dado atual já era, de fato, horas).

alter table trainings
  add column if not exists carga_horaria_unidade text not null default 'hora'
    check (carga_horaria_unidade in ('hora', 'minuto'));
