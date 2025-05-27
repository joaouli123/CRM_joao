# 📋 DOCUMENTAÇÃO DO SISTEMA WHATSAPP SAAS

## 🎯 VISÃO GERAL

Sistema SaaS completo para gestão de atendimento via WhatsApp, integrado com Evolution API e autenticação Clerk.

## 🚀 TECNOLOGIAS

- **Frontend**: React + TypeScript + Vite + Tailwind CSS + Shadcn/ui
- **Backend**: Node.js + Express + TypeScript
- **Banco**: PostgreSQL (Neon) + Drizzle ORM
- **Auth**: Clerk
- **WhatsApp**: Evolution API
- **Real-time**: WebSocket
- **Deploy**: Replit

## 🏗️ ARQUITETURA

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend      │    │  Evolution API  │
│   React/Vite    │◄──►│  Express/Node   │◄──►│   WhatsApp      │
│   Port 5000     │    │   Port 5000     │    │   Integration   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │              ┌─────────────────┐              │
         └──────────────►│  PostgreSQL DB  │◄─────────────┘
                        └─────────────────┘
```

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

## 🗄️ BANCO DE DADOS (PostgreSQL)

### Tabelas Principais

#### 🧑‍💼 **users** (Usuários)
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  clerkId VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) NOT NULL,
  firstName VARCHAR(255),
  lastName VARCHAR(255),
  imageUrl TEXT,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW()
);
```

#### 📱 **whatsapp_connections** (Conexões WhatsApp)
```sql
CREATE TABLE whatsapp_connections (
  id SERIAL PRIMARY KEY,
  userId INTEGER REFERENCES users(id),
  instanceName VARCHAR(255) UNIQUE NOT NULL,
  status VARCHAR(50) DEFAULT 'disconnected',
  qrCode TEXT,
  profileName VARCHAR(255),
  phoneNumber VARCHAR(20),
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW()
);
```

#### 👥 **contacts** (Contatos)
```sql
CREATE TABLE contacts (
  id SERIAL PRIMARY KEY,
  userId INTEGER REFERENCES users(id),
  connectionId INTEGER REFERENCES whatsapp_connections(id),
  name VARCHAR(255),
  phoneNumber VARCHAR(20) NOT NULL,
  profilePicture TEXT,
  lastSeen TIMESTAMP,
  createdAt TIMESTAMP DEFAULT NOW()
);
```

#### 💬 **messages** (Mensagens)
```sql
CREATE TABLE messages (
  id SERIAL PRIMARY KEY,
  connectionId INTEGER REFERENCES whatsapp_connections(id),
  contactId INTEGER REFERENCES contacts(id),
  messageId VARCHAR(255),
  content TEXT,
  type VARCHAR(50) DEFAULT 'text',
  direction VARCHAR(10) CHECK (direction IN ('in', 'out')),
  status VARCHAR(20) DEFAULT 'sent',
  timestamp TIMESTAMP NOT NULL,
  createdAt TIMESTAMP DEFAULT NOW()
);
```

## 🔌 EVOLUTION API

### Endpoints Principais

```javascript
// Configuração da API
const EVOLUTION_API_URL = "https://evolution.lowfy.com.br";
const EVOLUTION_API_KEY = "[PROTECTED]";

// Criar instância
POST /instance/create
{
  "instanceName": "whatsapp_user_123",
  "qrcode": true,
  "integration": "WHATSAPP-BAILEYS"
}

// Conectar (gerar QR)
GET /instance/connect/{instanceName}

// Enviar mensagem
POST /message/sendText/{instanceName}
{
  "number": "5511999999999",
  "text": "Olá! Como posso ajudar?"
}

// Buscar conversas
GET /chat/findMany/{instanceName}

// Buscar mensagens
GET /chat/findMessages/{instanceName}/{chatId}
```

## 🌐 ROTAS DA API

### 🔐 Autenticação
- `GET /api/auth/user` - Dados do usuário logado

### 📱 Conexões WhatsApp
- `GET /api/connections` - Listar conexões
- `POST /api/connections` - Criar nova conexão
- `GET /api/connections/:id/qr` - Gerar QR Code
- `GET /api/connections/:id/status` - Status da conexão
- `DELETE /api/connections/:id` - Deletar conexão

### 💬 Conversas e Mensagens
- `GET /api/connections/:id/conversations` - Listar conversas
- `GET /api/messages/:connectionId/:chatId` - Histórico de mensagens
- `POST /api/messages/:connectionId/send` - Enviar mensagem

### 👥 Contatos
- `GET /api/contacts` - Listar contatos
- `POST /api/contacts` - Criar/Importar contatos
- `PUT /api/contacts/:id` - Atualizar contato
- `DELETE /api/contacts/:id` - Deletar contato

### 🔗 WebSocket
- `WS /api/ws` - Mensagens em tempo real

## 🚀 COMO RODAR

1. **Instalar dependências**:
```bash
npm install
```

2. **Configurar variáveis de ambiente** (.env.local):
```env
CLERK_SECRET_KEY=your_clerk_secret
VITE_CLERK_PUBLISHABLE_KEY=your_clerk_publishable
EVOLUTION_API_URL=your_evolution_url
EVOLUTION_API_KEY=your_evolution_key
DATABASE_URL=your_postgres_url
```

3. **Rodar o projeto**:
```bash
npm run dev
```

4. **Acessar**: http://localhost:5000

## 📊 FUNCIONALIDADES

### ✅ Implementadas
- 🔐 Autenticação completa (Clerk)
- 📱 Múltiplas conexões WhatsApp
- 💬 Interface de chat em tempo real
- 👥 Gestão de contatos
- 📤 Envio de mensagens, áudios, imagens
- 🔌 WebSocket para tempo real
- 📊 Dashboard com estatísticas

### 🚧 Em Desenvolvimento
- 📈 Analytics avançados
- 🤖 Chatbot automático
- 📋 Templates de mensagens
- 📱 App mobile
- 🔄 Sincronização offline

## 🛠️ COMANDOS ÚTEIS

```bash
# Desenvolvimento
npm run dev

# Build para produção
npm run build

# Verificar tipos
npm run check

# Atualizar banco
npm run db:push
```

## 🔒 SEGURANÇA

- Autenticação via Clerk
- API Keys em variáveis de ambiente
- Validação de dados com Zod
- Rate limiting nas rotas
- CORS configurado

## 📱 FEATURES AVANÇADAS

### WebSocket Real-time
```typescript
// Cliente conecta automaticamente
const ws = new WebSocket('/api/ws');

// Recebe mensagens em tempo real
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  // Atualizar interface
};
```

### Multi-tenant
- Cada usuário tem suas próprias conexões
- Dados isolados por userId
- Permissões granulares

## 🎨 DESIGN SYSTEM

- **Cores**: Paleta moderna com tons de azul e cinza
- **Componentes**: Shadcn/ui + Tailwind CSS
- **Tipografia**: Inter (sistema)
- **Ícones**: Lucide React
- **Layout**: Responsivo mobile-first

---

**🚀 Sistema em produção e funcionando perfeitamente!**