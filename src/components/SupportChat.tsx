import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { 
  enviarMensajeSoporte, 
  escucharMensajesSoporte, 
  escucharChatsActivos, 
  marcarChatComoLeido, 
  finalizarChatSoporte,
  registrarPresenciaAdmin,
  SupportMessage,
  SupportChatMetadata
} from '@/lib/rtdb';
import { 
  MessageCircle, 
  X, 
  Send, 
  User, 
  ShieldAlert, 
  Check, 
  CheckCheck,
  MessageSquare,
  Search,
  CheckSquare,
  AlertCircle,
  Paperclip,
  Camera
} from 'lucide-react';

export default function SupportChat() {
  const { user, dbUser, getIdToken } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [activeChats, setActiveChats] = useState<(SupportChatMetadata & { userId: string })[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<(SupportMessage & { id: string })[]>([]);
  const [inputText, setInputText] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [usersList, setUsersList] = useState<any[]>([]);
  const [showUserSelect, setShowUserSelect] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const adminFileRef = useRef<HTMLInputElement>(null);
  const userFileRef = useRef<HTMLInputElement>(null);
  
  const isAdmin = dbUser?.rol === 'SUPER_ADMIN' || dbUser?.rol === 'ADMINISTRADOR' || dbUser?.rol === 'OPERADOR';
  const myUserId = user?.uid || '';
  const myName = dbUser?.nombre || user?.email?.split('@')[0] || 'Vecino';
  const myEmail = dbUser?.email || user?.email || '';

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setAttachedImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
            setAttachedImage(reader.result as string);
          };
          reader.readAsDataURL(file);
        }
        e.preventDefault();
        break;
      }
    }
  };

  const fetchUsers = async () => {
    if (!isAdmin) return;
    setLoadingUsers(true);
    try {
      const token = await getIdToken();
      const res = await fetch('/api/usuarios', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUsersList(data.filter((u: any) => u.firebaseUid !== myUserId && u.rol !== 'PENDIENTE'));
      }
    } catch (err) {
      console.error('Error fetching users for chat:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  // Load users list on mount if admin
  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
    }
  }, [isAdmin]);

  // Listen to global error reporting event
  useEffect(() => {
    const handleReportEvent = (e: Event) => {
      const customEvent = e as CustomEvent;
      const section = customEvent.detail?.section || 'Plataforma GIS';
      setIsOpen(true);
      setInputText(`⚠️ [Reporte de Inconveniente]\n- Pantalla: ${section}\n- Inconveniente: `);
      
      // Auto focus input
      setTimeout(() => {
        const inputEl = document.querySelector('input[placeholder*="Escribe"]') as HTMLInputElement;
        inputEl?.focus();
      }, 300);
    };

    window.addEventListener('gis-reportar-error', handleReportEvent);
    return () => window.removeEventListener('gis-reportar-error', handleReportEvent);
  }, []);

  // Register admin presence for security rules
  useEffect(() => {
    if (myUserId) {
      registrarPresenciaAdmin(myUserId, isAdmin).catch(err => 
        console.error('Error registering admin presence:', err)
      );
    }
  }, [myUserId, isAdmin]);

  // 1. Listen for active chats (only if user is admin)
  useEffect(() => {
    if (!isAdmin) return;
    const unsub = escucharChatsActivos((chats) => {
      setActiveChats(chats);
      // Auto-select first chat if none selected and chats exist
      if (chats.length > 0 && !selectedUserId) {
        // Find if there's any unread chat or just choose the first
        const unread = chats.find(c => c.unreadByAdmin);
        setSelectedUserId(unread ? unread.userId : chats[0].userId);
      }
    });
    return unsub;
  }, [isAdmin, selectedUserId]);

  // 2. Listen for messages in the active chat session
  useEffect(() => {
    const targetId = isAdmin ? selectedUserId : myUserId;
    if (!targetId) return;

    const unsub = escucharMensajesSoporte(targetId, (msgs) => {
      setMessages(msgs);
      // Mark as read when active
      if (isOpen) {
        marcarChatComoLeido(targetId, isAdmin);
      }
    });
    return unsub;
  }, [selectedUserId, myUserId, isAdmin, isOpen]);

  // Mark as read when opening chat
  useEffect(() => {
    if (isOpen) {
      const targetId = isAdmin ? selectedUserId : myUserId;
      if (targetId) {
        marcarChatComoLeido(targetId, isAdmin);
      }
    }
  }, [isOpen, selectedUserId, myUserId, isAdmin]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() && !attachedImage) return;

    const targetId = isAdmin ? selectedUserId : myUserId;
    if (!targetId) return;

    const currentText = inputText.trim();
    const currentImage = attachedImage;

    try {
      // 1. Send to RTDB (Realtime UI updates)
      await enviarMensajeSoporte(
        targetId,
        {
          senderId: myUserId,
          senderName: myName,
          senderRole: dbUser?.rol || 'VECINO',
          text: currentText,
          ...(currentImage ? { image: currentImage } : {})
        },
        {
          nombre: isAdmin && selectedUserId 
            ? (activeChats.find(c => c.userId === selectedUserId)?.userName || 
               usersList.find(u => u.firebaseUid === selectedUserId)?.nombre || 
               usersList.find(u => u.firebaseUid === selectedUserId)?.email?.split('@')[0] || 
               'Usuario')
            : myName,
          email: isAdmin && selectedUserId 
            ? (activeChats.find(c => c.userId === selectedUserId)?.userEmail || 
               usersList.find(u => u.firebaseUid === selectedUserId)?.email || 
               '')
            : myEmail,
          isUserAdmin: isAdmin
        }
      );

      // 2. Mirror/Persist to PostgreSQL (Prisma)
      const token = await getIdToken();
      fetch('/api/soporte/mensaje', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          userId: targetId,
          text: currentText,
          image: currentImage,
          senderId: myUserId,
          senderName: myName,
          senderRole: dbUser?.rol || 'VECINO'
        })
      }).catch(err => console.error('Error syncing message to Postgres:', err));

      setInputText('');
      setAttachedImage(null);
    } catch (err) {
      console.error('Error sending message:', err);
    }
  };

  const handleCloseChat = async (userId: string) => {
    try {
      // 1. Finalize in RTDB
      await finalizarChatSoporte(userId);

      // 2. Finalize in PostgreSQL
      const token = await getIdToken();
      fetch('/api/soporte/finalizar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ userId })
      }).catch(err => console.error('Error finishing chat session in Postgres:', err));

      if (selectedUserId === userId) {
        setSelectedUserId(null);
        setMessages([]);
      }
    } catch (err) {
      console.error('Error closing chat:', err);
    }
  };

  // Compute unread count for badge
  const unreadCount = isAdmin 
    ? activeChats.filter(c => c.unreadByAdmin).length
    : messages.filter(m => m.senderId !== myUserId && m.senderRole !== 'VECINO').length; // simple logic for users

  const filteredChats = activeChats.filter(c => 
    (c.userName || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    (c.userEmail || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <>
      {/* Floating Action Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'fixed',
          bottom: '85px',
          right: '24px',
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: isAdmin ? 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          color: 'white',
          border: 'none',
          cursor: 'pointer',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          outline: 'none'
        }}
        onMouseEnter={e => {
          e.currentTarget.style.transform = 'scale(1.08) translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.35)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = 'scale(1) translateY(0)';
          e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.25)';
        }}
      >
        {isOpen ? <X size={24} /> : <MessageCircle size={24} />}
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: '-4px',
            right: '-4px',
            background: '#ef4444',
            color: 'white',
            borderRadius: '50%',
            minWidth: '20px',
            height: '20px',
            padding: '0 5px',
            fontSize: '11px',
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 0 2px white',
            fontFamily: 'sans-serif'
          }}>
            {unreadCount}
          </span>
        )}
      </button>

      {/* Chat Window Modal */}
      {isOpen && (
        <div style={{
          position: 'fixed',
          bottom: '155px',
          right: '24px',
          width: isAdmin ? '680px' : '380px',
          maxWidth: 'calc(100vw - 48px)',
          height: '520px',
          borderRadius: '20px',
          background: 'white',
          boxShadow: '0 12px 40px rgba(15, 23, 42, 0.18)',
          border: '1px solid #e2e8f0',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 9998,
          overflow: 'hidden',
          animation: 'chat-fade-in 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          fontFamily: "'Outfit', 'Inter', sans-serif"
        }}>
          {isAdmin ? (
            /* =========================================================================
               ADMIN CONSOLE VIEW
               ========================================================================= */
            <div style={{ display: 'flex', height: '100%', width: '100%' }}>
              
              {/* Left Column: Chat Sessions List */}
              <div style={{ width: '260px', borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', background: '#f8fafc' }}>
                <div style={{ padding: '16px 14px', borderBottom: '1px solid #e2e8f0', background: '#fff' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <h3 style={{ margin: 0, fontSize: '12px', fontWeight: 800, color: '#0f172a', letterSpacing: '0.3px', textTransform: 'uppercase' }}>
                      {showUserSelect ? 'Iniciar Chat' : 'Soporte'}
                    </h3>
                    <button 
                      onClick={() => {
                        setShowUserSelect(!showUserSelect);
                        setSearchTerm('');
                        if (!showUserSelect) fetchUsers();
                      }}
                      style={{
                        background: showUserSelect ? '#64748b' : '#2563eb',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '3px 8px',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      {showUserSelect ? 'Volver' : '+ Nuevo'}
                    </button>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input 
                      placeholder={showUserSelect ? "Buscar usuario..." : "Buscar chat..."} 
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '6px 10px 6px 30px',
                        fontSize: '12px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>

                {/* Left Column Content: Users select or Active chats */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '6px' }}>
                  {showUserSelect ? (
                    loadingUsers ? (
                      <div style={{ textAlign: 'center', padding: '20px 10px', color: '#94a3b8', fontSize: '11px' }}>
                        Cargando usuarios...
                      </div>
                    ) : (
                      usersList
                        .filter(u => 
                          (u.nombre || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                          u.email.toLowerCase().includes(searchTerm.toLowerCase())
                        )
                        .map(u => (
                          <div 
                            key={u.id}
                            onClick={() => {
                              setSelectedUserId(u.firebaseUid);
                              setMessages([]);
                              setShowUserSelect(false);
                              setSearchTerm('');
                            }}
                            style={{
                              padding: '10px 12px',
                              borderRadius: '12px',
                              cursor: 'pointer',
                              border: '1px solid transparent',
                              marginBottom: '4px',
                              transition: 'all 0.15s ease'
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                          >
                            <div style={{ fontSize: '12px', fontWeight: 800, color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {u.nombre || u.email.split('@')[0]}
                            </div>
                            <div style={{ fontSize: '10px', color: '#64748b' }}>
                              {u.email} · <span style={{ fontWeight: 700, color: '#0ea5e9', fontSize: '9px' }}>{u.rol}</span>
                            </div>
                          </div>
                        ))
                    )
                  ) : (
                    filteredChats.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '30px 10px', color: '#94a3b8', fontSize: '12px' }}>
                        <AlertCircle size={20} style={{ margin: '0 auto 8px', color: '#cbd5e1' }} />
                        No hay chats activos
                      </div>
                    ) : (
                      filteredChats.map(c => {
                        const isSelected = selectedUserId === c.userId;
                        return (
                          <div 
                            key={c.userId}
                            onClick={() => setSelectedUserId(c.userId)}
                            style={{
                              padding: '10px 12px',
                              borderRadius: '12px',
                              cursor: 'pointer',
                              background: isSelected ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
                              border: isSelected ? '1px solid rgba(59, 130, 246, 0.15)' : '1px solid transparent',
                              marginBottom: '4px',
                              transition: 'all 0.15s ease',
                              position: 'relative'
                            }}
                            onMouseEnter={e => { if(!isSelected) e.currentTarget.style.background = '#f1f5f9'; }}
                            onMouseLeave={e => { if(!isSelected) e.currentTarget.style.background = 'transparent'; }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                              <span style={{ fontSize: '12px', fontWeight: 800, color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }}>
                                 {usersList.find(u => u.firebaseUid === c.userId)?.nombre || 
                                  usersList.find(u => u.firebaseUid === c.userId)?.email?.split('@')[0] || 
                                  c.userName || 
                                  'Usuario'}
                              </span>
                              {c.unreadByAdmin && (
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', flexShrink: 0 }} />
                              )}
                            </div>
                            <div style={{ fontSize: '10px', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {c.lastMessage}
                            </div>
                          </div>
                        );
                      })
                    )
                  )}
                </div>
              </div>

              {/* Right Column: Chat Room */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                {selectedUserId ? (
                  <>
                    {/* Chat Room Header */}
                    <div style={{ 
                      padding: '12px 18px', 
                      borderBottom: '1px solid #e2e8f0', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between',
                      background: '#fff'
                    }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e' }} />
                          <strong style={{ fontSize: '13px', color: '#1e293b' }}>
                            {activeChats.find(c => c.userId === selectedUserId)?.userName || 
                             usersList.find(u => u.firebaseUid === selectedUserId)?.nombre || 
                             usersList.find(u => u.firebaseUid === selectedUserId)?.email?.split('@')[0] || 
                             'Usuario'}
                          </strong>
                        </div>
                        <span style={{ fontSize: '10px', color: '#64748b', display: 'block', marginTop: '2px' }}>
                          {activeChats.find(c => c.userId === selectedUserId)?.userEmail || 
                           usersList.find(u => u.firebaseUid === selectedUserId)?.email || 
                           ''}
                        </span>
                      </div>
                      <button 
                        onClick={() => handleCloseChat(selectedUserId)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '4px 10px',
                          borderRadius: '8px',
                          border: '1.5px solid #bfdbfe',
                          background: '#eff6ff',
                          color: '#1d4ed8',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#dbeafe'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#eff6ff'; }}
                      >
                        <CheckSquare size={12} />
                        Marcar Resuelto
                      </button>
                    </div>

                    {/* Messages Area */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '16px', background: '#f1f5f9', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {messages.map((m) => {
                        const isMe = m.senderId === myUserId;
                        return (
                          <div 
                            key={m.id}
                            style={{
                              alignSelf: isMe ? 'flex-end' : 'flex-start',
                              maxWidth: '75%',
                              background: isMe ? '#2563eb' : '#fff',
                              color: isMe ? '#fff' : '#1e293b',
                              padding: '8px 12px',
                              borderRadius: isMe ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                              boxShadow: '0 1px 2px rgba(15, 23, 42, 0.05)',
                              fontSize: '12px',
                              lineHeight: '1.4'
                            }}
                          >
                            {!isMe && (
                              <div style={{ fontSize: '9px', fontWeight: 800, color: '#6366f1', marginBottom: '2px' }}>
                                {m.senderName} ({m.senderRole})
                              </div>
                            )}
                            {m.text && <div>{m.text}</div>}
                            {m.image && (
                              <img 
                                src={m.image} 
                                alt="Adjunto" 
                                onClick={() => setLightboxImage(m.image || null)}
                                style={{ 
                                  maxWidth: '100%', 
                                  borderRadius: '8px', 
                                  marginTop: '4px', 
                                  cursor: 'pointer',
                                  boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                                  display: 'block'
                                }} 
                              />
                            )}
                            <div style={{ 
                              fontSize: '8px', 
                              textAlign: 'right', 
                              marginTop: '3px', 
                              color: isMe ? 'rgba(255,255,255,0.7)' : '#94a3b8' 
                            }}>
                              {m.timestamp ? new Date(Number(m.timestamp)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                            </div>
                          </div>
                        );
                      })}
                      <div ref={messagesEndRef} />
                    </div>

                    {/* Input Bar */}
                    {attachedImage && (
                      <div style={{ position: 'relative', padding: '8px 12px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <img src={attachedImage} alt="Preview" style={{ height: '40px', borderRadius: '6px', objectFit: 'cover' }} />
                        <span style={{ fontSize: '11px', color: '#64748b' }}>Imagen adjunta lista para enviar (Ctrl+V para pegar otra)</span>
                        <button 
                          type="button" 
                          onClick={() => setAttachedImage(null)} 
                          style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                        >
                          <X size={16} />
                        </button>
                      </div>
                    )}
                    <form onSubmit={handleSendMessage} style={{ padding: '12px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '8px', background: '#fff', alignItems: 'center' }}>
                      <input 
                        type="file" 
                        ref={adminFileRef} 
                        onChange={handleImageChange} 
                        style={{ display: 'none' }} 
                        accept="image/*" 
                      />
                      <button 
                        type="button" 
                        onClick={() => adminFileRef.current?.click()}
                        style={{ 
                          background: 'none', 
                          border: 'none', 
                          color: '#64748b', 
                          cursor: 'pointer', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          padding: '8px',
                          borderRadius: '8px',
                          transition: 'background 0.15s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                        onMouseLeave={e => e.currentTarget.style.background = 'none'}
                      >
                        <Paperclip size={18} />
                      </button>
                      <input 
                        type="text"
                        value={inputText}
                        onChange={e => setInputText(e.target.value)}
                        onPaste={handlePaste}
                        placeholder="Escribe tu respuesta... (Ctrl+V para pegar imagen)"
                        style={{
                          flex: 1,
                          padding: '10px 14px',
                          borderRadius: '10px',
                          border: '1px solid #cbd5e1',
                          outline: 'none',
                          fontSize: '13px',
                          background: '#f8fafc'
                        }}
                      />
                      <button 
                        type="submit"
                        style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: '10px',
                          background: '#1d4ed8',
                          color: 'white',
                          border: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#1e40af'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#1d4ed8'; }}
                      >
                        <Send size={16} />
                      </button>
                    </form>
                  </>
                ) : (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px', color: '#94a3b8', background: '#f8fafc' }}>
                    <MessageSquare size={36} style={{ color: '#cbd5e1', marginBottom: '12px' }} />
                    <p style={{ margin: 0, fontSize: '13px', fontWeight: 600 }}>No hay chat seleccionado</p>
                    <p style={{ margin: '4px 0 0', fontSize: '11px', textAlign: 'center' }}>Selecciona una consulta activa de la lista de la izquierda para responder.</p>
                  </div>
                )}
              </div>

            </div>
          ) : (
            /* =========================================================================
               USER SUPPORT VIEW
               ========================================================================= */
            <>
              {/* Header */}
              <div style={{
                padding: '14px 20px',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: '0 2px 10px rgba(0,0,0,0.05)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <User size={16} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 800 }}>Soporte GIS Lanús</h3>
                    <span style={{ fontSize: '10px', opacity: 0.85, display: 'flex', alignItems: 'center', gap: '4px', marginTop: '1px' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
                      Operadores en línea
                    </span>
                  </div>
                </div>
                <button 
                  onClick={() => setIsOpen(false)}
                  style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', opacity: 0.85 }}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Messages List */}
              <div style={{
                flex: 1,
                background: '#efeae2', // Whatsapp like background
                padding: '16px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}>
                {messages.length === 0 ? (
                  <div style={{ 
                    alignSelf: 'center',
                    background: '#e1f5fe',
                    color: '#01579b',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    fontSize: '11px',
                    lineHeight: '1.4',
                    maxWidth: '85%',
                    textAlign: 'center',
                    marginTop: '20px',
                    border: '1px solid #b3e5fc'
                  }}>
                    👋 ¡Hola! Escribe tu consulta abajo y un operador de soporte técnico te responderá en breve.
                  </div>
                ) : (
                  messages.map(m => {
                    const isMe = m.senderId === myUserId;
                    return (
                      <div 
                        key={m.id}
                        style={{
                          alignSelf: isMe ? 'flex-end' : 'flex-start',
                          maxWidth: '75%',
                          background: isMe ? '#dcf8c6' : '#fff',
                          color: '#1e293b',
                          padding: '8px 12px',
                          borderRadius: isMe ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                          boxShadow: '0 1px 2px rgba(15, 23, 42, 0.08)',
                          fontSize: '12.5px',
                          lineHeight: '1.4'
                        }}
                      >
                        {!isMe && (
                          <div style={{ fontSize: '9px', fontWeight: 800, color: '#059669', marginBottom: '2px' }}>
                            Soporte Técnico ({m.senderName})
                          </div>
                        )}
                        {m.text && <div>{m.text}</div>}
                        {m.image && (
                          <img 
                            src={m.image} 
                            alt="Adjunto" 
                            onClick={() => setLightboxImage(m.image || null)}
                            style={{ 
                              maxWidth: '100%', 
                              borderRadius: '8px', 
                              marginTop: '4px', 
                              cursor: 'pointer',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                              display: 'block'
                            }} 
                          />
                        )}
                        <div style={{ 
                          fontSize: '8px', 
                          textAlign: 'right', 
                          marginTop: '3px', 
                          color: '#8b9396',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          gap: '2px'
                        }}>
                          {m.timestamp ? new Date(Number(m.timestamp)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                          {isMe && <CheckCheck size={10} style={{ color: '#4fc3f7' }} />}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Bar */}
              {attachedImage && (
                <div style={{ position: 'relative', padding: '8px 12px', borderTop: '1px solid #e2e8f0', background: '#e2f0d9', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <img src={attachedImage} alt="Preview" style={{ height: '40px', borderRadius: '6px', objectFit: 'cover' }} />
                  <span style={{ fontSize: '11px', color: '#3c763d' }}>Imagen adjunta lista para enviar (Ctrl+V para pegar otra)</span>
                  <button 
                    type="button" 
                    onClick={() => setAttachedImage(null)} 
                    style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#a94442', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
              <form onSubmit={handleSendMessage} style={{
                padding: '10px 14px',
                background: '#f0f0f0',
                display: 'flex',
                gap: '8px',
                alignItems: 'center'
              }}>
                <input 
                  type="file" 
                  ref={userFileRef} 
                  onChange={handleImageChange} 
                  style={{ display: 'none' }} 
                  accept="image/*" 
                />
                <button 
                  type="button" 
                  onClick={() => userFileRef.current?.click()}
                  style={{ 
                    background: 'none', 
                    border: 'none', 
                    color: '#64748b', 
                    cursor: 'pointer', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    padding: '6px',
                    borderRadius: '50%',
                    transition: 'background 0.15s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#e0e0e0'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                >
                  <Paperclip size={18} />
                </button>
                <input 
                  type="text"
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  onPaste={handlePaste}
                  placeholder="Escribe un mensaje... (Ctrl+V para pegar imagen)"
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    borderRadius: '20px',
                    border: 'none',
                    outline: 'none',
                    fontSize: '13px',
                    background: '#fff',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                  }}
                />
                <button 
                  type="submit"
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '50%',
                    background: '#075e54',
                    color: 'white',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#128c7e'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#075e54'; }}
                >
                  <Send size={16} style={{ marginLeft: '2px' }} />
                </button>
              </form>
            </>
          )}
        </div>
      )}

      {/* Lightbox Modal for viewing screenshots */}
      {lightboxImage && (
        <div 
          onClick={() => setLightboxImage(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(15, 23, 42, 0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100000,
            cursor: 'zoom-out'
          }}
        >
          <img 
            src={lightboxImage} 
            alt="Fullscreen Screenshot" 
            style={{ maxWidth: '90%', maxHeight: '90%', borderRadius: '12px', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }} 
          />
          <button 
            onClick={() => setLightboxImage(null)}
            style={{ position: 'absolute', top: '24px', right: '24px', color: 'white', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <X size={32} />
          </button>
        </div>
      )}

      {/* Global CSS for Animations */}
      <style jsx global>{`
        @keyframes chat-fade-in {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(10px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
      `}</style>
    </>
  );
}
