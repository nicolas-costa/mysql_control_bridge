# MySQL Control Bridge

Servidor MCP (Model Context Protocol) para integração com MySQL, permitindo que IAs executem consultas seguras e obtenham informações detalhadas sobre bancos de dados MySQL através de ferramentas estruturadas. Suporta conexão direta ou através de túnel SSH com autenticação por chave privada (.pem/.cer).

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

### Conexão
- **Conexão direta** - Conecte-se diretamente ao MySQL
- **Túnel SSH** - Conecte-se através de túnel SSH usando arquivo de chave (.pem/.cer)
- **Múltiplos hosts** - Suporte a conexões simultâneas com múltiplos servidores MySQL
- **Configuração flexível** - Suporte a múltiplos ambientes e interpolação de variáveis

### Segurança
- **Somente SELECTs** - Apenas consultas de leitura são permitidas
- **Limite de resultados** - Máximo de 1000 registros por consulta
- **Validação de queries** - Verificação automática de comandos perigosos
- **Conexão segura** - Sem multiple statements habilitados
- **Autenticação SSH** - Suporte a chaves privadas para túneis SSH seguros

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

### Conexão via Túnel SSH

Para conectar ao MySQL através de um túnel SSH usando arquivo de chave (.pem/.cer), configure as seguintes variáveis:

```bash
SSH_HOST=servidor-ssh.example.com    # Host do servidor SSH (obrigatório para SSH)
SSH_USER=usuario_ssh                 # Usuário SSH (obrigatório para SSH)
SSH_KEY_FILE=/caminho/para/chave.pem # Caminho para arquivo de chave .pem/.cer (obrigatório para SSH)
SSH_PORT=22                          # Porta SSH (opcional, padrão: 22)
SSH_PASSPHRASE=senha_chave           # Senha da chave privada (opcional, apenas se a chave estiver protegida)
```

**Notas importantes:**
- Quando usando túnel SSH, `MYSQL_HOST` deve apontar para o host do MySQL **no servidor remoto** (geralmente `localhost` ou `127.0.0.1`)
- `MYSQL_PORT` deve ser a porta do MySQL **no servidor remoto** (geralmente `3306`)
- O arquivo de chave pode ser `.pem`, `.cer`, ou qualquer formato de chave privada SSH suportado
- O caminho do arquivo pode ser absoluto ou relativo ao diretório de trabalho
- Se todas as variáveis SSH (`SSH_HOST`, `SSH_USER`, `SSH_KEY_FILE`) estiverem configuradas, o túnel SSH será criado automaticamente
- Se nenhuma variável SSH estiver configurada, a conexão será direta ao MySQL (comportamento padrão)

### Suporte a Múltiplos Hosts

O MySQL Control Bridge agora suporta conexões simultâneas com múltiplos servidores MySQL. Cada host é identificado por um nome único e pode ter suas próprias credenciais e configurações SSH.

**Formato de configuração:**

As credenciais podem ser configuradas de três formas:

#### Opção 1: Variável MYSQL_HOSTS (JSON)

Configure múltiplos hosts usando uma variável JSON:

```json
{
  "mcpServers": {
    "mysql": {
      "command": "npx",
      "args": ["-y", "mysql_control_bridge"],
      "env": {
        "MYSQL_HOSTS": "{\"prod\":{\"MYSQL_HOST\":\"prod.example.com\",\"MYSQL_USER\":\"user\",\"MYSQL_PASSWORD\":\"pass\",\"MYSQL_DATABASE\":\"db\"},\"dev\":{\"MYSQL_HOST\":\"dev.example.com\",\"MYSQL_USER\":\"dev_user\",\"MYSQL_PASSWORD\":\"dev_pass\",\"MYSQL_DATABASE\":\"dev_db\"}}"
      }
    }
  }
}
```

#### Opção 2: Padrão de prefixo (HOSTNAME_*)

Configure hosts usando variáveis com prefixo:

