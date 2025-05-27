import { Express } from "express";
import { db } from "./db";
import { contacts } from "../shared/schema";
import { desc } from "drizzle-orm";

export function setupContactsFix(app: Express) {
  // API simples para listar contatos
  app.get('/api/contacts', async (req, res) => {
    try {
      console.log('📋 Buscando contatos...');
      const allContacts = await db.select().from(contacts).orderBy(desc(contacts.createdAt));
      
      res.json({
        contacts: allContacts,
        total: allContacts.length
      });
    } catch (error) {
      console.error('Erro:', error);
      res.status(500).json({ error: 'Erro interno' });
    }
  });

  // API para estatísticas
  app.get('/api/contacts/stats', async (req, res) => {
    try {
      const allContacts = await db.select().from(contacts);
      res.json({
        total: allContacts.length,
        today: 0,
        lastUpdate: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ error: 'Erro interno' });
    }
  });
}