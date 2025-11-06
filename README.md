# MySQL Control Bridge

Servidor MCP (Model Context Protocol) para integração com MySQL, permitindo que IAs executem consultas seguras e obtenham informações detalhadas sobre bancos de dados MySQL através de ferramentas estruturadas.

## Funcionalidades

### Consultas e Análise
- **Consultas SELECT seguras** - Execute apenas consultas de leitura
- **Análise de queries** - Explique planos de execução com EXPLAIN

### Explorar Banco de Dados
- **Listagem de bancos** - Visualize todos os bancos de dados disponíveis
- **Listagem de tabelas** - Visualize todas as tabelas e views do banco
- **Descrever tabelas** - Obtenha estrutura detalhada das tabelas (colunas, tipos, chaves, etc.)
- **Descrever views** - Veja a definição e estrutura de views
- **Descrever índices** - Liste todos os índices de uma tabela
- **Descrever triggers** - Liste todos os triggers de uma tabela ou banco
- **Descrever procedures** - Liste todas as stored procedures e funções

### Segurança
- **Somente SELECTs** - Apenas consultas de leitura são permitidas
- **Limite de resultados** - Máximo de 1000 registros por consulta
- **Validação de queries** - Verificação automática de comandos perigosos
- **Conexão segura** - Sem multiple statements habilitados

## Instalação

### Usando npx (recomendado)

O pacote pode ser usado diretamente via `npx` sem necessidade de instalação global:

```bash
npx mysql_control_bridge
```

### Instalação Local (opcional)

```bash
npm install mysql_control_bridge
```

### Variáveis de Ambiente Obrigatórias

```bash
MYSQL_HOST=localhost
MYSQL_USER=seu_usuario
MYSQL_DATABASE=sua_base_dados
```

### Variáveis de Ambiente Opcionais

```bash
MYSQL_PORT=3306              # Padrão: 3306
MYSQL_PASSWORD=sua_senha     # Padrão: string vazia
```

## Configuração das Variáveis de Ambiente

O MySQL Control Bridge suporta um **sistema flexível de configuração** com múltiplos níveis de fallback e suporte a interpolação de variáveis:

### Ordem de Prioridade (da mais alta para mais baixa):

1. **Variáveis diretas no `.cursor/mcp.json`** (mais alta prioridade) ✅
   - Valores explícitos como `"MYSQL_HOST": "localhost"` têm prioridade máxima
   - Variáveis com interpolação como `"MYSQL_HOST": "${DB_HOST}"` são resolvidas usando os fallbacks abaixo

2. **Arquivo `.cursor/.env`** (fallback médio) ✅
   - Usado para resolver interpolações ou valores não definidos no `mcp.json`
   - Sobrescreve valores do `.env` da raiz

3. **Arquivo `.env` na raiz do projeto** (fallback mais baixo) ✅
   - Base genérica para todo o projeto
   - Usado como último fallback para interpolações

4. **Variáveis do sistema** (`process.env` já existentes)

### 1. Arquivos `.env`

Você pode criar arquivos `.env` em até dois locais:

#### `.env` na raiz do projeto (base)
```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=seu_usuario
DB_PASSWORD=sua_senha
DB_NAME=sua_base_dados
```

#### `.cursor/.env` (opcional, sobrescreve valores da raiz)
```env
DB_PASSWORD=senha_diferente_para_desenvolvimento
```

O servidor carrega automaticamente esses arquivos na ordem correta:
1. Primeiro carrega `.env` da raiz (fallback baixo)
2. Depois carrega `.cursor/.env` (sobrescreve raiz, mas não valores do `mcp.json`)
3. Valores diretos no `mcp.json` sempre têm prioridade e nunca são sobrescritos

### 2. Interpolação de Variáveis no `.cursor/mcp.json`

Você pode usar interpolação de variáveis no campo `env` do `mcp.json`:

- `${VAR}` - Referencia uma variável de ambiente
- `${VAR:-default}` - Usa um valor padrão se a variável não existir

Isso permite referenciar variáveis definidas nos arquivos `.env` ou outras variáveis de ambiente.

## Configuração no Cursor IDE

Crie o arquivo `.cursor/mcp.json` na raiz do seu workspace. Você tem duas opções:

### Opção 1: Usando Interpolação (Recomendado)

Use interpolação para referenciar variáveis dos arquivos `.env`:

```json
{
  "mcpServers": {
    "mysql": {
      "command": "npx",
      "args": ["-y", "mysql_control_bridge"],
      "env": {
        "MYSQL_HOST": "${DB_HOST}",
        "MYSQL_PORT": "${DB_PORT:-3306}",
        "MYSQL_USER": "${DB_USER}",
        "MYSQL_PASSWORD": "${DB_PASSWORD}",
        "MYSQL_DATABASE": "${DB_NAME}"
      }
    }
  }
}
```

