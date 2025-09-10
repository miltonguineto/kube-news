# Documentação Técnica - Kube-News

## 📋 Visão Geral do Projeto

O **Kube-News** é uma aplicação de portal de notícias desenvolvida em Node.js com foco em demonstrar práticas de containerização, Kubernetes e observabilidade. A aplicação foi projetada especificamente para ambientes cloud-native com recursos de monitoramento e chaos engineering integrados.

### Métricas do Projeto
- **Linguagem Principal**: JavaScript (Node.js)
- **Total de Arquivos JavaScript**: 4 arquivos principais
- **Linhas de Código**: 212 linhas totais
- **Dependências**: 6 principais + dependências transitivas
- **Vulnerabilidades de Segurança**: 9 detectadas (requer atenção)

---

## 🏗️ Arquitetura da Aplicação

### Stack Tecnológica
```
Frontend: EJS Templates + CSS
    ↓
Backend: Express.js + Node.js
    ↓
ORM: Sequelize
    ↓
Database: PostgreSQL
    ↓
Monitoring: Prometheus + Custom Metrics
```

### Estrutura de Diretórios
```
kube-news/
├── src/                        # Código-fonte principal
│   ├── models/                 # Modelos de dados (Sequelize)
│   │   └── post.js            # Modelo Post com configuração de DB
│   ├── views/                 # Templates EJS
│   │   ├── partial/           # Componentes reutilizáveis
│   │   ├── index.ejs          # Página inicial (lista de posts)
│   │   ├── edit-news.ejs      # Formulário de criação/edição
│   │   └── view-news.ejs      # Visualização individual
│   ├── static/               # Assets estáticos
│   │   ├── img/              # Imagens
│   │   └── styles/           # CSS
│   ├── server.js             # Servidor principal (82 linhas)
│   ├── middleware.js         # Middleware de métricas (14 linhas)
│   ├── system-life.js        # Health checks e chaos (53 linhas)
│   └── package.json          # Dependências
├── popula-dados.http         # Dados de exemplo para testes
└── README.md                 # Documentação do usuário
```

---

## 🚀 Funcionalidades Principais

### 1. Portal de Notícias
- **Listagem de Posts**: Exibe todas as notícias na página inicial
- **Visualização Individual**: Cada post tem sua própria página
- **Criação de Posts**: Formulário web para novos artigos
- **Validação de Dados**: 
  - Título: máximo 30 caracteres
  - Resumo: máximo 50 caracteres  
  - Conteúdo: máximo 2000 caracteres

### 2. API REST
- **Endpoint de Criação Individual**: `POST /post`
- **Endpoint de Criação em Massa**: `POST /api/post`
  - Aceita array de artigos no campo `artigos`
  - Usado para população inicial de dados

### 3. Observabilidade e Monitoramento
- **Health Check**: `GET /health`
  - Retorna status da aplicação e hostname
  - Essencial para probes do Kubernetes
  
- **Readiness Check**: `GET /ready`
  - Indica se a aplicação está pronta para receber tráfego
  - Pode ser temporariamente desabilitado para testes

- **Métricas Prometheus**: `GET /metrics`
  - Métricas HTTP automáticas via express-prom-bundle
  - Contador customizado de requisições por método/path
  - Métricas padrão do Node.js

### 4. Chaos Engineering
- **Simulação de Falha**: `PUT /unhealth`
  - Força todas as requisições a retornarem erro 500
  - Útil para testar recovery automático
  
- **Simulação de Indisponibilidade**: `PUT /unreadyfor/:seconds`
  - Marca a aplicação como não-pronta por X segundos
  - Testa comportamento de readiness probes

---

## 💾 Modelo de Dados

### Entidade Post
```javascript
{
  title: String,        // Título da notícia
  summary: String,      // Resumo/subtítulo
  content: String(2000), // Conteúdo completo
  publishDate: DATEONLY // Data de publicação
}
```

### Configuração do Banco de Dados
- **PostgreSQL** como SGBD principal
- **Sequelize** como ORM
- **Auto-sync** habilitado com `alter: true`
- **SSL configurável** via variável de ambiente
- **Pool de conexões** gerenciado pelo Sequelize

---

## 🔧 Configuração e Deploy

