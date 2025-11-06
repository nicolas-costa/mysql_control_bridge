#!/usr/bin/env node

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  ListToolsRequestSchema,
  CallToolRequestSchema
} = require('@modelcontextprotocol/sdk/types.js');
const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Carregar arquivos .env na ordem de prioridade (da mais baixa para mais alta):
// 1. .env na raiz do projeto (fallback mais baixo)
// 2. .env em .cursor/ (fallback médio, sobrescreve raiz)
// As variáveis do mcp.json são injetadas pelo Cursor depois e têm prioridade máxima
function loadEnvFiles() {
  let loadedFiles = [];
  let currentDir = process.cwd();
  const rootPath = path.parse(currentDir).root;
  
  // Encontrar a raiz do projeto (diretório que contém .cursor ou usar currentDir como fallback)
  let projectRoot = currentDir;
  let foundCursorDir = false;
  
  // Procurar diretório .cursor subindo pelos diretórios pais
  while (projectRoot !== rootPath) {
    const cursorDir = path.join(projectRoot, '.cursor');
    if (fs.existsSync(cursorDir) && fs.statSync(cursorDir).isDirectory()) {
      foundCursorDir = true;
      break;
    }
    projectRoot = path.dirname(projectRoot);
  }
  
  // Se não encontrou .cursor, usar o diretório atual como raiz
  if (!foundCursorDir) {
    projectRoot = currentDir;
  }
  
  // 1. Carregar .env da raiz do projeto primeiro (fallback mais baixo)
  // override: false garante que não sobrescreve variáveis já existentes (do mcp.json)
  const rootEnvPath = path.join(projectRoot, '.env');
  if (fs.existsSync(rootEnvPath)) {
    // Salvar valores já existentes antes de carregar
    const existingBeforeRoot = {};
    const envVarsToCheck = ['MYSQL_HOST', 'MYSQL_PORT', 'MYSQL_USER', 'MYSQL_PASSWORD', 'MYSQL_DATABASE'];
    envVarsToCheck.forEach(key => {
      if (process.env[key]) existingBeforeRoot[key] = process.env[key];
    });
    
    const result = dotenv.config({ path: rootEnvPath, override: false });
    if (!result.error) {
      // Restaurar valores que já existiam (do mcp.json)
      Object.keys(existingBeforeRoot).forEach(key => {
        process.env[key] = existingBeforeRoot[key];
      });
      loadedFiles.push(rootEnvPath);
      console.error(`✅ Arquivo .env carregado (raiz - fallback): ${rootEnvPath}`);
    }
  }
  
  // 2. Carregar .env de .cursor/ (fallback médio, sobrescreve valores da raiz mas não do mcp.json)
  if (foundCursorDir) {
    const cursorEnvPath = path.join(projectRoot, '.cursor', '.env');
    if (fs.existsSync(cursorEnvPath)) {
      // Salvar valores já existentes antes de carregar
      const existingBeforeCursor = {};
      const envVarsToCheck = ['MYSQL_HOST', 'MYSQL_PORT', 'MYSQL_USER', 'MYSQL_PASSWORD', 'MYSQL_DATABASE'];
      envVarsToCheck.forEach(key => {
        if (process.env[key]) existingBeforeCursor[key] = process.env[key];
      });
      
      const result = dotenv.config({ path: cursorEnvPath, override: true });
      if (!result.error) {
        // Restaurar valores que já existiam (do mcp.json)
        Object.keys(existingBeforeCursor).forEach(key => {
          process.env[key] = existingBeforeCursor[key];
        });
        loadedFiles.push(cursorEnvPath);
        console.error(`✅ Arquivo .env carregado (.cursor - fallback médio): ${cursorEnvPath}`);
      }
    }
  }
  
  return loadedFiles;
}

