# Formulário de abertura de empresa — Daniela Neves Advocacia

| Página | Para quem | O que faz |
|---|---|---|
| `https://form.danielaneves.adv.br/?c=CÓDIGO` | Cliente | Preenche só o próprio formulário (passo a passo) e descarrega o PDF. |
| `https://form.danielaneves.adv.br/escritorio.html` | Escritório | Entra com a chave, cria links individuais, vê o histórico e gera PDFs. |
| Planilha Google | Escritório | Guarda todos os formulários (uma linha por cliente). |

Enquanto `config.js` não tiver o endereço do script, as páginas funcionam em **modo demonstração**
(dados só no navegador; chave do escritório: `demo`).

## 1. Criar a planilha e o servidor (uma vez, ~5 minutos)

1. Na conta Google do escritório, crie uma Planilha nova (ex.: "Formulários abertura empresa").
2. Menu **Extensões → Apps Script**.
3. Apague o conteúdo do ficheiro `Código.gs` e cole todo o conteúdo de `apps-script/Codigo.gs`. Guarde (💾).
4. Na barra de cima, escolha a função **`configurar`** e carregue em **Executar**.
   - O Google pede autorização: escolha a conta do escritório → "Avançadas" → "Aceder a … (não seguro)" → Permitir.
     (O aviso aparece porque o script é seu e não foi verificado pela Google; é normal.)
   - Em baixo, no **Registo de execução**, aparece a **chave do escritório**. Copie-a e guarde-a em local seguro
     (ex.: gestor de palavras-passe). É ela que dá acesso ao histórico.
5. Carregue em **Implementar → Nova implementação** → tipo **Aplicação Web**:
   - Executar como: **Eu**
   - Quem tem acesso: **Qualquer pessoa**
   - **Implementar** → copie o **URL da aplicação Web** (termina em `/exec`).
6. Cole esse URL em `config.js`:
   ```js
   window.SCRIPT_URL = 'https://script.google.com/macros/s/……/exec';
   ```

"Qualquer pessoa" é necessário para o cliente conseguir guardar sem conta Google. A segurança vem de:
o cliente só lê/grava o formulário cujo código (aleatório, impossível de adivinhar) está no seu link;
listar, criar e apagar exige a chave do escritório.

> Se alterar o `Codigo.gs` mais tarde: **Implementar → Gerir implementações → ✏️ → Versão: Nova versão**
> (assim o URL mantém-se). Para trocar a chave: execute a função `trocarChave`.

## 2. Publicação

GitHub Pages (repositório `Edsonmartinsjr/formulario-abertura-empresa`, ramo `main`) com o domínio
`form.danielaneves.adv.br` (ficheiro `CNAME` + registo CNAME `form → edsonmartinsjr.github.io` no DNS da Vercel).
Cada `git push` publica automaticamente.

## 3. Uso no dia a dia

1. Abra `…/escritorio.html`, introduza a chave (fica memorizada nesse navegador).
2. Escreva o nome do cliente → **Criar link** → envie por WhatsApp, e-mail ou copie.
3. O cliente preenche; cada "Guardar e avançar" grava na planilha. Pode parar e continuar mais tarde com o mesmo link.
4. No painel vê o estado (Por preencher / Em preenchimento x/6 / Concluído) e gera o PDF.