E crie um `.env` na raiz com as variáveis base:
```env
DB_HOST=localhost
DB_USER=seu_usuario
DB_PASSWORD=sua_senha
DB_NAME=sua_base_dados
DB_PORT=3306
```

Ou crie um `.cursor/.env` para valores específicos do workspace:
```env
DB_HOST=localhost
DB_USER=dev_user
DB_PASSWORD=dev_pass
DB_NAME=development_db
```

**Vantagens:**
- ✅ Credenciais não ficam versionadas no `.cursor/mcp.json`
- ✅ Fácil trocar ambientes mudando apenas o `.env`
- ✅ Valores padrão com `${VAR:-default}`
- ✅ Suporta referências entre variáveis

**Exemplo prático da ordem de prioridade:**

Se você tiver:

**`.cursor/mcp.json`:**
```json
"MYSQL_HOST": "${DB_HOST}"
```

**`.cursor/.env`:**
```env
DB_HOST=dev.example.com
```

**`.env` (raiz):**
```env
DB_HOST=localhost
```

Resultado: `MYSQL_HOST` será `dev.example.com` (usa `.cursor/.env`, que tem prioridade sobre raiz)

Se você tiver:

**`.cursor/mcp.json`:**
```json
"MYSQL_HOST": "prod.example.com"  // valor direto
```

**`.cursor/.env`:**
```env
MYSQL_HOST=dev.example.com
```

Resultado: `MYSQL_HOST` será `prod.example.com` (valores diretos no JSON sempre ganham)

### Opção 2: Valores Diretos

Você também pode definir valores diretamente no `mcp.json`:

```json
{
  "mcpServers": {
    "mysql": {
      "command": "npx",
      "args": ["-y", "mysql_control_bridge"],
      "env": {
        "MYSQL_HOST": "localhost",
        "MYSQL_PORT": "3306",
        "MYSQL_USER": "seu_usuario",
        "MYSQL_PASSWORD": "sua_senha",
        "MYSQL_DATABASE": "sua_base_dados"
      }
    }
  }
}
```

### Opção 3: Apenas `.env` (sem `env` no mcp.json)

Se preferir usar apenas arquivos `.env`, omita o campo `env`:

```json
{
  "mcpServers": {
    "mysql": {
      "command": "npx",
      "args": ["-y", "mysql_control_bridge"]
    }
  }
}
```

E crie um `.env` na raiz com as variáveis `MYSQL_*`:
```env
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=seu_usuario
MYSQL_PASSWORD=sua_senha
MYSQL_DATABASE=sua_base_dados
```

**Importante:** Lembre-se de adicionar `.env` e `.cursor/.env` ao `.gitignore` para não versionar credenciais!

### Por que usar `.cursor/mcp.json`?

- ✅ **Versionável**: Pode ser commitado e compartilhado com a equipe via Git
- ✅ **Isolado por projeto**: Não afeta outras pastas ou instalações do Cursor
- ✅ **Fácil trocar de ambiente**: Crie múltiplas entradas como `mysql-dev`, `mysql-hml` e `mysql-prod`
- ✅ **Sem instalação global**: Use `npx` para executar diretamente do npm registry
- ✅ **Flexível**: A configuração vive junto do projeto e pode variar por workspace

### Exemplo com Múltiplos Ambientes usando Interpolação

**`.cursor/mcp.json`:**
```json
{
  "mcpServers": {
    "mysql-dev": {
      "command": "npx",
      "args": ["-y", "mysql_control_bridge"],
      "env": {
        "MYSQL_HOST": "${DB_HOST_DEV:-localhost}",
        "MYSQL_USER": "${DB_USER_DEV}",
        "MYSQL_PASSWORD": "${DB_PASSWORD_DEV}",
        "MYSQL_DATABASE": "${DB_NAME_DEV}"
      }
    },
    "mysql-prod": {
      "command": "npx",
      "args": ["-y", "mysql_control_bridge"],
      "env": {
        "MYSQL_HOST": "${DB_HOST_PROD}",
        "MYSQL_USER": "${DB_USER_PROD}",
        "MYSQL_PASSWORD": "${DB_PASSWORD_PROD}",
        "MYSQL_DATABASE": "${DB_NAME_PROD}"
      }
    }
  }
}
```

**`.cursor/.env`** (valores específicos do workspace):
```env
DB_HOST_DEV=localhost
DB_USER_DEV=dev_user
DB_PASSWORD_DEV=dev_pass
DB_NAME_DEV=development_db

DB_HOST_PROD=prod.example.com
DB_USER_PROD=prod_user
DB_PASSWORD_PROD=prod_pass
DB_NAME_PROD=production_db
```

