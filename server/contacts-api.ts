import { Request, Response } from "express";
import { storage } from "./storage";

// API simples para contatos que funciona diretamente
export async function getContactsAPI(req: Request, res: Response) {
  try {
    console.log('📋 Buscando todos os contatos do banco...');
    
    const allContacts = await storage.getAllContacts();
    
    const response = {
      contacts: allContacts.map(contact => ({
        id: contact.id,
        name: contact.name,
        phoneNumber: contact.phoneNumber,
        email: contact.email,
        isActive: contact.isActive,
        createdAt: contact.createdAt,
        observation: contact.observation,
        tag: contact.tag,
        profilePictureUrl: contact.profilePictureUrl
      })),
      total: allContacts.length,
      page: 1,
      totalPages: 1
    };
    
    console.log(`✅ Encontrados ${allContacts.length} contatos`);
    res.json(response);
    
  } catch (error) {
    console.error('❌ Erro ao buscar contatos:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

export async function getContactStatsAPI(req: Request, res: Response) {
  try {
    const allContacts = await storage.getAllContacts();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayContacts = allContacts.filter(contact => 
      contact.createdAt && contact.createdAt >= today
    );
    
    const stats = {
      total: allContacts.length,
      today: todayContacts.length,
      lastUpdate: new Date().toISOString()
    };
    
    res.json(stats);
  } catch (error) {
    console.error('❌ Erro ao buscar estatísticas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}