# Dashboard Cacique's — Extensão Sync

Pequena extensão de navegador que, sempre que você faz login no AppBarber
no seu Chrome normal, pega o cookie da sessão e manda pro dashboard
financeiro — assim o dashboard sempre tem acesso aos dados, sem precisar
colar cookie manual nunca mais.

## Instalação (1 vez só)

1. Abre o Chrome, vai em `chrome://extensions`
2. Liga o botão **"Modo do desenvolvedor"** (canto superior direito)
3. Clica em **"Carregar sem compactação"**
4. Seleciona esta pasta (`extension/`)
5. A extensão aparece com o ícone da Cacique's

## Configuração (1 vez só)

1. Clica no ícone da extensão
2. Preenche:
   - **URL do Dashboard**: `https://dashboard-two-teal-35.vercel.app`
   - **Token**: cole o que aparece em **Configurações → Token da extensão** no dashboard
   - **Loja**: escolhe pra qual loja este Chrome vai sincronizar (Panorâmico ou Correia)
3. Deixa **"Sincronizar automaticamente"** marcado
4. Clica **Salvar**
5. Clica **Sincronizar agora** pra testar

## Como usa no dia a dia

**Nada.** Funciona sozinha:

- Toda vez que você entra no `sistema.appbarber.com.br` pra trabalhar, a extensão vê o cookie novo e manda pro dashboard em ~3s
- Um `badge verde "OK"` aparece no ícone da extensão quando sincroniza com sucesso
- A cada 1h ela faz um "check" extra, pra garantir

## Se usar nas duas lojas

Se o mesmo usuário acessa o AppBarber nas duas lojas (Panorâmico e Correia):

- **Mesmo Chrome**: só rola uma loja por vez (o AppBarber troca o cookie quando você muda de loja). Troca a loja selecionada no popup da extensão quando mudar.
- **Chromes diferentes (perfil Chrome, incognito, ou outro computador)**: instala a extensão em cada um, cada um aponta pra uma loja.

## Problemas?

- Ícone com `X` vermelho → clica pra ver a mensagem (token errado, loja não configurada, etc.)
- Ícone com `!` amarelo → faltou configurar algo, ou não achou cookie (login expirou)
- Sem badge → ainda não tentou sincronizar
