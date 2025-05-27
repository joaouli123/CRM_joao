# 📋 DOCUMENTAÇÃO TÉCNICA COMPLETA - WhatsApp Manager

## 🎯 VISÃO GERAL DO SISTEMA

O **WhatsApp Manager** é uma plataforma empresarial avançada para comunicação via WhatsApp, integrando múltiplas instâncias, mensagens em tempo real, autenticação robusta e gestão inteligente de contatos.

### 🛠️ TECNOLOGIAS UTILIZADAS
- **Frontend**: React + TypeScript + Vite
- **Backend**: Express.js + Node.js
- **Banco de Dados**: PostgreSQL + Drizzle ORM
- **API Externa**: Evolution API (WhatsApp)
- **WebSocket**: Comunicação em tempo real
- **Autenticação**: Sistema Clerk personalizado

---

## 🏗️ ARQUITETURA DO SISTEMA

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend      │    │  Evolution API  │
│   (React)       │◄──►│  (Express.js)   │◄──►│   (WhatsApp)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │              ┌─────────────────┐              │
         └──────────────►│  PostgreSQL DB  │◄─────────────┘
                        └─────────────────┘
```

---

## 📁 ESTRUTURA DE ARQUIVOS

```
projeto/
├── client/                 # Frontend React
│   └── src/
│       ├── components/     # Componentes reutilizáveis
│       ├── pages/         # Páginas da aplicação
│       ├── lib/           # Bibliotecas e utilitários
│       └── hooks/         # Hooks personalizados
├── server/                # Backend Express
│   ├── routes.ts          # Rotas da API
│   ├── evolution-api.ts   # Integração Evolution API
│   ├── storage.ts         # Camada de dados
│   ├── db.ts             # Configuração banco
│   └── index.ts          # Servidor principal
├── shared/                # Tipos compartilhados
│   └── schema.ts         # Schemas Drizzle + Zod
└── tokens/               # Arquivos de configuração
```

---

## 🗄️ BANCO DE DADOS (PostgreSQL)

### Tabelas Principais

#### 🧑‍💼 **users** (Usuários)
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  clerkId VARCHAR UNIQUE NOT NULL,
  email VARCHAR UNIQUE NOT NULL,
  name VARCHAR NOT NULL,
  role VARCHAR DEFAULT 'user',     -- 'user' | 'superadmin'
  isActive BOOLEAN DEFAULT true,
  createdAt TIMESTAMP DEFAULT NOW()
);
```

#### 📱 **connections** (Conexões WhatsApp)
```sql
CREATE TABLE connections (
  id SERIAL PRIMARY KEY,
  name VARCHAR NOT NULL,
  phoneNumber VARCHAR,
  description TEXT,
  status VARCHAR DEFAULT 'disconnected',
  qrCode TEXT,
  qrExpiry TIMESTAMP,
  sessionData TEXT,
  lastActivity TIMESTAMP,
  messageCount INTEGER DEFAULT 0,
  createdAt TIMESTAMP DEFAULT NOW()
);
```

#### 💬 **messages** (Mensagens)
```sql
CREATE TABLE messages (
  id SERIAL PRIMARY KEY,
  connectionId INTEGER REFERENCES connections(id),
  direction VARCHAR NOT NULL,      -- 'sent' | 'received'
  "from" VARCHAR NOT NULL,
  "to" VARCHAR NOT NULL,
  body TEXT NOT NULL,
  status VARCHAR DEFAULT 'pending',
  timestamp TIMESTAMP DEFAULT NOW()
);
```

#### 📦 **archivedChats** (Conversas Arquivadas)
```sql
CREATE TABLE archivedChats (
  id SERIAL PRIMARY KEY,
  connectionId INTEGER REFERENCES connections(id),
  phoneNumber VARCHAR NOT NULL,
  contactName VARCHAR,
  archivedAt TIMESTAMP DEFAULT NOW(),
  totalMessages INTEGER DEFAULT 0
);
```

