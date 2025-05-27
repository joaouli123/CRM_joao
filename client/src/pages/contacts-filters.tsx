import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Search, Filter, Edit, Save, X, Phone, MessageCircle, Tag, Eye } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'

interface Contact {
  id: number
  name: string
  phoneNumber: string
  email: string | null
  observation: string | null
  tag: string | null
  origem: string | null
  isActive: boolean
  connectionId: number
  createdAt: string | null
  updatedAt: string | null
  profilePictureUrl: string | null
}

export default function ContactsFilters() {
  const [searchQuery, setSearchQuery] = useState('')
  const [tagFilter, setTagFilter] = useState('all')
  const [origemFilter, setOrigemFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [editingContact, setEditingContact] = useState<Contact | null>(null)
  const [editForm, setEditForm] = useState({
    name: '',
    phoneNumber: '',
    email: '',
    observation: '',
    tag: '',
    origem: ''
  })
  
  const { toast } = useToast()
  
  // Buscar todos os contatos
  const { data: contacts = [], isLoading, refetch } = useQuery({
    queryKey: ['/api/contacts'],
  })

  // Filtrar contatos baseado nos critérios
  const filteredContacts = contacts.filter((contact: Contact) => {
    const matchesSearch = !searchQuery || 
      contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.phoneNumber.includes(searchQuery) ||
      (contact.email && contact.email.toLowerCase().includes(searchQuery.toLowerCase()))
    
    const matchesTag = tagFilter === 'all' || contact.tag === tagFilter
    const matchesOrigem = origemFilter === 'all' || contact.origem === origemFilter
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'active' && contact.isActive) ||
      (statusFilter === 'inactive' && !contact.isActive)
    
    return matchesSearch && matchesTag && matchesOrigem && matchesStatus
  })

  // Obter tags únicas para o filtro
  const uniqueTags = [...new Set(contacts.map((c: Contact) => c.tag).filter(Boolean))]
  const uniqueOrigens = [...new Set(contacts.map((c: Contact) => c.origem).filter(Boolean))]

  const handleEditContact = (contact: Contact) => {
    setEditingContact(contact)
    setEditForm({
      name: contact.name || '',
      phoneNumber: contact.phoneNumber || '',
      email: contact.email || '',
      observation: contact.observation || '',
      tag: contact.tag || '',
      origem: contact.origem || ''
    })
  }

  const handleSaveContact = async () => {
    if (!editingContact) return

    try {
      const response = await fetch(`/api/contacts/${editingContact.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editForm,
          observacao: editForm.observation, // Backend espera 'observacao'
          etiqueta: editForm.tag, // Backend espera 'etiqueta'
        })
      })

      if (!response.ok) throw new Error('Erro ao salvar contato')

      toast({
        title: "✅ Contato atualizado!",
        description: "As informações foram salvas com sucesso.",
      })

      setEditingContact(null)
      refetch()
    } catch (error) {
      toast({
        title: "❌ Erro",
        description: "Não foi possível salvar o contato.",
        variant: "destructive"
      })
    }
  }

  const openWhatsAppChat = (phoneNumber: string) => {
    const cleanPhone = phoneNumber.replace(/\D/g, '')
    window.open(`https://wa.me/${cleanPhone}`, '_blank')
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gerenciar Contatos</h1>
          <p className="text-gray-600">Filtre, edite e gerencie seus contatos com ferramentas avançadas</p>
        </div>
        <Badge variant="secondary" className="text-lg px-4 py-2">
          {filteredContacts.length} contatos
        </Badge>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros Avançados
          </CardTitle>
          <CardDescription>
            Use os filtros abaixo para encontrar contatos específicos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Busca */}
            <div className="space-y-2">
              <Label>Buscar</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Nome, telefone ou email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Filtro por Tag */}
            <div className="space-y-2">
              <Label>Tag</Label>
              <Select value={tagFilter} onValueChange={setTagFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas as tags" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as tags</SelectItem>
                  {uniqueTags.map((tag) => (
                    <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Filtro por Origem */}
            <div className="space-y-2">
              <Label>Origem</Label>
              <Select value={origemFilter} onValueChange={setOrigemFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas as origens" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as origens</SelectItem>
                  {uniqueOrigens.map((origem) => (
                    <SelectItem key={origem} value={origem}>{origem}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Filtro por Status */}
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="active">Ativos</SelectItem>
                  <SelectItem value="inactive">Inativos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Botões de ação */}
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setSearchQuery('')
                setTagFilter('all')
                setOrigemFilter('all')
                setStatusFilter('all')
              }}
            >
              <X className="h-4 w-4 mr-2" />
              Limpar Filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Contatos */}
      <div className="grid gap-4">
        {filteredContacts.map((contact: Contact) => (
          <Card key={contact.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {/* Avatar */}
                  <div className="h-12 w-12 rounded-full bg-orange-100 flex items-center justify-center">
                    {contact.profilePictureUrl ? (
                      <img 
                        src={contact.profilePictureUrl} 
                        alt={contact.name}
                        className="h-12 w-12 rounded-full object-cover"
                      />
                    ) : (
                      <span className="text-orange-600 font-semibold text-lg">
                        {contact.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>

                  {/* Informações do contato */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-lg">{contact.name}</h3>
                      {!contact.isActive && (
                        <Badge variant="secondary">Inativo</Badge>
                      )}
                    </div>
                    <p className="text-gray-600">{contact.phoneNumber}</p>
                    {contact.email && (
                      <p className="text-gray-500 text-sm">{contact.email}</p>
                    )}
                    
                    {/* Tags e Origem */}
                    <div className="flex gap-2 mt-2">
                      {contact.tag && (
                        <Badge variant="outline" className="text-xs">
                          <Tag className="h-3 w-3 mr-1" />
                          {contact.tag}
                        </Badge>
                      )}
                      {contact.origem && (
                        <Badge variant="outline" className="text-xs">
                          {contact.origem}
                        </Badge>
                      )}
                    </div>

                    {/* Observação */}
                    {contact.observation && (
                      <p className="text-gray-500 text-sm mt-1 italic">
                        {contact.observation}
                      </p>
                    )}
                  </div>
                </div>

                {/* Ações */}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openWhatsAppChat(contact.phoneNumber)}
                  >
                    <MessageCircle className="h-4 w-4" />
                  </Button>
                  
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEditContact(contact)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>Editar Contato</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label>Nome</Label>
                          <Input
                            value={editForm.name}
                            onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                          />
                        </div>
                        <div>
                          <Label>Telefone</Label>
                          <Input
                            value={editForm.phoneNumber}
                            onChange={(e) => setEditForm({...editForm, phoneNumber: e.target.value})}
                          />
                        </div>
                        <div>
                          <Label>Email</Label>
                          <Input
                            value={editForm.email}
                            onChange={(e) => setEditForm({...editForm, email: e.target.value})}
                          />
                        </div>
                        <div>
                          <Label>Tag</Label>
                          <Input
                            value={editForm.tag}
                            onChange={(e) => setEditForm({...editForm, tag: e.target.value})}
                            placeholder="Ex: Cliente VIP, Lead..."
                          />
                        </div>
                        <div>
                          <Label>Origem</Label>
                          <Input
                            value={editForm.origem}
                            onChange={(e) => setEditForm({...editForm, origem: e.target.value})}
                            placeholder="Ex: Site, Instagram, Indicação..."
                          />
                        </div>
                        <div>
                          <Label>Observação</Label>
                          <Textarea
                            value={editForm.observation}
                            onChange={(e) => setEditForm({...editForm, observation: e.target.value})}
                            placeholder="Anotações sobre o contato..."
                          />
                        </div>
                        <Button onClick={handleSaveContact} className="w-full">
                          <Save className="h-4 w-4 mr-2" />
                          Salvar Alterações
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredContacts.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Nenhum contato encontrado
            </h3>
            <p className="text-gray-600">
              Tente ajustar os filtros ou adicionar novos contatos.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}