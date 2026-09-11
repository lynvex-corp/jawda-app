import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { getRequestUrl } from "@tanstack/react-start-server";

/** Convite de login (Bloco 4, item 3) — portado do mecanismo que já existe
 * no jawda-admin (`inviteOrgUser`, ABA de Usuários e Acessos), adaptado
 * para quem convida ser o próprio cliente (Gestor da Qualidade ou
 * Administrador), não o staff Lynvex.
 *
 * Precisa de service_role (auth.admin.*) — por isso é um createServerFn e
 * NUNCA um hook chamado direto do navegador. Este é o primeiro uso de
 * service_role dentro do jawda-app; até aqui só existia em jawda-admin.
 *
 * redirectTo: a versão do jawda-admin usa getClientAppUrl() porque quem
 * convida (staff) e quem recebe o convite (dono da empresa) estão em apps
 * diferentes. Aqui os dois estão no MESMO app — não existe "URL do app
 * cliente" separada para configurar, então derivo a origem da própria
 * requisição (getRequestUrl) em vez de fixar um domínio. Isso sobrevive a
 * uma troca de domínio sem precisar de variável de ambiente nova — mas o
 * destino ainda precisa estar cadastrado no allowlist de Redirect URLs do
 * Supabase (seção 21.9 do Guia); hoje jawda-app.vercel.app já está.
 *
 * status='invited' + user_organizations: mesma mecânica documentada no
 * jawda-admin (ver ABA 8) — profiles nasce 'active' por padrão
 * (handle_new_user), sobrescrever para 'invited' é o que permite
 * getAuthState (supabase-server.ts) desviar essa sessão sem senha/2FA
 * para /primeiro-acesso em vez de /login.
 *
 * unitsScope fixo em 'all': o Bloco 4 não pediu seleção de unidade no
 * convite feito de dentro de Pessoas — "todas, inclusive futuras" é o
 * padrão seguro da seção 6 do Guia. Se precisar de escopo por unidade
 * aqui, é extensão futura, mesmo padrão do jawda-admin.
 */
export const inviteOrgUser = createServerFn({ method: "POST" })
  .validator(
    (data: {
      orgId: string;
      email: string;
      fullName: string;
      role: "admin" | "quality_manager" | "auditor" | "area_manager" | "collaborator" | "viewer";
    }) => data,
  )
  .handler(async ({ data }) => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada no ambiente do servidor.");
    }

    const origin = getRequestUrl({ xForwardedHost: true, xForwardedProto: true }).origin;
    const redirectTo = `${origin}/`;

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Usuário pode já existir (pertencer a outra empresa) — inviteUserByEmail
    // falha nesse caso; recupera o id existente em vez de tratar como erro.
    let userId: string;
    let isNewUser = false;
    const { data: invited, error } = await admin.auth.admin.inviteUserByEmail(data.email, {
      data: { full_name: data.fullName },
      redirectTo,
    });
    if (error) {
      const { data: existing } = await admin
        .from("profiles")
        .select("id")
        .eq("email", data.email)
        .maybeSingle();
      if (!existing) throw new Error(error.message);
      userId = existing.id;
    } else {
      userId = invited.user.id;
      isNewUser = true;
    }

    if (isNewUser) {
      const { error: statusError } = await admin
        .from("profiles")
        .update({ status: "invited" })
        .eq("id", userId);
      if (statusError) throw new Error(statusError.message);
    }

    const { error: linkError } = await admin.from("user_organizations").upsert(
      {
        user_id: userId,
        org_id: data.orgId,
        role: data.role,
        units_scope: "all",
        is_active: true,
        invited_at: new Date().toISOString(),
      },
      { onConflict: "user_id,org_id" },
    );
    if (linkError) throw new Error(linkError.message);

    return { userId, isNewUser };
  });
