# Jáwda

Plataforma SaaS multi-tenant de gestão da qualidade e conformidade, começando por ISO 9001. Isolamento entre empresas é garantido por Row Level Security no Supabase — nunca por filtro no código da tela.

## Como rodar localmente

```bash
bun install
cp .env.local.example .env.local   # preencha com as chaves do Supabase
bun run dev
```

Requer [bun](https://bun.sh) instalado. O projeto usa TanStack Start + React 19 + Tailwind CSS v4 + shadcn/ui no frontend, e Supabase (Postgres + Auth + Storage) no backend.

## Documentação

A fonte de verdade do projeto é [`docs/GUIA_DE_ARQUITETURA.md`](docs/GUIA_DE_ARQUITETURA.md) — princípios, stack, modelo multi-tenant e regras de negócio. Consulte também:

- [`docs/MODELO_DE_DADOS.md`](docs/MODELO_DE_DADOS.md) — schema das tabelas
- [`docs/CRONOGRAMA_MES_A_MES.md`](docs/CRONOGRAMA_MES_A_MES.md) — cronograma de entregas