#### 📨 **archivedMessages** (Mensagens Arquivadas)
```sql
CREATE TABLE archivedMessages (
  id SERIAL PRIMARY KEY,
  archivedChatId INTEGER REFERENCES archivedChats(id),
  direction VARCHAR NOT NULL,
  "from" VARCHAR NOT NULL,
  "to" VARCHAR NOT NULL,
  body TEXT NOT NULL,
  timestamp TIMESTAMP NOT NULL
);
```

---

## 🛣️ ROTAS DA API (Backend)

### 🔐 **Autenticação**

#### `POST /api/auth/signin`
- **Função**: Fazer login no sistema
- **Parâmetros**: `{ email: string, password: string }`
- **Retorno**: `{ user: User, token: string }`
- **Localização**: `server/routes.ts:150`

#### `POST /api/auth/signout`
- **Função**: Fazer logout do sistema
- **Parâmetros**: Nenhum
- **Retorno**: `{ success: boolean }`
- **Localização**: `server/routes.ts:165`

### 📱 **Conexões WhatsApp**

#### `GET /api/connections`
- **Função**: Listar todas as conexões
- **Parâmetros**: Nenhum
- **Retorno**: `Connection[]`
- **Localização**: `server/routes.ts:180`

#### `POST /api/connections`
- **Função**: Criar nova conexão WhatsApp
- **Parâmetros**: `{ name: string, description?: string }`
- **Retorno**: `Connection`
- **Localização**: `server/routes.ts:190`

#### `GET /api/connections/:id/qr`
- **Função**: Gerar QR Code para conexão
- **Parâmetros**: `id` (connection ID)
- **Retorno**: `{ qrCode: string, expiry: Date }`
- **Localização**: `server/routes.ts:220`

#### `GET /api/connections/:id/status`
- **Função**: Verificar status da conexão
- **Parâmetros**: `id` (connection ID)
- **Retorno**: `{ status: string, info: object }`
- **Localização**: `server/routes.ts:245`

#### `DELETE /api/connections/:id`
- **Função**: Deletar conexão
- **Parâmetros**: `id` (connection ID)
- **Retorno**: `{ success: boolean }`
- **Localização**: `server/routes.ts:270`

### 💬 **Mensagens**

#### `GET /api/connections/:id/conversations`
- **Função**: Listar conversas de uma conexão
- **Parâmetros**: `id` (connection ID), `limit?`, `offset?`
- **Retorno**: `Conversation[]`
- **Localização**: `server/routes.ts:295`

#### `GET /api/connections/:id/messages/:phoneNumber`
- **Função**: Buscar mensagens de uma conversa
- **Parâmetros**: `id` (connection ID), `phoneNumber`, `limit?`
- **Retorno**: `Message[]`
- **Localização**: `server/routes.ts:320`

#### `POST /api/connections/:id/send`
- **Função**: Enviar mensagem
- **Parâmetros**: `id` (connection ID), `{ to: string, message: string }`
- **Retorno**: `{ success: boolean, messageId: string }`
- **Localização**: `server/routes.ts:350`

### 📦 **Arquivamento**

#### `GET /api/connections/:id/archived`
- **Função**: Listar conversas arquivadas
- **Parâmetros**: `id` (connection ID)
- **Retorno**: `ArchivedChat[]`
- **Localização**: `server/routes.ts:385`

#### `POST /api/connections/:id/archive`
- **Função**: Arquivar conversa
- **Parâmetros**: `id` (connection ID), `{ phoneNumber: string }`
- **Retorno**: `{ success: boolean }`
- **Localização**: `server/routes.ts:400`

#### `POST /api/connections/:id/unarchive/:chatId`
- **Função**: Desarquivar conversa
- **Parâmetros**: `id` (connection ID), `chatId`
- **Retorno**: `{ success: boolean }`
- **Localização**: `server/routes.ts:425`

### 🔌 **WebSocket**