### Exemplos de Interpolação

**Valor padrão:**
```json
"MYSQL_PORT": "${DB_PORT:-3306}"
```
Se `DB_PORT` não existir, usa `3306` como padrão.

**Referência simples:**
```json
"MYSQL_HOST": "${DB_HOST}"
```
Usa o valor de `DB_HOST` dos arquivos `.env`.

**Múltiplas referências:**
```env
# .env
BASE_HOST=prod.example.com
MYSQL_HOST="${BASE_HOST}"
```
O sistema resolve interpolações iterativamente, permitindo referências encadeadas.

## Ferramentas Disponíveis

### 1. execute_select_query
Executa queries SELECT com segurança.

**Parâmetros:**
- `query` (string, obrigatório): Query SELECT para executar
- `limit` (number, opcional): Limite de resultados (máximo 1000, padrão 100)

**Exemplo:**
```sql
SELECT * FROM usuarios WHERE ativo = 1
```

### 2. describe_table
Mostra a estrutura detalhada de uma tabela (colunas, tipos, chaves, engine, etc.).

**Parâmetros:**
- `tableName` (string, obrigatório): Nome da tabela

**Exemplo:**
```
usuarios
```

### 3. describe_view
Mostra a definição e estrutura de uma view.

**Parâmetros:**
- `viewName` (string, obrigatório): Nome da view

**Exemplo:**
```
v_relatorio_vendas
```

### 4. describe_indexes
Lista todos os índices de uma tabela.

**Parâmetros:**
- `tableName` (string, obrigatório): Nome da tabela

**Exemplo:**
```
pedidos
```

### 5. describe_triggers
Lista todos os triggers de uma tabela específica ou de todo o banco.

**Parâmetros:**
- `tableName` (string, opcional): Nome da tabela (deixe vazio para listar todos)

**Exemplo:**
```
usuarios
```
ou deixe vazio para listar todos os triggers do banco.

### 6. describe_procedures
Lista todas as stored procedures e funções do banco de dados.

**Sem parâmetros**

### 7. explain_query
Analisa o plano de execução de uma query.

**Parâmetros:**
- `query` (string, obrigatório): Query para analisar

**Exemplo:**
```sql
SELECT * FROM pedidos p JOIN usuarios u ON p.usuario_id = u.id WHERE u.cidade = 'São Paulo'
```

### 8. show_tables
Lista todas as tabelas e views do banco de dados atual.

**Sem parâmetros**

### 9. show_databases
Lista todos os bancos de dados disponíveis no servidor MySQL.

**Sem parâmetros**

## Exemplos de Uso no Cursor

Após configurar o servidor, você pode usar comandos como:

```
"Liste todos os bancos de dados disponíveis"
"Mostre todas as tabelas do banco atual"
"Descreva a estrutura da tabela usuarios"
"Descreva a view v_relatorio_vendas"
"Mostre os índices da tabela pedidos"
"Liste todos os triggers da tabela usuarios"
"Mostre todas as stored procedures"
"Execute: SELECT COUNT(*) FROM pedidos WHERE data_pedido >= '2024-01-01'"
"Explique esta query: SELECT * FROM produtos WHERE preco > 100"
```

## Segurança

- **Somente SELECTs**: Apenas consultas de leitura são permitidas
- **Limite de resultados**: Máximo de 1000 registros por consulta
- **Validação de queries**: Verificação automática de comandos perigosos
- **Conexão segura**: Sem multiple statements habilitados
- **Sem acesso a dados sensíveis**: Não permite DROP, DELETE, UPDATE, INSERT, etc.

## Solução de Problemas

### Erro de Conexão
```
❌ Erro ao conectar ao MySQL: connect ECONNREFUSED
```
**Solução:** Verifique se o MySQL está rodando e as credenciais estão corretas.

### Variáveis de Ambiente Faltando
```
❌ Variáveis de ambiente faltando: MYSQL_HOST, MYSQL_USER
```
**Solução:** Configure todas as variáveis obrigatórias no `.cursor/mcp.json`.

### Permissões Insuficientes
```
❌ Access denied for user
```
**Solução:** Verifique as permissões do usuário MySQL. O usuário precisa de permissão de SELECT no banco de dados e acesso a `information_schema`.

### View não encontrada
```
❌ View 'nome_view' não encontrada no banco 'database'
```
**Solução:** Verifique se o nome da view está correto e se ela existe no banco de dados atual.

## Requisitos

- Node.js >= 14
- MySQL >= 5.7 ou MariaDB >= 10.2
- Cursor IDE com suporte a MCP

## Versão

1.1.0

## Licença

ISC License

## Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature
3. Commit suas mudanças
4. Push para a branch
5. Abra um Pull Request
