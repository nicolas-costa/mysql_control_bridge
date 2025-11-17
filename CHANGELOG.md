# Changelog

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

## [1.3.0] - 2024-12-XX

### Adicionado
- **Suporte a múltiplos hosts**: Agora é possível configurar e gerenciar conexões simultâneas com múltiplos servidores MySQL
- **Parâmetro `host` em todas as ferramentas**: Todas as ferramentas agora aceitam um parâmetro opcional `host` para especificar qual servidor usar
- **Pool de conexões por host**: Cada host mantém sua própria conexão MySQL e túnel SSH (se aplicável)
- **Reconexão automática**: Conexões expiradas são detectadas e reconectadas automaticamente
- **Três formatos de configuração**:
  - Variável `MYSQL_HOSTS` com JSON (recomendado para múltiplos hosts)
  - Padrão de prefixo `HOSTNAME_*` (ex: `PROD_MYSQL_HOST`, `DEV_MYSQL_USER`)
  - Modo compatibilidade (variáveis diretas criam host `"default"`)

### Mudado
- **Compatibilidade retroativa**: Versões anteriores continuam funcionando através do modo compatibilidade
- **Validação de host**: Se múltiplos hosts estiverem configurados, o parâmetro `host` torna-se obrigatório
- **Mensagens de erro**: Agora incluem o nome do host para facilitar debugging

### Melhorado
- **Gerenciamento de conexões**: Melhor isolamento e gerenciamento de conexões por host
- **Cleanup**: Todas as conexões são fechadas adequadamente no shutdown
- **Logging**: Mensagens de log agora incluem informações sobre qual host está sendo usado

## [1.2.0] - Versão anterior

### Adicionado
- Suporte a túnel SSH com autenticação por chave privada
- Sistema de interpolação de variáveis de ambiente
- Suporte a múltiplos arquivos `.env` com ordem de prioridade
- Validação aprimorada de queries SQL

### Melhorado
- Tratamento de erros mais robusto
- Documentação expandida

## [1.0.0] - Versão inicial

### Adicionado
- Ferramentas básicas de consulta e exploração de banco de dados MySQL
- Suporte a conexão direta ao MySQL
- Validação de segurança para queries SELECT apenas