#### `WS /api/ws`
- **Função**: Conexão WebSocket para tempo real
- **Eventos Enviados**: `message_received`, `message_sent`, `status_update`
- **Eventos Recebidos**: `join_connection`, `leave_connection`
- **Localização**: `server/routes.ts:450`

---

## 🎯 EVOLUTION API INTEGRATION

### 📍 **Classe EvolutionAPI** (`server/evolution-api.ts`)

#### Configuração
```typescript
const baseUrl = "https://evolution.lowfy.com.br"
const apiKey = "011dA95bf60bb215afd8cce1e01f99598A"
const instanceId = "663d47ec-d490-4822-9c8d-c258cc46e0c1"
```

#### Métodos Principais

##### `createInstance(instanceName: string)`
- **Função**: Criar nova instância WhatsApp
- **Endpoint**: `POST /instance/create`
- **Localização**: Linha 85

##### `generateQRCode(instanceName: string)`
- **Função**: Gerar QR Code para conexão
- **Endpoint**: `GET /instance/connect/{instanceName}`
- **Localização**: Linha 120

##### `sendMessage(instanceName: string, to: string, message: string)`
- **Função**: Enviar mensagem via WhatsApp
- **Endpoint**: `POST /message/sendText/{instanceName}`
- **Localização**: Linha 160

##### `getAllChats(instanceName: string)`
- **Função**: Buscar todos os chats/contatos
- **Endpoint**: `GET /chat/findChats/{instanceName}`
- **Localização**: Linha 190

##### `getChatMessages(instanceName: string, chatId: string)`
- **Função**: Buscar mensagens de um chat
- **Endpoint**: `POST /chat/findMessages/{instanceName}`
- **Localização**: Linha 220

##### `getProfilePicture(instanceName: string, phoneNumber: string)`
- **Função**: Buscar foto de perfil do contato
- **Endpoint**: `POST /chat/fetchProfilePictureUrl/{instanceName}`
- **Localização**: Linha 250

---

## 🗃️ CAMADA DE DADOS (Storage)

### 📍 **Interface IStorage** (`server/storage.ts`)

#### Métodos de Usuários
- `getUser(id: number)`: Buscar usuário por ID
- `getUserByEmail(email: string)`: Buscar usuário por email
- `createUser(user: InsertUser)`: Criar novo usuário
- `updateUser(id: number, updates: Partial<User>)`: Atualizar usuário
- `getAllUsers()`: Listar todos os usuários

#### Métodos de Conexões
- `getConnection(id: number)`: Buscar conexão por ID
- `getAllConnections()`: Listar todas as conexões
- `createConnection(connection: InsertConnection)`: Criar conexão
- `updateConnection(id: number, updates: Partial<Connection>)`: Atualizar conexão
- `deleteConnection(id: number)`: Deletar conexão

#### Métodos de Mensagens
- `getMessagesByConnection(connectionId: number)`: Buscar mensagens
- `getConversationsByConnection(connectionId: number)`: Buscar conversas
- `createMessage(message: InsertMessage)`: Criar mensagem
- `updateMessage(id: number, updates: Partial<Message>)`: Atualizar mensagem

#### Métodos de Arquivamento
- `getArchivedChatsByConnection(connectionId: number)`: Buscar arquivados
- `createArchivedChat(chat: InsertArchivedChat)`: Arquivar conversa
- `unarchiveChat(id: number)`: Desarquivar conversa

### 📍 **Implementação DatabaseStorage**
- **Localização**: `server/storage.ts:253-450`
- **Tecnologia**: Drizzle ORM + PostgreSQL
- **Padrão**: Repository Pattern

---

## ⚛️ FRONTEND (React)

### 📍 **Páginas Principais**

#### `client/src/pages/dashboard.tsx`
- **Função**: Dashboard principal com estatísticas
- **Componentes**: ConnectionStats, ConnectionManager, QRCodeModal
- **Estado**: connections, stats, activeTab