```json
{
  "mcpServers": {
    "mysql": {
      "command": "npx",
      "args": ["-y", "mysql_control_bridge"],
      "env": {
        "PROD_MYSQL_HOST": "prod.example.com",
        "PROD_MYSQL_USER": "user",
        "PROD_MYSQL_PASSWORD": "pass",
        "PROD_MYSQL_DATABASE": "db",
        "DEV_MYSQL_HOST": "dev.example.com",
        "DEV_MYSQL_USER": "dev_user",
        "DEV_MYSQL_PASSWORD": "dev_pass",
        "DEV_MYSQL_DATABASE": "dev_db"
      }
    }
  }
}
```

#### Opção 3: Modo compatibilidade (host único)

Para manter compatibilidade com versões anteriores, se apenas variáveis diretas forem configuradas (sem `MYSQL_HOSTS` ou prefixos), o sistema criará automaticamente um host chamado `"default"`:

```json
{
  "mcpServers": {
    "mysql": {
      "command": "npx",
      "args": ["-y", "mysql_control_bridge"],
      "env": {
        "MYSQL_HOST": "localhost",
        "MYSQL_USER": "user",
        "MYSQL_PASSWORD": "pass",
        "MYSQL_DATABASE": "db"
      }
    }
  }
}
```

**Uso nas ferramentas:**

Todas as ferramentas agora aceitam um parâmetro opcional `host` para especificar qual servidor usar:

```json
{
  "host": "prod",
  "query": "SELECT * FROM usuarios LIMIT 10"
}
```

Se apenas um host estiver configurado, o parâmetro `host` pode ser omitido. Se múltiplos hosts estiverem configurados, o parâmetro `host` é obrigatório.

**Exemplo com múltiplos hosts e SSH:**

```json
{
  "mcpServers": {
    "mysql": {
      "command": "npx",
      "args": ["-y", "mysql_control_bridge"],
      "env": {
        "MYSQL_HOSTS": "{\"prod\":{\"MYSQL_HOST\":\"localhost\",\"MYSQL_USER\":\"user\",\"MYSQL_PASSWORD\":\"pass\",\"MYSQL_DATABASE\":\"db\",\"SSH_HOST\":\"prod-server.com\",\"SSH_USER\":\"ssh_user\",\"SSH_KEY_FILE\":\"/path/to/key.pem\"},\"dev\":{\"MYSQL_HOST\":\"localhost\",\"MYSQL_USER\":\"dev_user\",\"MYSQL_PASSWORD\":\"dev_pass\",\"MYSQL_DATABASE\":\"dev_db\"}}"
      }
    }
  }
}
```

**Gerenciamento de conexões:**

- Cada host mantém sua própria conexão MySQL e túnel SSH (se aplicável)
- Conexões são reutilizadas automaticamente quando possível
- Conexões expiradas são detectadas e reconectadas automaticamente
- Todas as conexões são fechadas adequadamente no shutdown

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

### Exemplo com Túnel SSH

Para conectar através de túnel SSH usando arquivo de chave:

**`.cursor/mcp.json`:**
```json
{
  "mcpServers": {
    "mysql-ssh": {
      "command": "npx",
      "args": ["-y", "mysql_control_bridge"],
      "env": {
        "SSH_HOST": "${SSH_HOST}",
        "SSH_USER": "${SSH_USER}",
        "SSH_KEY_FILE": "${SSH_KEY_FILE}",
        "SSH_PORT": "${SSH_PORT:-22}",
        "MYSQL_HOST": "localhost",
        "MYSQL_PORT": "3306",
        "MYSQL_USER": "${MYSQL_USER}",
        "MYSQL_PASSWORD": "${MYSQL_PASSWORD}",
        "MYSQL_DATABASE": "${MYSQL_DATABASE}"
      }
    }
  }
}
```

**`.cursor/.env`:**
```env
SSH_HOST=servidor-remoto.example.com
SSH_USER=usuario_ssh
SSH_KEY_FILE=/caminho/para/minha-chave.pem
SSH_PORT=22
MYSQL_USER=mysql_user
MYSQL_PASSWORD=mysql_password
MYSQL_DATABASE=meu_banco
```

