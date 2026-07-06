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
  ShieldAlert,
  CheckCheck,
  MessageSquare,
  Search,
  CheckSquare,
  AlertCircle,
  Paperclip,
  Headphones,
  Loader2
} from 'lucide-react';

export default function SupportChat() {
  const { user, dbUser, getIdToken } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [activeChats, setActiveChats] = useState<(SupportChatMetadata & { userId: string })[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<(SupportMessage & { id: string })[]>([]);
  const [inputText, setInputText] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isSending, setIsSending] = useState(false);

  const [usersList, setUsersList] = useState<any[]>([]);
  const [showUserSelect, setShowUserSelect] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const adminFileRef = useRef<HTMLInputElement>(null);
  const userFileRef = useRef<HTMLInputElement>(null);
  const prevMsgCountRef = useRef<number>(0);
  const lastSeenTimestampRef = useRef<number>(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isAdmin = dbUser?.rol === 'SUPER_ADMIN' || dbUser?.rol === 'ADMINISTRADOR' || dbUser?.rol === 'OPERADOR';
  const myUserId = user?.uid || '';
  const myName = dbUser?.nombre || user?.email?.split('@')[0] || 'Vecino';
  const myEmail = dbUser?.email || user?.email || '';

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setAttachedImage(reader.result as string);
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
          reader.onloadend = () => setAttachedImage(reader.result as string);
          reader.readAsDataURL(file);
        }
        e.preventDefault();
        break;
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e as any);
    }
  };

  const fetchUsers = async () => {
    if (!isAdmin) return;
    setLoadingUsers(true);
    try {
      const token = await getIdToken();
      const res = await fetch('/api/usuarios', { headers: { Authorization: `Bearer ${token}` } });
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

  useEffect(() => {
    if (isAdmin) fetchUsers();
  }, [isAdmin]);

  useEffect(() => {
    const handleReportEvent = (e: Event) => {
      const customEvent = e as CustomEvent;
      const section = customEvent.detail?.section || 'Plataforma GIS';
      setIsOpen(true);
      setInputText(`[Reporte de Inconveniente]\nPantalla: ${section}\nInconveniente: `);
      setTimeout(() => textareaRef.current?.focus(), 300);
    };
    window.addEventListener('gis-reportar-error', handleReportEvent);
    return () => window.removeEventListener('gis-reportar-error', handleReportEvent);
  }, []);

  useEffect(() => {
    if (myUserId) {
      registrarPresenciaAdmin(myUserId, isAdmin).catch(err =>
        console.error('Error registering admin presence:', err)
      );
    }
  }, [myUserId, isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    const unsub = escucharChatsActivos((chats) => {
      setActiveChats(chats);
      if (chats.length > 0 && !selectedUserId) {
        const unread = chats.find(c => c.unreadByAdmin);
        setSelectedUserId(unread ? unread.userId : chats[0].userId);
      }
    });
    return unsub;
  }, [isAdmin, selectedUserId]);

  useEffect(() => {
    const targetId = isAdmin ? selectedUserId : myUserId;
    if (!targetId) return;
    const unsub = escucharMensajesSoporte(targetId, (msgs) => {
      setMessages(msgs);
      if (isOpen) {
        marcarChatComoLeido(targetId, isAdmin);
        if (msgs.length > 0) {
          const last = msgs[msgs.length - 1];
          lastSeenTimestampRef.current = Number(last.timestamp) || Date.now();
        }
      }
    });
    return unsub;
  }, [selectedUserId, myUserId, isAdmin, isOpen]);

  useEffect(() => {
    if (isOpen) {
      const targetId = isAdmin ? selectedUserId : myUserId;
      if (targetId) {
        marcarChatComoLeido(targetId, isAdmin);
        if (messages.length > 0) {
          const last = messages[messages.length - 1];
          lastSeenTimestampRef.current = Number(last.timestamp) || Date.now();
        }
      }
      setTimeout(() => textareaRef.current?.focus(), 200);
    }
  }, [isOpen, selectedUserId, myUserId, isAdmin]);

  // Request notification permission
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Browser notification on new incoming message
  useEffect(() => {
    const prev = prevMsgCountRef.current;
    const curr = messages.length;
    prevMsgCountRef.current = curr;

    if (prev === 0 || curr <= prev) return;

    const newMsgs = messages.slice(prev);
    const incoming = newMsgs.filter(m => m.senderId !== myUserId);
    if (incoming.length === 0) return;
    if (isOpen && !document.hidden) return;

    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      const last = incoming[incoming.length - 1];
      const title = isAdmin ? `Nuevo mensaje de ${last.senderName || 'Usuario'}` : 'Nuevo mensaje de Soporte';
      const body = last.text || (last.image ? 'Imagen adjunta' : 'Mensaje nuevo');
      const n = new Notification(title, { body, icon: '/logo-lanus.png', tag: 'soporte-chat', renotify: true } as any);
      n.onclick = () => { window.focus(); setIsOpen(true); n.close(); };
    }
  }, [messages, myUserId, isAdmin, isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 100) + 'px';
  }, [inputText]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() && !attachedImage) return;
    const targetId = isAdmin ? selectedUserId : myUserId;
    if (!targetId) return;

    const currentText = inputText.trim();
    const currentImage = attachedImage;
    setInputText('');
    setAttachedImage(null);
    setIsSending(true);

    try {
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
               usersList.find(u => u.firebaseUid === selectedUserId)?.email || '')
            : myEmail,
          isUserAdmin: isAdmin
        }
      );

      const token = await getIdToken();
      fetch('/api/soporte/mensaje', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ userId: targetId, text: currentText, image: currentImage, senderId: myUserId, senderName: myName, senderRole: dbUser?.rol || 'VECINO' })
      }).catch(err => console.error('Error syncing to Postgres:', err));
    } catch (err) {
      console.error('Error sending message:', err);
      setInputText(currentText);
    } finally {
      setIsSending(false);
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  };

  const handleCloseChat = async (userId: string) => {
    try {
      await finalizarChatSoporte(userId);
      const token = await getIdToken();
      fetch('/api/soporte/finalizar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ userId })
      }).catch(err => console.error('Error finishing chat in Postgres:', err));
      if (selectedUserId === userId) { setSelectedUserId(null); setMessages([]); }
    } catch (err) {
      console.error('Error closing chat:', err);
    }
  };

  // Unread for admin: chats with unreadByAdmin flag
  // Unread for user: messages from admin after lastSeenTimestamp
  const unreadCount = isAdmin
    ? activeChats.filter(c => c.unreadByAdmin).length
    : messages.filter(m => m.senderId !== myUserId && Number(m.timestamp) > lastSeenTimestampRef.current).length;

  const filteredChats = activeChats.filter(c =>
    (c.userName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.userEmail || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatTime = (ts: any) => {
    const d = new Date(Number(ts));
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const InputBar = ({ isAdminSide }: { isAdminSide: boolean }) => (
    <>
      {attachedImage && (
        <div style={{ padding: '8px 12px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <img src={attachedImage} alt="Preview" style={{ height: '40px', borderRadius: '6px', objectFit: 'cover' }} />
          <span style={{ fontSize: '11px', color: '#64748b', flex: 1 }}>Imagen lista · Ctrl+V para pegar otra</span>
          <button type="button" onClick={() => setAttachedImage(null)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex' }}>
            <X size={16} />
          </button>
        </div>
      )}
      <form onSubmit={handleSendMessage} style={{ padding: '10px 12px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '8px', background: '#fff', alignItems: 'flex-end' }}>
        <input type="file" ref={isAdminSide ? adminFileRef : userFileRef} onChange={handleImageChange} style={{ display: 'none' }} accept="image/*" />
        <button
          type="button"
          onClick={() => (isAdminSide ? adminFileRef : userFileRef).current?.click()}
          style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '8px', borderRadius: '8px', flexShrink: 0, transition: 'color 0.15s' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#475569')}
          onMouseLeave={e => (e.currentTarget.style.color = '#94a3b8')}
        >
          <Paperclip size={17} />
        </button>
        <textarea
          ref={textareaRef}
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder="Escribe un mensaje… (Enter para enviar, Shift+Enter para nueva línea)"
          rows={1}
          style={{
            flex: 1,
            padding: '9px 13px',
            borderRadius: '10px',
            border: '1.5px solid #e2e8f0',
            outline: 'none',
            fontSize: '13px',
            background: '#f8fafc',
            resize: 'none',
            lineHeight: '1.4',
            maxHeight: '100px',
            overflowY: 'auto',
            fontFamily: 'inherit',
            transition: 'border-color 0.15s'
          }}
          onFocus={e => (e.currentTarget.style.borderColor = '#2563eb')}
          onBlur={e => (e.currentTarget.style.borderColor = '#e2e8f0')}
        />
        <button
          type="submit"
          disabled={isSending || (!inputText.trim() && !attachedImage)}
          style={{
            width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
            background: isSending || (!inputText.trim() && !attachedImage) ? '#e2e8f0' : 'linear-gradient(135deg,#2563eb,#1d4ed8)',
            color: isSending || (!inputText.trim() && !attachedImage) ? '#94a3b8' : 'white',
            border: 'none', cursor: isSending ? 'wait' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: (!inputText.trim() && !attachedImage) ? 'none' : '0 2px 8px rgba(37,99,235,0.3)',
            transition: 'all 0.15s'
          }}
        >
          {isSending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} style={{ marginLeft: '1px' }} />}
        </button>
      </form>
    </>
  );

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'fixed', bottom: '85px', right: '24px',
          width: '52px', height: '52px', borderRadius: '50%',
          background: isAdmin ? 'linear-gradient(135deg,#2563eb,#1d4ed8)' : 'linear-gradient(135deg,#2563eb,#1d4ed8)',
          color: 'white', border: 'none', cursor: 'pointer',
          boxShadow: '0 4px 16px rgba(37,99,235,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)', outline: 'none'
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08) translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(37,99,235,0.45)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1) translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(37,99,235,0.35)'; }}
      >
        {isOpen ? <X size={22} /> : <MessageCircle size={22} />}
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: '-3px', right: '-3px',
            background: '#ef4444', color: 'white', borderRadius: '50%',
            minWidth: '18px', height: '18px', padding: '0 4px',
            fontSize: '10px', fontWeight: 800,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 0 2px white', fontFamily: 'sans-serif'
          }}>
            {unreadCount}
          </span>
        )}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div style={{
          position: 'fixed', bottom: '150px', right: '24px',
          width: isAdmin ? '700px' : '370px',
          maxWidth: 'calc(100vw - 48px)',
          height: isAdmin ? '540px' : '500px',
          borderRadius: '18px',
          background: '#ffffff',
          boxShadow: '0 16px 48px rgba(15,23,42,0.16), 0 2px 8px rgba(15,23,42,0.06)',
          border: '1px solid rgba(226,232,240,0.8)',
          display: 'flex', flexDirection: 'column',
          zIndex: 9998, overflow: 'hidden',
          animation: 'chat-slide-up 0.22s cubic-bezier(0.16,1,0.3,1)',
          fontFamily: "'Inter', -apple-system, sans-serif"
        }}>
          {isAdmin ? (
            /* ── ADMIN CONSOLE ── */
            <div style={{ display: 'flex', height: '100%' }}>
              {/* Left: Sessions list */}
              <div style={{ width: '250px', borderRight: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', background: '#fafbfd' }}>
                <div style={{ padding: '13px 12px 10px', borderBottom: '1px solid #f1f5f9', background: '#fff' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <img src="/logo-lanus.png" alt="" style={{ width: 20, height: 20, objectFit: 'contain' }} />
                      <span style={{ fontSize: '11px', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        {showUserSelect ? 'Nuevo Chat' : 'Soporte'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        onClick={() => { setShowUserSelect(!showUserSelect); setSearchTerm(''); if (!showUserSelect) fetchUsers(); }}
                        style={{ background: showUserSelect ? '#f1f5f9' : '#eff6ff', color: showUserSelect ? '#64748b' : '#2563eb', border: 'none', borderRadius: '6px', padding: '3px 8px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                      >
                        {showUserSelect ? '← Volver' : '+ Nuevo'}
                      </button>
                      <button onClick={() => setIsOpen(false)} style={{ background: '#f1f5f9', border: 'none', borderRadius: '6px', padding: '3px 6px', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                        <X size={13} />
                      </button>
                    </div>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <Search size={12} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input
                      placeholder={showUserSelect ? 'Buscar usuario…' : 'Buscar chat…'}
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      style={{ width: '100%', padding: '6px 8px 6px 26px', fontSize: '12px', borderRadius: '8px', border: '1.5px solid #e2e8f0', outline: 'none', boxSizing: 'border-box', background: '#f8fafc' }}
                    />
                  </div>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '6px' }}>
                  {showUserSelect ? (
                    loadingUsers ? (
                      <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8', fontSize: '11px' }}>Cargando…</div>
                    ) : (
                      usersList
                        .filter(u => (u.nombre || '').toLowerCase().includes(searchTerm.toLowerCase()) || u.email.toLowerCase().includes(searchTerm.toLowerCase()))
                        .map(u => (
                          <div key={u.id} onClick={() => { setSelectedUserId(u.firebaseUid); setMessages([]); setShowUserSelect(false); setSearchTerm(''); }}
                            style={{ padding: '9px 10px', borderRadius: '10px', cursor: 'pointer', marginBottom: '2px', transition: 'background 0.12s' }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#f1f5f9')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                          >
                            <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.nombre || u.email.split('@')[0]}</div>
                            <div style={{ fontSize: '10px', color: '#64748b' }}>{u.email} · <span style={{ color: '#2563eb', fontWeight: 700 }}>{u.rol}</span></div>
                          </div>
                        ))
                    )
                  ) : (
                    filteredChats.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '28px 10px', color: '#94a3b8', fontSize: '12px' }}>
                        <AlertCircle size={18} style={{ margin: '0 auto 6px', color: '#cbd5e1' }} />
                        Sin chats activos
                      </div>
                    ) : (
                      filteredChats.map(c => {
                        const isSelected = selectedUserId === c.userId;
                        return (
                          <div key={c.userId} onClick={() => setSelectedUserId(c.userId)}
                            style={{ padding: '9px 10px', borderRadius: '10px', cursor: 'pointer', background: isSelected ? '#eff6ff' : 'transparent', border: isSelected ? '1px solid #bfdbfe' : '1px solid transparent', marginBottom: '2px', transition: 'all 0.12s' }}
                            onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#f1f5f9'; }}
                            onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <span style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }}>
                                {usersList.find(u => u.firebaseUid === c.userId)?.nombre ||
                                 usersList.find(u => u.firebaseUid === c.userId)?.email?.split('@')[0] ||
                                 c.userName || 'Usuario'}
                              </span>
                              {c.unreadByAdmin && <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#ef4444', flexShrink: 0 }} />}
                            </div>
                            <div style={{ fontSize: '10px', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>{c.lastMessage}</div>
                          </div>
                        );
                      })
                    )
                  )}
                </div>
              </div>

              {/* Right: Chat room */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                {selectedUserId ? (
                  <>
                    <div style={{ padding: '11px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', flexShrink: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg,#eff6ff,#dbeafe)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <span style={{ fontSize: 12, fontWeight: 800, color: '#2563eb' }}>
                            {(activeChats.find(c => c.userId === selectedUserId)?.userName || usersList.find(u => u.firebaseUid === selectedUserId)?.nombre || 'U')[0]?.toUpperCase()}
                          </span>
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {activeChats.find(c => c.userId === selectedUserId)?.userName ||
                             usersList.find(u => u.firebaseUid === selectedUserId)?.nombre ||
                             usersList.find(u => u.firebaseUid === selectedUserId)?.email?.split('@')[0] || 'Usuario'}
                          </div>
                          <div style={{ fontSize: '10px', color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }} />
                            En línea
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleCloseChat(selectedUserId)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: '8px', border: '1.5px solid #bfdbfe', background: '#eff6ff', color: '#1d4ed8', fontSize: '11px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s', flexShrink: 0 }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#dbeafe')}
                        onMouseLeave={e => (e.currentTarget.style.background = '#eff6ff')}
                      >
                        <CheckSquare size={12} /> Resolver
                      </button>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {messages.map((m, idx) => {
                        const isMe = m.senderId === myUserId;
                        const prevMsg = messages[idx - 1];
                        const showName = !isMe && (!prevMsg || prevMsg.senderId !== m.senderId);
                        return (
                          <div key={m.id} style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '78%' }}>
                            {showName && (
                              <div style={{ fontSize: '9px', fontWeight: 800, color: '#2563eb', marginBottom: 2, paddingLeft: 2 }}>{m.senderName} · {m.senderRole}</div>
                            )}
                            <div style={{ background: isMe ? 'linear-gradient(135deg,#2563eb,#1d4ed8)' : '#fff', color: isMe ? '#fff' : '#0f172a', padding: '8px 12px', borderRadius: isMe ? '14px 14px 2px 14px' : '14px 14px 14px 2px', boxShadow: '0 1px 3px rgba(15,23,42,0.06)', fontSize: '12.5px', lineHeight: '1.45', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                              {m.text && <div>{m.text}</div>}
                              {m.image && <img src={m.image} alt="Adjunto" onClick={() => setLightboxImage(m.image || null)} style={{ maxWidth: '100%', borderRadius: '8px', marginTop: m.text ? 6 : 0, cursor: 'pointer', display: 'block' }} />}
                              <div style={{ fontSize: '9px', textAlign: 'right', marginTop: 3, color: isMe ? 'rgba(255,255,255,0.65)' : '#94a3b8' }}>{formatTime(m.timestamp)}</div>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={messagesEndRef} />
                    </div>

                    <InputBar isAdminSide={true} />
                  </>
                ) : (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px', color: '#94a3b8', background: '#f8fafc' }}>
                    <MessageSquare size={32} style={{ color: '#cbd5e1', marginBottom: '10px' }} />
                    <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#64748b' }}>Sin chat seleccionado</p>
                    <p style={{ margin: '4px 0 0', fontSize: '11px', textAlign: 'center' }}>Seleccioná una consulta activa o iniciá una nueva.</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* ── USER VIEW ── */
            <>
              {/* Header */}
              <div style={{ height: 52, background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(10px)', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Headphones size={15} color="#fff" />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.2px' }}>Soporte GIS Lanús</div>
                    <div style={{ fontSize: 10, color: '#22c55e', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
                      Operadores en línea
                    </div>
                  </div>
                </div>
                <button onClick={() => setIsOpen(false)} style={{ background: '#f1f5f9', border: 'none', borderRadius: '8px', padding: '6px', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'background 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#e2e8f0')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#f1f5f9')}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Messages */}
              <div style={{ flex: 1, background: '#f1f5f9', padding: '14px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {messages.length === 0 ? (
                  <div style={{ alignSelf: 'center', background: '#fff', border: '1px solid #e2e8f0', color: '#475569', padding: '12px 16px', borderRadius: '12px', fontSize: '12px', lineHeight: '1.5', maxWidth: '88%', textAlign: 'center', marginTop: '16px', boxShadow: '0 1px 3px rgba(15,23,42,0.04)' }}>
                    <Headphones size={22} style={{ margin: '0 auto 8px', color: '#2563eb' }} />
                    <strong style={{ display: 'block', marginBottom: 4, color: '#0f172a' }}>¿Cómo podemos ayudarte?</strong>
                    Escribí tu consulta y un operador de soporte técnico te responderá en breve.
                  </div>
                ) : (
                  messages.map((m, idx) => {
                    const isMe = m.senderId === myUserId;
                    const prevMsg = messages[idx - 1];
                    const showLabel = !isMe && (!prevMsg || prevMsg.senderId !== m.senderId);
                    return (
                      <div key={m.id} style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
                        {showLabel && (
                          <div style={{ fontSize: '9px', fontWeight: 800, color: '#2563eb', marginBottom: 2, paddingLeft: 2 }}>Soporte Técnico</div>
                        )}
                        <div style={{ background: isMe ? 'linear-gradient(135deg,#2563eb,#1d4ed8)' : '#fff', color: isMe ? '#fff' : '#0f172a', padding: '8px 12px', borderRadius: isMe ? '14px 14px 2px 14px' : '14px 14px 14px 2px', boxShadow: '0 1px 3px rgba(15,23,42,0.06)', fontSize: '13px', lineHeight: '1.45', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                          {m.text && <div>{m.text}</div>}
                          {m.image && <img src={m.image} alt="Adjunto" onClick={() => setLightboxImage(m.image || null)} style={{ maxWidth: '100%', borderRadius: '8px', marginTop: m.text ? 6 : 0, cursor: 'pointer', display: 'block' }} />}
                          <div style={{ fontSize: '9px', textAlign: 'right', marginTop: 3, color: isMe ? 'rgba(255,255,255,0.65)' : '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3 }}>
                            {formatTime(m.timestamp)}
                            {isMe && <CheckCheck size={10} style={{ color: isMe ? 'rgba(255,255,255,0.7)' : '#94a3b8' }} />}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              <InputBar isAdminSide={false} />
            </>
          )}
        </div>
      )}

      {/* Lightbox */}
      {lightboxImage && (
        <div onClick={() => setLightboxImage(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100000, cursor: 'zoom-out' }}>
          <img src={lightboxImage} alt="Fullscreen" style={{ maxWidth: '90%', maxHeight: '90%', borderRadius: '12px', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }} />
          <button onClick={() => setLightboxImage(null)} style={{ position: 'absolute', top: 20, right: 20, color: 'white', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: 40, height: 40, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={20} />
          </button>
        </div>
      )}

      <style jsx global>{`
        @keyframes chat-slide-up {
          from { opacity: 0; transform: translateY(12px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </>
  );
}