// Resolver interpolação de variáveis: ${VAR} e ${VAR:-default}
// Usa valores do process.env (que inclui valores do mcp.json e dos .env carregados)
function resolveEnvVar(value) {
  if (typeof value !== 'string') {
    return value;
  }
  
  // Padrão: ${VAR} ou ${VAR:-default}
  const pattern = /\$\{([^}]+)\}/g;
  
  return value.replace(pattern, (match, varExpr) => {
    // Verificar se tem valor padrão: VAR:-default
    const parts = varExpr.split(':-');
    const varName = parts[0].trim();
    const defaultValue = parts.length > 1 ? parts.slice(1).join(':-') : undefined;
    
    // Buscar no process.env
    const envValue = process.env[varName];
    
    if (envValue !== undefined && envValue !== '') {
      return envValue;
    }
    
    // Se não encontrou e tem valor padrão, usar padrão
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    
    // Se não encontrou e não tem padrão, retornar a string original ou vazio
    return process.env[varName] || '';
  });
}

// Processar e resolver todas as variáveis de ambiente que contêm interpolação
// Resolve recursivamente até que não haja mais interpolações
// Ordem de prioridade na resolução:
// 1. Variáveis diretas do mcp.json (não têm interpolação ou já foram resolvidas)
// 2. Variáveis de .cursor/.env
// 3. Variáveis de .env da raiz
function resolveEnvVariables() {
  const maxIterations = 10; // Prevenir loops infinitos
  let iterations = 0;
  let changed = true;
  
  while (changed && iterations < maxIterations) {
    changed = false;
    iterations++;
    
    // Processar todas as variáveis de ambiente que contêm interpolação
    // As variáveis do mcp.json já estão no process.env e serão resolvidas aqui
    for (const varName in process.env) {
      const value = process.env[varName];
      if (typeof value === 'string' && value.includes('${')) {
        const resolved = resolveEnvVar(value);
        if (resolved !== value) {
          process.env[varName] = resolved;
          changed = true;
        }
      }
    }
  }
  
  if (iterations >= maxIterations) {
    console.error('⚠️ Aviso: Limite de iterações atingido ao resolver variáveis de ambiente');
  }
}

// Carregar arquivos .env na ordem correta
loadEnvFiles();

// Resolver interpolações nas variáveis de ambiente
resolveEnvVariables();