### Variáveis de Ambiente
```bash
DB_DATABASE=kubedevnews      # Nome do banco
DB_USERNAME=kubedevnews      # Usuário do banco
DB_PASSWORD=Pg#123           # Senha do banco
DB_HOST=localhost            # Host do banco
DB_PORT=5432                 # Porta do banco
DB_SSL_REQUIRE=false         # Requer SSL
```

### Comandos de Desenvolvimento
```bash
# Instalação
cd src && npm install

# Execução local
npm start                    # Inicia na porta 8080

# População de dados
# Usar popula-dados.http com REST client
```

### Dependências Principais
```json
{
  "express": "4.18.1",           // Framework web
  "sequelize": "6.19.0",         // ORM
  "pg": "8.7.3",                 // Driver PostgreSQL
  "ejs": "3.1.7",                // Engine de templates
  "express-prom-bundle": "6.4.1", // Métricas Prometheus
  "prom-client": "14.0.1"        // Cliente Prometheus
}
```

---

## 🔒 Considerações de Segurança

### ⚠️ Vulnerabilidades Identificadas
- **9 vulnerabilidades** detectadas pelo npm audit
- Recomenda-se atualizar dependências regularmente
- Usar `npm audit fix` para correções automáticas

### Possíveis Melhorias de Segurança
1. **Input Validation**: Validação mais robusta nos endpoints
2. **SQL Injection**: Sequelize fornece proteção, mas revisar queries customizadas
3. **Rate Limiting**: Implementar para APIs públicas
4. **HTTPS**: Configurar SSL/TLS em produção
5. **Secrets Management**: Não usar senhas padrão em produção
6. **CORS**: Configurar adequadamente para APIs

### Boas Práticas Implementadas
- ✅ Uso de ORM (Sequelize) para prevenção de SQL Injection
- ✅ Separação de configuração via variáveis de ambiente
- ✅ Health checks para monitoramento
- ✅ Estrutura modular do código

---

## 📊 Recursos de Monitoramento

### Métricas Coletadas
1. **HTTP Requests Total**: Contador por método e path
2. **Response Times**: Histograma de latência
3. **Active Handles**: Recursos do Node.js
4. **Memory Usage**: Consumo de memória
5. **CPU Usage**: Utilização de CPU

### Integração com Kubernetes
```yaml
# Exemplo de configuração de probes
livenessProbe:
  httpGet:
    path: /health
    port: 8080
  initialDelaySeconds: 30
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /ready
    port: 8080
  initialDelaySeconds: 5
  periodSeconds: 5
```

---

## 🐛 Análise de Qualidade do Código

### Pontos Fortes
- ✅ Código limpo e bem estruturado
- ✅ Separação clara de responsabilidades
- ✅ Uso adequado de middleware
- ✅ Documentação presente
- ✅ Recursos de observabilidade integrados

### Pontos de Melhoria
- ⚠️ Ausência de testes automatizados
- ⚠️ Tratamento de erros pode ser aprimorado
- ⚠️ Validação de entrada básica
- ⚠️ Logs estruturados não implementados
- ⚠️ Vulnerabilidades de dependências

### Recomendações
1. **Implementar Testes**: Jest ou Mocha para testes unitários
2. **Melhorar Logging**: Winston ou similar para logs estruturados  
3. **Error Handling**: Middleware global de tratamento de erros
4. **Validação**: Joi ou express-validator para validação robusta
5. **Documentação API**: Swagger/OpenAPI para endpoints
6. **CI/CD**: Pipeline automatizado para testes e deploy

---

## 🚀 Próximos Passos

### Melhorias Técnicas Sugeridas
1. **Containerização**: Dockerfile otimizado para produção
2. **Helm Charts**: Templates para deploy no Kubernetes
3. **Database Migrations**: Versionamento do schema
4. **Backup Strategy**: Estratégia de backup automático
5. **Performance**: Cache com Redis para consultas frequentes
6. **Security**: Implementação de autenticação e autorização

### Evolução Funcional
1. **Sistema de Usuários**: Autenticação e perfis
2. **Comentários**: Sistema de comentários nos posts
3. **Categorias**: Organização por categorias/tags  
4. **Busca**: Sistema de busca textual
5. **Editor WYSIWYG**: Interface rica para criação de conteúdo
6. **API GraphQL**: Alternativa mais flexível ao REST

---

*Documentação gerada em: 09/09/2025*  
*Versão da Aplicação: 1.0.0*  
*Node.js: Compatível com versões 14+*