#### `client/src/pages/sign-in.tsx`
- **Função**: Página de login
- **Formulário**: email, password
- **Validação**: Zod schema

#### `client/src/pages/sign-up.tsx`
- **Função**: Página de cadastro
- **Formulário**: name, email, password
- **Validação**: Zod schema

### 📍 **Componentes Principais**

#### `client/src/components/message-interface-final.tsx`
- **Função**: Interface principal de mensagens (estilo WhatsApp Web)
- **Features**: Lista de contatos, chat, envio de mensagens, tempo real
- **WebSocket**: Integração para mensagens instantâneas
- **Estado**: conversations, selectedContact, messages, newMessage

#### `client/src/components/ui/contact-avatar.tsx`
- **Função**: Avatar dos contatos com foto de perfil
- **Features**: Fallback SVG, carregamento da Evolution API
- **Props**: phoneNumber, contactName, size, connectionId

#### `client/src/components/protected-route.tsx`
- **Função**: Proteção de rotas (autenticação obrigatória)
- **Verificação**: Token válido, usuário logado
- **Redirecionamento**: Para login se não autenticado

#### `client/src/components/user-header.tsx`
- **Função**: Cabeçalho com informações do usuário
- **Features**: Nome, avatar, badge superadmin, logout
- **Permissões**: Diferenciação visual para superadmins

### 📍 **Hooks Personalizados**

#### `client/src/hooks/use-websocket.ts`
- **Função**: Gerenciar conexão WebSocket
- **Features**: Auto-reconexão, eventos tipados
- **Estado**: isConnected, lastMessage, connectionStatus

### 📍 **Bibliotecas e Utilitários**

#### `client/src/lib/clerk.ts`
- **Função**: Sistema de autenticação personalizado
- **Features**: Login, logout, verificação de permissões
- **Storage**: localStorage para persistência

#### `client/src/lib/api.ts`
- **Função**: Cliente HTTP para API
- **Features**: Interceptors, tratamento de erros
- **Base URL**: Configuração automática

#### `client/src/lib/websocket.ts`
- **Função**: Cliente WebSocket tipado
- **Features**: Eventos tipados, auto-reconexão
- **URL**: Detecção automática (ws/wss)

---

## 🔄 FLUXO DE FUNCIONAMENTO

### 1. **Autenticação**
```
Login → Verificação Email → Determinação Role → Criação Session → Redirecionamento Dashboard
```

### 2. **Criação de Conexão WhatsApp**
```
Dashboard → Criar Conexão → Evolution API → QR Code → Scan WhatsApp → Conexão Ativa
```

### 3. **Envio de Mensagem**
```
Interface → Validação → Evolution API → WhatsApp → WebSocket → Atualização UI
```

### 4. **Recebimento de Mensagem**
```
WhatsApp → Evolution API → Polling/WebSocket → Backend → WebSocket → UI Update
```

### 5. **Carregamento de Conversas**
```
Seleção Conexão → Evolution API → Busca Contatos → Fotos Perfil → Lista Conversas
```

---

## 🛡️ SISTEMA DE PERMISSÕES

### 👤 **Usuário Comum**
- ✅ Ver próprias conexões
- ✅ Enviar/receber mensagens
- ✅ Arquivar conversas
- ❌ Gerenciar outros usuários
- ❌ Configurações globais

### 👑 **Superadmin**
- ✅ Todas as permissões de usuário comum
- ✅ Ver todas as conexões
- ✅ Gerenciar usuários
- ✅ Configurações do sistema
- ✅ Badge visual distintivo

### 🔍 **Identificação de Superadmin**
```typescript
const isSuperAdmin = email.toLowerCase().includes('admin') || 
                    email === 'admin@whatsapp.com' ||
                    email === 'superadmin@whatsapp.com';
```

---

## 🔌 WEBSOCKET - COMUNICAÇÃO TEMPO REAL