**Notas:**
- `MYSQL_HOST` deve ser `localhost` ou `127.0.0.1` quando usando túnel SSH (pois o MySQL está no servidor remoto)
- `MYSQL_PORT` deve ser a porta do MySQL no servidor remoto (geralmente `3306`)
- `SSH_KEY_FILE` pode ser um caminho absoluto ou relativo ao diretório de trabalho
- Se a chave privada estiver protegida por senha, adicione `SSH_PASSPHRASE` no `.env`

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
- `host` (string, opcional): Nome do host a usar (obrigatório se múltiplos hosts estiverem configurados)
- `query` (string, obrigatório): Query SELECT para executar
- `limit` (number, opcional): Limite de resultados (máximo 1000, padrão 100)

**Exemplo:**
```sql
SELECT * FROM usuarios WHERE ativo = 1
```

### 2. describe_table
Mostra a estrutura detalhada de uma tabela (colunas, tipos, chaves, engine, etc.).

**Parâmetros:**
- `host` (string, opcional): Nome do host a usar (obrigatório se múltiplos hosts estiverem configurados)
- `tableName` (string, obrigatório): Nome da tabela

**Exemplo:**
```
usuarios
```

### 3. describe_view
Mostra a definição e estrutura de uma view.

**Parâmetros:**
- `host` (string, opcional): Nome do host a usar (obrigatório se múltiplos hosts estiverem configurados)
- `viewName` (string, obrigatório): Nome da view

**Exemplo:**
```
v_relatorio_vendas
```

### 4. describe_indexes
Lista todos os índices de uma tabela.

**Parâmetros:**
- `host` (string, opcional): Nome do host a usar (obrigatório se múltiplos hosts estiverem configurados)
- `tableName` (string, obrigatório): Nome da tabela

**Exemplo:**
```
pedidos
```

### 5. describe_triggers
Lista todos os triggers de uma tabela específica ou de todo o banco.

**Parâmetros:**
- `host` (string, opcional): Nome do host a usar (obrigatório se múltiplos hosts estiverem configurados)
- `tableName` (string, opcional): Nome da tabela (deixe vazio para listar todos)

**Exemplo:**
```
usuarios
```
ou deixe vazio para listar todos os triggers do banco.

### 6. describe_procedures
Lista todas as stored procedures e funções do banco de dados.

**Parâmetros:**
- `host` (string, opcional): Nome do host a usar (obrigatório se múltiplos hosts estiverem configurados)

### 7. explain_query
Analisa o plano de execução de uma query.

**Parâmetros:**
- `host` (string, opcional): Nome do host a usar (obrigatório se múltiplos hosts estiverem configurados)
- `query` (string, obrigatório): Query para analisar

**Exemplo:**
```sql
SELECT * FROM pedidos p JOIN usuarios u ON p.usuario_id = u.id WHERE u.cidade = 'São Paulo'
```

### 8. show_tables
Lista todas as tabelas e views do banco de dados atual.

**Parâmetros:**
- `host` (string, opcional): Nome do host a usar (obrigatório se múltiplos hosts estiverem configurados)

### 9. show_databases
Lista todos os bancos de dados disponíveis no servidor MySQL.

**Parâmetros:**
- `host` (string, opcional): Nome do host a usar (obrigatório se múltiplos hosts estiverem configurados)

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

### Erro ao criar túnel SSH
```
❌ Erro ao criar túnel SSH: connect ECONNREFUSED
```
**Solução:** 
- Verifique se o servidor SSH está acessível e a porta está correta
- Confirme que o arquivo de chave existe e tem permissões corretas (chmod 600 recomendado)
- Verifique se o usuário SSH tem acesso ao servidor
- Se a chave estiver protegida por senha, configure `SSH_PASSPHRASE`

### Arquivo de chave SSH não encontrado
```
❌ Arquivo de chave SSH não encontrado: /caminho/para/chave.pem
```
**Solução:** 
- Verifique se o caminho em `SSH_KEY_FILE` está correto
- Use caminho absoluto ou relativo ao diretório de trabalho
- Confirme que o arquivo existe e tem permissões de leitura

## Requisitos

- Node.js >= 14
- MySQL >= 5.7 ou MariaDB >= 10.2
- Cursor IDE com suporte a MCP

## Versão

1.3.0

## Licença

ISC License

## Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature
3. Commit suas mudanças
4. Push para a branch
5. Abra um Pull Request
