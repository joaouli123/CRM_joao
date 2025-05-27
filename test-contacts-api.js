// Teste rápido da API de contatos
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function testContactsAPI() {
  try {
    console.log('🔍 Testando conexão com banco...');
    
    const result = await pool.query('SELECT name, phone_number, email, created_at FROM contacts ORDER BY created_at DESC LIMIT 10');
    
    console.log(`✅ Encontrados ${result.rows.length} contatos:`);
    result.rows.forEach((contact, index) => {
      console.log(`${index + 1}. ${contact.name} (${contact.phone_number}) - ${contact.email || 'Sem email'}`);
    });
    
    // Simular resposta da API
    const apiResponse = {
      contacts: result.rows.map(row => ({
        id: row.id,
        name: row.name,
        phoneNumber: row.phone_number,
        email: row.email,
        createdAt: row.created_at
      })),
      total: result.rows.length,
      page: 1,
      totalPages: 1
    };
    
    console.log('\n📋 Resposta da API:');
    console.log(JSON.stringify(apiResponse, null, 2));
    
  } catch (error) {
    console.error('❌ Erro ao testar API:', error);
  } finally {
    await pool.end();
  }
}

testContactsAPI();