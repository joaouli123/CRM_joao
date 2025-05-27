import { Express, Request, Response } from "express";
import { db } from "./db";
import { contacts } from "../shared/schema";
import { desc, asc, like, and, gte, lte, eq } from "drizzle-orm";

export function setupSimpleContactsAPI(app: Express) {
  // GET /api/contacts - Lista todos os contatos
  app.get('/api/contacts', async (req: Request, res: Response) => {
    try {
      console.log('📋 Buscando contatos do banco de dados...');
      
      const allContacts = await db.select().from(contacts).orderBy(desc(contacts.createdAt));
      
      console.log(`✅ Encontrados ${allContacts.length} contatos no banco`);
      
      res.json({
        contacts: allContacts,
        total: allContacts.length,
        page: 1,
        totalPages: 1
      });
      
    } catch (error) {
      console.error('❌ Erro ao buscar contatos:', error);
      res.status(500).json({ error: 'Erro ao buscar contatos' });
    }
  });

  // GET /api/contacts/stats - Estatísticas dos contatos
  app.get('/api/contacts/stats', async (req: Request, res: Response) => {
    try {
      const allContacts = await db.select().from(contacts);
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const todayContacts = await db.select()
        .from(contacts)
        .where(gte(contacts.createdAt, today));
      
      res.json({
        total: allContacts.length,
        today: todayContacts.length,
        lastUpdate: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ Erro ao buscar estatísticas:', error);
      res.status(500).json({ error: 'Erro ao buscar estatísticas' });
    }
  });

  // POST /api/contacts - Criar novo contato
  app.post('/api/contacts', async (req: Request, res: Response) => {
    try {
      const { name, phoneNumber, email, observation, tag } = req.body;
      
      if (!name || !phoneNumber) {
        return res.status(400).json({ error: 'Nome e telefone são obrigatórios' });
      }
      
      const newContact = await db.insert(contacts).values({
        name,
        phoneNumber,
        email: email || null,
        observation: observation || null,
        tag: tag || null,
        connectionId: 1, // Conexão padrão
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning();
      
      console.log(`✅ Contato criado: ${name} (${phoneNumber})`);
      res.status(201).json(newContact[0]);
      
    } catch (error) {
      console.error('❌ Erro ao criar contato:', error);
      res.status(500).json({ error: 'Erro ao criar contato' });
    }
  });

  // PUT /api/contacts/:id - Atualizar contato
  app.put('/api/contacts/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { name, phoneNumber, email, observation, tag } = req.body;
      
      const updatedContact = await db.update(contacts)
        .set({
          name,
          phoneNumber,
          email: email || null,
          observation: observation || null,
          tag: tag || null,
          updatedAt: new Date()
        })
        .where(eq(contacts.id, parseInt(id)))
        .returning();
      
      if (updatedContact.length === 0) {
        return res.status(404).json({ error: 'Contato não encontrado' });
      }
      
      console.log(`✅ Contato atualizado: ${name} (${phoneNumber})`);
      res.json(updatedContact[0]);
      
    } catch (error) {
      console.error('❌ Erro ao atualizar contato:', error);
      res.status(500).json({ error: 'Erro ao atualizar contato' });
    }
  });

  // DELETE /api/contacts/:id - Deletar contato
  app.delete('/api/contacts/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      const deletedContact = await db.delete(contacts)
        .where(eq(contacts.id, parseInt(id)))
        .returning();
      
      if (deletedContact.length === 0) {
        return res.status(404).json({ error: 'Contato não encontrado' });
      }
      
      console.log(`✅ Contato deletado: ${deletedContact[0].name}`);
      res.json({ success: true });
      
    } catch (error) {
      console.error('❌ Erro ao deletar contato:', error);
      res.status(500).json({ error: 'Erro ao deletar contato' });
    }
  });

  console.log('📋 API de contatos simples configurada com sucesso!');
}