class MySQLControlBridge {
  constructor() {
    this.server = new Server(
      {
        name: 'mysql-control-bridge',
        version: '1.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.connection = null;
    this.setupHandlers();
  }

  async connect() {
    try {
      // Validar ENVs obrigatórias
      const requiredEnvs = ['MYSQL_HOST', 'MYSQL_USER', 'MYSQL_DATABASE'];
      const missing = requiredEnvs.filter(env => !process.env[env]);

      if (missing.length > 0) {
        throw new Error(`Variáveis de ambiente faltando: ${missing.join(', ')}`);
      }

      this.connection = await mysql.createConnection({
        host: process.env.MYSQL_HOST,
        port: parseInt(process.env.MYSQL_PORT || '3306'),
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD || '',
        database: process.env.MYSQL_DATABASE,
        multipleStatements: false // Segurança - prevenir SQL injection
      });

      // Testar conexão
      await this.connection.ping();
      console.error(`✅ Conectado ao MySQL: ${process.env.MYSQL_DATABASE}@${process.env.MYSQL_HOST}`);
    } catch (error) {
      console.error('❌ Erro ao conectar ao MySQL:', error.message);
      console.error('📋 ENVs disponíveis:', {
        MYSQL_HOST: process.env.MYSQL_HOST,
        MYSQL_PORT: process.env.MYSQL_PORT,
        MYSQL_USER: process.env.MYSQL_USER,
        MYSQL_DATABASE: process.env.MYSQL_DATABASE,
        // Não logar a senha por segurança
        MYSQL_PASSWORD: process.env.MYSQL_PASSWORD ? '***' : 'não definida'
      });
      throw error;
    }
  }

  setupHandlers() {
    // Listar ferramentas disponíveis
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'execute_select_query',
            title: 'Executar Query SELECT',
            description: 'Executa uma query SELECT (somente leitura)',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'Query SELECT para executar',
                },
                limit: {
                  type: 'number',
                  description: 'Limite de resultados (máximo 1000)',
                  default: 100,
                  maximum: 1000
                }
              },
              required: ['query'],
            },
          },
          {
            name: 'describe_table',
            title: 'Descrever Tabela',
            description: 'Mostra informações detalhadas sobre uma tabela (colunas, tipos, chaves, etc.)',
            inputSchema: {
              type: 'object',
              properties: {
                tableName: {
                  type: 'string',
                  description: 'Nome da tabela',
                },
              },
              required: ['tableName'],
            },
          },
          {
            name: 'describe_view',
            title: 'Descrever View',
            description: 'Mostra a definição e estrutura de uma view',
            inputSchema: {
              type: 'object',
              properties: {
                viewName: {
                  type: 'string',
                  description: 'Nome da view',
                },
              },
              required: ['viewName'],
            },
          },
          {
            name: 'describe_indexes',
            title: 'Descrever Índices',
            description: 'Lista todos os índices de uma tabela',
            inputSchema: {
              type: 'object',
              properties: {
                tableName: {
                  type: 'string',
                  description: 'Nome da tabela',
                },
              },
              required: ['tableName'],
            },
          },
          {
            name: 'describe_triggers',
            title: 'Descrever Triggers',
            description: 'Lista todos os triggers de uma tabela',
            inputSchema: {
              type: 'object',
              properties: {
                tableName: {
                  type: 'string',
                  description: 'Nome da tabela (opcional, vazio para listar todos)',
                },
              },
            },
          },
          {
            name: 'describe_procedures',
            title: 'Descrever Procedures',
            description: 'Lista todas as stored procedures do banco de dados',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'explain_query',
            title: 'Explicar Query',
            description: 'Explica o plano de execução de uma query',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'Query para analisar',
                },
              },
              required: ['query'],
            },
          },
          {
            name: 'show_tables',
            title: 'Mostrar Tabelas',
            description: 'Lista todas as tabelas do banco de dados atual',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'show_databases',
            title: 'Mostrar Bancos de Dados',
            description: 'Lista todos os bancos de dados disponíveis no servidor',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          }
        ],
      };
    });

    // Executar ferramentas
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (!this.connection) await this.connect();

      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'execute_select_query':
            return await this.executeSelectQuery(args);

          case 'describe_table':
            return await this.describeTable(args.tableName);

          case 'describe_view':
            return await this.describeView(args.viewName);

          case 'describe_indexes':
            return await this.describeIndexes(args.tableName);

          case 'describe_triggers':
            return await this.describeTriggers(args.tableName);

          case 'describe_procedures':
            return await this.describeProcedures();

          case 'explain_query':
            return await this.explainQuery(args.query);

          case 'show_tables':
            return await this.showTables();

          case 'show_databases':
            return await this.showDatabases();

          default:
            throw new Error(`Ferramenta desconhecida: ${name}`);
        }
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: `❌ **Erro:** ${error.message}`,
          }],
          isError: true,
        };
      }
    });
  }

  async executeSelectQuery(args) {
    // Normalizar query: trim inicial
    let query = args.query.trim();
    
    // Verificar se tem trailing semicolon e salvar
    const hasTrailingSemicolon = query.endsWith(';');
    if (hasTrailingSemicolon) {
      query = query.slice(0, -1).trim();
    }
    
    // Remover comentários SQL trailing para evitar inserir LIMIT em comentários
    // Comentários de linha (-- comentário)
    query = query.replace(/--.*$/gm, '');
    // Comentários de bloco (/* comentário */)
    query = query.replace(/\/\*[\s\S]*?\*\//g, '');
    // Remover espaços extras após remover comentários
    query = query.trim().replace(/\s+/g, ' ');
    
    // Validar que é SELECT após limpeza
    if (!query.toLowerCase().startsWith('select')) {
      throw new Error('Apenas queries SELECT são permitidas');
    }

    // Detectar LIMIT existente usando word boundary (case-insensitive)
    // Isso evita falsos positivos como "LIMITATIONS" ou "UNLIMITED"
    const hasLimit = /\blimit\b/i.test(query);
    
    const limit = Math.min(args.limit || 100, 1000);
    let finalQuery = hasLimit 
      ? query 
      : `${query} LIMIT ${limit}`;
    
    // Re-adicionar semicolon original se existia
    if (hasTrailingSemicolon) {
      finalQuery += ';';
    }

    const [results] = await this.connection.execute(finalQuery);

    return {
      content: [{
        type: 'text',
        text: `✅ Query executada com sucesso!\n\n📊 **Resultados (${results.length} linhas):**\n\n\`\`\`json\n${JSON.stringify(results, null, 2)}\n\`\`\``,
      }],
    };
  }

  async describeTable(tableName) {
    if (!tableName) {
      throw new Error('Nome da tabela é obrigatório');
    }

    const [desc] = await this.connection.execute(`
      SELECT
        COLUMN_NAME as Campo,
        COLUMN_TYPE as Tipo,
        IS_NULLABLE as Nulo,
        COLUMN_KEY as Chave,
        COLUMN_DEFAULT as Padrão,
        EXTRA as Extra,
        COLUMN_COMMENT as Comentário
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
      ORDER BY ORDINAL_POSITION
    `, [process.env.MYSQL_DATABASE, tableName]);

    if (desc.length === 0) {
      throw new Error(`Tabela '${tableName}' não encontrada no banco '${process.env.MYSQL_DATABASE}'`);
    }

    // Buscar informações adicionais sobre a tabela
    const [tableInfo] = await this.connection.execute(`
      SELECT
        TABLE_TYPE as Tipo,
        ENGINE as Engine,
        TABLE_ROWS as Linhas,
        TABLE_COLLATION as Collation,
        TABLE_COMMENT as Comentário
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
    `, [process.env.MYSQL_DATABASE, tableName]);

    return {
      content: [{
        type: 'text',
        text: `📋 **Estrutura da tabela \`${tableName}\`:**\n\n` +
          `**Informações Gerais:**\n\`\`\`json\n${JSON.stringify(tableInfo[0], null, 2)}\n\`\`\`\n\n` +
          `**Colunas:**\n\`\`\`json\n${JSON.stringify(desc, null, 2)}\n\`\`\``,
      }],
    };
  }

  async describeView(viewName) {
    if (!viewName) {
      throw new Error('Nome da view é obrigatório');
    }

    // Buscar definição da view
    const [viewDef] = await this.connection.execute(`
      SELECT
        TABLE_NAME as Nome,
        VIEW_DEFINITION as Definição,
        CHECK_OPTION as CheckOption,
        IS_UPDATABLE as Atualizável,
        DEFINER as Definidor,
        SECURITY_TYPE as TipoSegurança
      FROM information_schema.VIEWS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
    `, [process.env.MYSQL_DATABASE, viewName]);

    if (viewDef.length === 0) {
      throw new Error(`View '${viewName}' não encontrada no banco '${process.env.MYSQL_DATABASE}'`);
    }

    // Buscar estrutura das colunas da view
    const [columns] = await this.connection.execute(`
      SELECT
        COLUMN_NAME as Campo,
        DATA_TYPE as TipoDados,
        IS_NULLABLE as Nulo,
        COLUMN_DEFAULT as Padrão,
        COLUMN_COMMENT as Comentário
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
      ORDER BY ORDINAL_POSITION
    `, [process.env.MYSQL_DATABASE, viewName]);

    return {
      content: [{
        type: 'text',
        text: `👁️ **Informações da view \`${viewName}\`:**\n\n` +
          `**Definição:**\n\`\`\`json\n${JSON.stringify(viewDef[0], null, 2)}\n\`\`\`\n\n` +
          `**Colunas:**\n\`\`\`json\n${JSON.stringify(columns, null, 2)}\n\`\`\`\n\n` +
          `**SQL da View:**\n\`\`\`sql\nCREATE OR REPLACE VIEW \`${viewName}\` AS ${viewDef[0].Definição}\n\`\`\``,
      }],
    };
  }

  async describeIndexes(tableName) {
    if (!tableName) {
      throw new Error('Nome da tabela é obrigatório');
    }

    const [indexes] = await this.connection.execute(`
      SELECT
        INDEX_NAME as NomeIndice,
        COLUMN_NAME as Coluna,
        NON_UNIQUE as NaoUnico,
        SEQ_IN_INDEX as Sequencia,
        COLLATION as Collation,
        CARDINALITY as Cardinalidade,
        INDEX_TYPE as TipoIndice,
        COMMENT as Comentário
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
      ORDER BY INDEX_NAME, SEQ_IN_INDEX
    `, [process.env.MYSQL_DATABASE, tableName]);

    if (indexes.length === 0) {
      throw new Error(`Nenhum índice encontrado para a tabela '${tableName}' ou tabela não existe`);
    }

    return {
      content: [{
        type: 'text',
        text: `🔑 **Índices da tabela \`${tableName}\`:**\n\n\`\`\`json\n${JSON.stringify(indexes, null, 2)}\n\`\`\``,
      }],
    };
  }

  async describeTriggers(tableName) {
    let query = `
      SELECT
        TRIGGER_NAME as NomeTrigger,
        EVENT_MANIPULATION as Evento,
        EVENT_OBJECT_TABLE as Tabela,
        ACTION_TIMING as Momento,
        ACTION_STATEMENT as Ação,
        ACTION_ORIENTATION as Orientação,
        DEFINER as Definidor,
        CREATED as Criado
      FROM information_schema.TRIGGERS
      WHERE TRIGGER_SCHEMA = ?
    `;
    const params = [process.env.MYSQL_DATABASE];

    if (tableName) {
      query += ' AND EVENT_OBJECT_TABLE = ?';
      params.push(tableName);
    }

    query += ' ORDER BY TRIGGER_NAME';

    const [triggers] = await this.connection.execute(query, params);

    if (triggers.length === 0) {
      const message = tableName 
        ? `Nenhum trigger encontrado para a tabela '${tableName}'`
        : `Nenhum trigger encontrado no banco '${process.env.MYSQL_DATABASE}'`;
      throw new Error(message);
    }

    return {
      content: [{
        type: 'text',
        text: `⚡ **Triggers${tableName ? ` da tabela \`${tableName}\`` : ''}:**\n\n\`\`\`json\n${JSON.stringify(triggers, null, 2)}\n\`\`\``,
      }],
    };
  }

  async describeProcedures() {
    const [procedures] = await this.connection.execute(`
      SELECT
        ROUTINE_NAME as Nome,
        ROUTINE_TYPE as Tipo,
        DEFINER as Definidor,
        CREATED as Criado,
        LAST_ALTERED as UltimaModificacao,
        ROUTINE_COMMENT as Comentario
      FROM information_schema.ROUTINES
      WHERE ROUTINE_SCHEMA = ?
      ORDER BY ROUTINE_NAME
    `, [process.env.MYSQL_DATABASE]);

    if (procedures.length === 0) {
      return {
        content: [{
          type: 'text',
          text: `ℹ️ Nenhuma stored procedure ou função encontrada no banco '${process.env.MYSQL_DATABASE}'`,
        }],
      };
    }

    return {
      content: [{
        type: 'text',
        text: `📦 **Stored Procedures e Funções do banco \`${process.env.MYSQL_DATABASE}\`:**\n\n\`\`\`json\n${JSON.stringify(procedures, null, 2)}\n\`\`\``,
      }],
    };
  }

  async explainQuery(query) {
    if (!query || !query.trim()) {
      throw new Error('Query é obrigatória');
    }

    // Normalizar query: remover espaços em branco e comentários SQL
    let normalizedQuery = query.trim();
    
    // Remover comentários SQL de linha única (-- comentário)
    normalizedQuery = normalizedQuery.replace(/--.*$/gm, '');
    
    // Remover comentários SQL de bloco (/* comentário */)
    normalizedQuery = normalizedQuery.replace(/\/\*[\s\S]*?\*\//g, '');
    
    // Remover espaços em branco extras e normalizar
    normalizedQuery = normalizedQuery.trim().replace(/\s+/g, ' ');

    // Extrair o primeiro comando SQL (case-insensitive)
    const firstKeywordMatch = normalizedQuery.match(/^\s*(\w+)/i);
    if (!firstKeywordMatch) {
      throw new Error('Query inválida: não foi possível identificar o comando SQL');
    }

    const firstKeyword = firstKeywordMatch[1].toUpperCase();

    // Permitir apenas SELECT ou WITH (CTEs começam com WITH)
    const allowedKeywords = ['SELECT', 'WITH'];
    if (!allowedKeywords.includes(firstKeyword)) {
      const forbiddenKeywords = [
        'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER', 'DROP',
        'GRANT', 'REVOKE', 'TRUNCATE', 'REPLACE', 'MERGE',
        'SET', 'CALL', 'EXECUTE', 'DECLARE', 'LOCK', 'UNLOCK'
      ];
      
      if (forbiddenKeywords.includes(firstKeyword)) {
        throw new Error(
          `Apenas queries SELECT ou WITH são permitidas para EXPLAIN. ` +
          `Comando detectado: ${firstKeyword}. Para segurança, apenas consultas de leitura são permitidas.`
        );
      }
      
      throw new Error(
        `Comando SQL não permitido para EXPLAIN: ${firstKeyword}. ` +
        `Apenas queries SELECT ou WITH são permitidas.`
      );
    }

    const [explain] = await this.connection.execute(`EXPLAIN ${query}`);

    return {
      content: [{
        type: 'text',
        text: `🔍 **Plano de execução:**\n\n\`\`\`json\n${JSON.stringify(explain, null, 2)}\n\`\`\``,
      }],
    };
  }

  async showTables() {
    const [tables] = await this.connection.execute(`
      SELECT
        TABLE_NAME as Nome,
        TABLE_TYPE as Tipo,
        ENGINE as Engine,
        TABLE_ROWS as Linhas,
        TABLE_COLLATION as Collation,
        TABLE_COMMENT as Comentario
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = ?
      ORDER BY TABLE_TYPE, TABLE_NAME
    `, [process.env.MYSQL_DATABASE]);

    if (tables.length === 0) {
      return {
        content: [{
          type: 'text',
          text: `ℹ️ Nenhuma tabela encontrada no banco '${process.env.MYSQL_DATABASE}'`,
        }],
      };
    }

    return {
      content: [{
        type: 'text',
        text: `📋 **Tabelas e Views do banco \`${process.env.MYSQL_DATABASE}\`:**\n\n\`\`\`json\n${JSON.stringify(tables, null, 2)}\n\`\`\``,
      }],
    };
  }

  async showDatabases() {
    const [databases] = await this.connection.execute(`
      SELECT
        SCHEMA_NAME as Nome,
        DEFAULT_CHARACTER_SET_NAME as CharsetPadrao,
        DEFAULT_COLLATION_NAME as CollationPadrao
      FROM information_schema.SCHEMATA
      ORDER BY SCHEMA_NAME
    `);

    if (databases.length === 0) {
      return {
        content: [{
          type: 'text',
          text: `ℹ️ Nenhum banco de dados encontrado`,
        }],
      };
    }

    return {
      content: [{
        type: 'text',
        text: `🗄️ **Bancos de dados disponíveis:**\n\n\`\`\`json\n${JSON.stringify(databases, null, 2)}\n\`\`\``,
      }],
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('🚀 MySQL Control Bridge iniciado (v1.1.0)');
  }
}

// Iniciar servidor
const server = new MySQLControlBridge();
server.run().catch((error) => {
  console.error('❌ Erro fatal:', error);
  process.exit(1);
});

// Cleanup
process.on('SIGINT', async () => {
  console.error('🔌 Desconectando...');
  if (server.connection) {
    await server.connection.end();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.error('🔌 Desconectando...');
  if (server.connection) {
    await server.connection.end();
  }
  process.exit(0);
});