### **Eventos do Cliente → Servidor**
- `join_connection`: Entrar em uma conexão específica
- `leave_connection`: Sair de uma conexão
- `typing_start`: Iniciar digitação
- `typing_stop`: Parar digitação

### **Eventos do Servidor → Cliente**
- `message_received`: Nova mensagem recebida
- `message_sent`: Confirmação de envio
- `status_update`: Atualização de status da conexão
- `typing_indicator`: Indicador de digitação

### **Configuração WebSocket**
```typescript
// Cliente
const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
const wsUrl = `${protocol}//${window.location.host}/api/ws`;

// Servidor
const wss = new WebSocketServer({ server: httpServer, path: '/api/ws' });
```

---

## 📊 MONITORAMENTO E LOGS

### **Logs do Sistema**
- ✅ Conexões Evolution API
- ✅ Envio/recebimento de mensagens
- ✅ Erros de autenticação
- ✅ Status das conexões WhatsApp
- ✅ Atividade dos usuários

### **Métricas Disponíveis**
- Total de conexões ativas
- Mensagens enviadas hoje
- Usuários online
- Taxa de entrega de mensagens

---

## 🚀 DEPLOY E CONFIGURAÇÃO

### **Variáveis de Ambiente Necessárias**
```env
DATABASE_URL=postgresql://...
EVOLUTION_API_URL=https://evolution.lowfy.com.br
EVOLUTION_API_KEY=011dA95bf60bb215afd8cce1e01f99598A
EVOLUTION_INSTANCE_ID=663d47ec-d490-4822-9c8d-c258cc46e0c1
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
```

### **Scripts Disponíveis**
```bash
npm run dev        # Desenvolvimento
npm run build      # Build produção
npm run db:push    # Aplicar schema ao banco
npm run db:migrate # Executar migrações
```

---

## 🔧 MANUTENÇÃO E TROUBLESHOOTING

### **Problemas Comuns**

#### 1. **QR Code não gera**
- ✅ Verificar Evolution API Key
- ✅ Confirmar instância ativa
- ✅ Checar logs do servidor

#### 2. **Mensagens não chegam em tempo real**
- ✅ Verificar conexão WebSocket
- ✅ Confirmar polling ativo
- ✅ Checar firewall/proxy

#### 3. **Fotos de perfil não carregam**
- ✅ Verificar endpoint Evolution API
- ✅ Confirmar permissões CORS
- ✅ Checar cache do navegador

### **Comandos de Debug**
```bash
# Verificar conexão banco
npm run db:studio

# Logs em tempo real
tail -f logs/app.log

# Status Evolution API
curl -H "Authorization: Bearer $EVOLUTION_API_KEY" $EVOLUTION_API_URL/instance/fetchInstances
```

---

## 📈 PRÓXIMAS FUNCIONALIDADES

### **Em Desenvolvimento**
- [ ] Suporte a mídias (imagens, documentos)
- [ ] Mensagens agendadas
- [ ] Relatórios avançados
- [ ] Integração com CRM
- [ ] API pública para desenvolvedores

### **Planejado**
- [ ] Suporte multi-idiomas
- [ ] Temas personalizáveis
- [ ] Backup automático
- [ ] Notificações push
- [ ] App mobile

---

## 👥 SUPORTE E CONTATO

### **Documentação Adicional**
- 📋 Evolution API: https://www.postman.com/agenciadgcode/evolution-api/documentation/jn0bbzv/evolution-api-v2-2-2
- 🎯 Drizzle ORM: https://orm.drizzle.team/
- ⚛️ React Query: https://tanstack.com/query/

### **Estrutura de Suporte**
- 🔧 **Nível 1**: Problemas de usuário comum
- 🛠️ **Nível 2**: Problemas técnicos avançados  
- 🏗️ **Nível 3**: Arquitetura e desenvolvimento

---

*Documentação criada em: 27/05/2025*
*Versão do Sistema: 2.1.0*
*Última Atualização: 27/05/2025 03:19*