import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { JawdaLogo } from "@/components/brand/logo";
import { getSupabaseBrowserClient } from "@/lib/supabase";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar — Jáwda" },
      { name: "description", content: "Acesse a plataforma Jáwda de gestão de conformidade." },
    ],
  }),
  component: LoginPage,
});

const credentialsSchema = z.object({
  email: z.string().min(1, "Informe seu e-mail").email("Informe um e-mail válido"),
  password: z.string().min(1, "Informe sua senha"),
});
type CredentialsForm = z.infer<typeof credentialsSchema>;

const codeSchema = z.object({
  code: z.string().length(6, "O código tem 6 dígitos"),
});
type CodeForm = z.infer<typeof codeSchema>;

type OrgOption = { org_id: string; legal_name: string; trade_name: string | null };

type Step =
  | { name: "credentials" }
  | { name: "mfa-enroll"; factorId: string; qrCode: string; secret: string }
  | { name: "mfa-verify"; factorId: string }
  | { name: "select-org"; options: OrgOption[] };

function LoginPage() {
  const navigate = useNavigate();
  const supabase = getSupabaseBrowserClient();
  const [step, setStep] = useState<Step>({ name: "credentials" });
  const [submitting, setSubmitting] = useState(false);

  const credentialsForm = useForm<CredentialsForm>({
    resolver: zodResolver(credentialsSchema),
    defaultValues: { email: "", password: "" },
  });

  const codeForm = useForm<CodeForm>({
    resolver: zodResolver(codeSchema),
    defaultValues: { code: "" },
  });

  // Após o 2º fator confirmado (sessão em aal2), garante que a organização
  // ativa está resolvida antes de liberar o dashboard. Ver seção 8 do Guia de
  // Arquitetura — usuário pode pertencer a mais de uma empresa.
  async function finishLogin() {
    const { data: orgs, error } = await supabase.rpc("list_my_organizations");
    if (error || !orgs || orgs.length === 0) {
      toast.error("Nenhuma empresa associada a este usuário", {
        description: "Fale com o administrador da sua organização.",
      });
      await supabase.auth.signOut();
      setStep({ name: "credentials" });
      return;
    }

    // Marca o instante do login como "uso" para o cálculo de inatividade de
    // 30 dias (ABA 11, item 2) — melhor esforço: se falhar, não bloqueia o
    // login, o próximo login ou ação do usuário atualiza o campo de novo.
    void supabase.rpc("touch_last_activity");

    const current = orgs.find((o: { is_current: boolean }) => o.is_current);
    if (current || orgs.length === 1) {
      if (!current) {
        await supabase.rpc("set_active_org", { p_org_id: orgs[0].org_id });
        await supabase.auth.refreshSession();
      }
      navigate({ to: "/" });
      return;
    }

    setStep({ name: "select-org", options: orgs });
  }

  async function onSubmitCredentials(values: CredentialsForm) {
    setSubmitting(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword(values);
      if (signInError) {
        toast.error("Não foi possível entrar", { description: signInError.message });
        return;
      }

      const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors();
      if (factorsError) {
        toast.error("Erro ao verificar autenticação em duas etapas", {
          description: factorsError.message,
        });
        return;
      }

      const verifiedTotp = factorsData.totp.find(
        (f: { status: string }) => f.status === "verified",
      );

      if (verifiedTotp) {
        setStep({ name: "mfa-verify", factorId: verifiedTotp.id });
        return;
      }

      const { data: enrollData, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Autenticador",
      });
      if (enrollError || !enrollData) {
        toast.error("Erro ao iniciar configuração do 2FA", {
          description: enrollError?.message,
        });
        return;
      }

      setStep({
        name: "mfa-enroll",
        factorId: enrollData.id,
        qrCode: enrollData.totp.qr_code,
        secret: enrollData.totp.secret,
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function onSubmitCode(values: CodeForm, factorId: string) {
    setSubmitting(true);
    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      });
      if (challengeError || !challenge) {
        toast.error("Não foi possível gerar o desafio de verificação", {
          description: challengeError?.message,
        });
        return;
      }

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code: values.code,
      });
      if (verifyError) {
        toast.error("Código inválido", { description: verifyError.message });
        codeForm.resetField("code");
        return;
      }

      await finishLogin();
    } finally {
      setSubmitting(false);
    }
  }

  // O Supabase recusa unenroll de um fator verified fora de aal2 ("AAL2
  // required to unenroll verified factor") — confirmado testando direto
  // contra o projeto real. Por isso o reset exige o código ATUAL válido
  // antes de trocar o fator: verify() eleva a sessão a aal2, só depois
  // disso o unenroll é aceito.
  async function onResetMfa(factorId: string) {
    const codeIsValid = await codeForm.trigger("code");
    if (!codeIsValid) return;
    const code = codeForm.getValues("code");

    setSubmitting(true);
    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      });
      if (challengeError || !challenge) {
        toast.error("Não foi possível gerar o desafio de verificação", {
          description: challengeError?.message,
        });
        return;
      }

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code,
      });
      if (verifyError) {
        toast.error("Código inválido", { description: verifyError.message });
        codeForm.resetField("code");
        return;
      }

      const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId });
      if (unenrollError) {
        toast.error("Não foi possível reconfigurar o 2FA", {
          description: unenrollError.message,
        });
        return;
      }

      const { data: enrollData, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Autenticador",
      });
      if (enrollError || !enrollData) {
        toast.error("Erro ao gerar novo QR code", {
          description: enrollError?.message,
        });
        return;
      }

      codeForm.resetField("code");
      setStep({
        name: "mfa-enroll",
        factorId: enrollData.id,
        qrCode: enrollData.totp.qr_code,
        secret: enrollData.totp.secret,
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function onSelectOrg(orgId: string) {
    setSubmitting(true);
    try {
      const { error } = await supabase.rpc("set_active_org", { p_org_id: orgId });
      if (error) {
        toast.error("Não foi possível trocar de empresa", { description: error.message });
        return;
      }
      await supabase.auth.refreshSession();
      navigate({ to: "/" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-brand-soft/50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <JawdaLogo showWordmark={false} size={48} />
          <div className="text-center">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              Bem-vindo à Jáwda
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">Gestão de conformidade e qualidade</p>
          </div>
        </div>

        <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm">
          {step.name === "credentials" && (
            <Form {...credentialsForm}>
              <form
                onSubmit={credentialsForm.handleSubmit(onSubmitCredentials)}
                className="space-y-4"
              >
                <FormField
                  control={credentialsForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium">E-mail corporativo</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="voce@empresa.com"
                          className="h-10 rounded-lg"
                          autoComplete="email"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={credentialsForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <FormLabel className="text-xs font-medium">Senha</FormLabel>
                        <a href="#" className="text-xs font-medium text-brand hover:underline">
                          Esqueci
                        </a>
                      </div>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="••••••••"
                          className="h-10 rounded-lg"
                          autoComplete="current-password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  disabled={submitting}
                  className="mt-2 h-10 w-full rounded-lg bg-brand text-brand-foreground hover:bg-brand/90"
                >
                  {submitting ? "Entrando…" : "Entrar"}
                </Button>
              </form>
            </Form>
          )}

          {step.name === "mfa-enroll" && (
            <div className="space-y-4">
              <div className="text-center">
                <h2 className="text-sm font-semibold text-foreground">
                  Configure a verificação em duas etapas
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Escaneie o QR code com seu aplicativo autenticador (Google Authenticator, Authy…)
                  e informe o código gerado.
                </p>
              </div>
              <div className="flex justify-center rounded-lg border border-border/60 bg-white p-3">
                <img src={step.qrCode} alt="QR code para configurar o 2FA" className="h-40 w-40" />
              </div>
              <div className="rounded-lg bg-muted/50 p-2 text-center">
                <p className="text-[11px] text-muted-foreground">Ou digite manualmente:</p>
                <p className="break-all font-mono text-xs text-foreground">{step.secret}</p>
              </div>
              <p className="text-center text-[11px] text-muted-foreground">
                Já tinha um autenticador cadastrado nesta conta? Apague a entrada antiga do seu app
                depois de confirmar o código abaixo — o app não sabe diferenciar as duas, e a antiga
                não funciona mais.
              </p>
              <Form {...codeForm}>
                <form
                  onSubmit={codeForm.handleSubmit((values) => onSubmitCode(values, step.factorId))}
                  className="space-y-4"
                >
                  <FormField
                    control={codeForm.control}
                    name="code"
                    render={({ field }) => (
                      <FormItem className="flex flex-col items-center">
                        <FormLabel className="text-xs font-medium">Código de 6 dígitos</FormLabel>
                        <FormControl>
                          <InputOTP maxLength={6} {...field}>
                            <InputOTPGroup>
                              {Array.from({ length: 6 }).map((_, i) => (
                                <InputOTPSlot key={i} index={i} />
                              ))}
                            </InputOTPGroup>
                          </InputOTP>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="h-10 w-full rounded-lg bg-brand text-brand-foreground hover:bg-brand/90"
                  >
                    {submitting ? "Confirmando…" : "Confirmar e entrar"}
                  </Button>
                </form>
              </Form>
            </div>
          )}

          {step.name === "mfa-verify" && (
            <div className="space-y-4">
              <div className="text-center">
                <h2 className="text-sm font-semibold text-foreground">
                  Verificação em duas etapas
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Informe o código de 6 dígitos do seu aplicativo autenticador.
                </p>
              </div>
              <Form {...codeForm}>
                <form
                  onSubmit={codeForm.handleSubmit((values) => onSubmitCode(values, step.factorId))}
                  className="space-y-4"
                >
                  <FormField
                    control={codeForm.control}
                    name="code"
                    render={({ field }) => (
                      <FormItem className="flex flex-col items-center">
                        <FormLabel className="text-xs font-medium">Código de 6 dígitos</FormLabel>
                        <FormControl>
                          <InputOTP maxLength={6} {...field}>
                            <InputOTPGroup>
                              {Array.from({ length: 6 }).map((_, i) => (
                                <InputOTPSlot key={i} index={i} />
                              ))}
                            </InputOTPGroup>
                          </InputOTP>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="h-10 w-full rounded-lg bg-brand text-brand-foreground hover:bg-brand/90"
                  >
                    {submitting ? "Verificando…" : "Verificar"}
                  </Button>
                </form>
              </Form>
              <button
                type="button"
                disabled={submitting}
                onClick={() => onResetMfa(step.factorId)}
                className="w-full text-center text-xs font-medium text-muted-foreground underline-offset-2 hover:text-brand hover:underline disabled:opacity-50"
              >
                Vai trocar de aparelho? Digite o código atual acima e toque aqui para gerar um QR
                code novo
              </button>
            </div>
          )}

          {step.name === "select-org" && (
            <div className="space-y-3">
              <div className="text-center">
                <h2 className="text-sm font-semibold text-foreground">Selecione a empresa</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Você tem acesso a mais de uma organização.
                </p>
              </div>
              <div className="space-y-2">
                {step.options.map((org) => (
                  <button
                    key={org.org_id}
                    type="button"
                    disabled={submitting}
                    onClick={() => onSelectOrg(org.org_id)}
                    className="w-full rounded-lg border border-border/70 p-3 text-left text-sm font-medium text-foreground transition-colors hover:border-brand hover:bg-brand-soft/40 disabled:opacity-50"
                  >
                    {org.trade_name || org.legal_name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step.name === "credentials" && (
            <div className="mt-6 border-t border-border/60 pt-4 text-center text-xs text-muted-foreground">
              Ao entrar, você concorda com os termos e a política de privacidade.
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          © 2026 Jáwda · Todos os direitos reservados
        </p>
      </div>
    </div>
  );
}
