# Projeto 30 Dias — Next.js + Supabase

Aplicativo responsivo para registrar peso, água, sono, apetite, treino e refeições.

## Arquitetura

- Next.js 15 + React 19 com exportação estática.
- Supabase como banco e autenticação anônima em segundo plano (sem tela de login).
- GitHub Pages para hospedagem gratuita.
- Backup manual em JSON.

## 1. Configurar o Supabase

O projeto usa as tabelas `daily_logs` e `meal_logs` já criadas pelo script SQL anterior.

No painel Supabase:
1. Abra **Authentication → Sign In / Providers**.
2. Habilite **Allow anonymous sign-ins** (ou opção equivalente de usuários anônimos).
3. Em **Project Settings → API**, copie Project URL e a chave publishable.

A chave publishable pode ficar no frontend. Nunca use `service_role` ou secret key no navegador.

## 2. Configurar o GitHub

Crie um repositório chamado `projeto-30-dias` e envie todos os arquivos desta pasta para a raiz dele.

Em **Settings → Secrets and variables → Actions**, crie estes Repository secrets:
- `NEXT_PUBLIC_SUPABASE_URL` = URL do projeto Supabase.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = chave publishable.

Em **Settings → Pages**, escolha **GitHub Actions** como fonte de publicação.

O workflow `.github/workflows/deploy.yml` compila e publica o app automaticamente a cada push na branch `main`.

URL esperada: `https://SEU_USUARIO.github.io/projeto-30-dias/`

## 3. Redirect URL do Supabase

Em **Authentication → URL Configuration**, adicione a URL publicada em **Redirect URLs**:
`https://SEU_USUARIO.github.io/projeto-30-dias/**`

## 4. Rodar localmente (opcional)

```bash
npm install
NEXT_PUBLIC_SUPABASE_URL="https://SEU_PROJETO.supabase.co" \
NEXT_PUBLIC_SUPABASE_ANON_KEY="SUA_CHAVE_PUBLISHABLE" \
npm run dev
```

## Observação sobre sessão anônima

Não existe formulário de login. O Supabase cria uma identidade anônima no primeiro acesso e guarda a sessão no navegador. Isso mantém os dados salvos no banco ao reabrir o app no mesmo navegador/dispositivo. Como não há e-mail/senha, essa identidade não pode ser recuperada automaticamente em outro aparelho ou depois de apagar os dados do navegador. Use o botão de backup JSON para guardar uma cópia.
