-- org_id de `ncs` passa a ter default a partir do claim do JWT, no mesmo
-- espírito de created_by/responsible_id (default auth.uid()). Sem isso, todo
-- INSERT do app precisaria buscar o org_id ativo antes de gravar; com o
-- default, a política de RLS (org_id = auth.jwt() ->> 'org_id') e o valor
-- gravado nascem da mesma fonte, eliminando a chance de o client mandar um
-- org_id divergente por engano.
alter table ncs alter column org_id set default (auth.jwt() ->> 'org_id')::uuid;
