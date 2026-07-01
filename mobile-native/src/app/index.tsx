import React, { useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  ScrollView, 
  TextInput, 
  Modal, 
  Dimensions, 
  SafeAreaView, 
  Alert,
  Switch,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Mock Initial Requests List
const INITIAL_ROUTES = [
  {
    id: 'TRP-8419',
    patente: 'AA 741 BB',
    chofer: 'Gómez Martín',
    tipoVehiculo: 'Semirremolque',
    peso: '28 Toneladas',
    cargaPeligrosa: false,
    origen: 'Av. Pavón (Límite Avellaneda)',
    destino: 'Parque Industrial Lanús',
    estado: 'APROBADA',
    fecha: '2026-06-30',
    puntos: [{ x: 50, y: 80 }, { x: 120, y: 150 }, { x: 180, y: 220 }]
  },
  {
    id: 'TRP-7023',
    patente: 'FJZ 852',
    chofer: 'Rodríguez Juan',
    tipoVehiculo: 'Chasis c/ Acoplado',
    peso: '34 Toneladas',
    cargaPeligrosa: true,
    origen: 'Acceso Camino Negro',
    destino: 'Distribuidora Lanús Este',
    estado: 'PENDIENTE',
    fecha: '2026-07-01',
    puntos: [{ x: 80, y: 240 }, { x: 190, y: 140 }]
  },
  {
    id: 'TRP-9154',
    patente: 'AB 963 CC',
    chofer: 'López Carlos',
    tipoVehiculo: 'Mosquito (Portacoches)',
    peso: '22 Toneladas',
    cargaPeligrosa: false,
    origen: 'Puente Alsina',
    destino: 'Concesionaria Yrigoyen',
    estado: 'RECHAZADA',
    fecha: '2026-06-29',
    puntos: [{ x: 220, y: 60 }, { x: 140, y: 180 }]
  }
];

export default function HomeScreen() {
  const [user, setUser] = useState<{ nombre: string; rol: 'CHOFER' | 'INSPECTOR' } | null>(null);
  const [activeTab, setActiveTab] = useState<'home' | 'requests' | 'new_request' | 'scan'>('home');
  const [routes, setRoutes] = useState(INITIAL_ROUTES);
  const [selectedRoute, setSelectedRoute] = useState<typeof INITIAL_ROUTES[0] | null>(null);
  
  // New Request State
  const [patente, setPatente] = useState('');
  const [tipoVehiculo, setTipoVehiculo] = useState('Semirremolque');
  const [peso, setPeso] = useState('28 Toneladas');
  const [cargaPeligrosa, setCargaPeligrosa] = useState(false);
  const [routePoints, setRoutePoints] = useState<{ x: number; y: number }[]>([]);

  // QR Scanning Simulator State
  const [scanResult, setScanResult] = useState<typeof INITIAL_ROUTES[0] | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isInvalidScan, setIsInvalidScan] = useState(false);

  const handleMapPress = (event: any) => {
    const { locationX, locationY } = event.nativeEvent;
    setRoutePoints([...routePoints, { x: Math.round(locationX), y: Math.round(locationY) }]);
  };

  const handleClearMap = () => {
    setRoutePoints([]);
  };

  const handleAddRequest = () => {
    if (!patente) {
      Alert.alert('Error', 'Por favor ingrese la patente del vehículo.');
      return;
    }
    if (routePoints.length < 2) {
      Alert.alert('Error', 'Por favor trace origen y destino en el mapa táctil.');
      return;
    }

    const newRoute = {
      id: `TRP-${Math.floor(1000 + Math.random() * 9000)}`,
      patente: patente.toUpperCase(),
      chofer: user?.nombre || 'Chofer Profesional',
      tipoVehiculo,
      peso,
      cargaPeligrosa,
      origen: 'Origen (Trazado Táctil)',
      destino: 'Destino (Trazado Táctil)',
      estado: 'PENDIENTE',
      fecha: new Date().toISOString().split('T')[0],
      puntos: routePoints
    };

    setRoutes([newRoute, ...routes]);
    setPatente('');
    setRoutePoints([]);
    setActiveTab('requests');
    Alert.alert('Éxito', 'Solicitud de permiso enviada al municipio.');
  };

  const handleApprove = (id: string) => {
    setRoutes(prev => prev.map(r => r.id === id ? { ...r, estado: 'APROBADA' } : r));
    if (selectedRoute?.id === id) {
      setSelectedRoute(prev => prev ? { ...prev, estado: 'APROBADA' } : null);
    }
    Alert.alert('Permiso Aprobado', `La solicitud #${id} ha sido aprobada con éxito.`);
  };

  const handleReject = (id: string) => {
    setRoutes(prev => prev.map(r => r.id === id ? { ...r, estado: 'RECHAZADA' } : r));
    if (selectedRoute?.id === id) {
      setSelectedRoute(prev => prev ? { ...prev, estado: 'RECHAZADA' } : null);
    }
    Alert.alert('Permiso Rechazado', `La solicitud #${id} ha sido rechazada.`);
  };

  const simulateScan = (routeId: string) => {
    setIsInvalidScan(false);
    setIsScanning(true);
    setTimeout(() => {
      const match = routes.find(r => r.id === routeId);
      if (match) {
        setScanResult(match);
      }
      setIsScanning(false);
    }, 1500);
  };

  const simulateInvalidScan = () => {
    setScanResult(null);
    setIsInvalidScan(false);
    setIsScanning(true);
    setTimeout(() => {
      setIsInvalidScan(true);
      setIsScanning(false);
    }, 1500);
  };

  return (
    <SafeAreaView style={styles.container}>
      
      {/* Dynamic Native Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIconContainer}>
            <Ionicons name="bus-outline" size={18} color="white" />
          </View>
          <View>
            <Text style={styles.headerTitle}>SAT+ Nativo</Text>
            <Text style={styles.headerSubtitle}>Tránsito Pesado · Lanús</Text>
          </View>
        </View>
        
        {user && (
          <View style={styles.headerRight}>
            <View style={styles.profileTextContainer}>
              <Text style={styles.profileName}>{user.nombre}</Text>
              <Text style={styles.profileRole}>
                {user.rol === 'CHOFER' ? 'Transportista' : 'Inspector'}
              </Text>
            </View>
            <TouchableOpacity 
              onPress={() => { setUser(null); setSelectedRoute(null); setScanResult(null); setIsInvalidScan(false); }}
              style={styles.logoutButton}
            >
              <Ionicons name="log-out-outline" size={16} color="#94a3b8" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Main Content Area */}
      <View style={styles.mainContent}>
        
        {/* LOGIN SCREEN */}
        {!user && (
          <View style={styles.loginContainer}>
            <View style={styles.loginCard}>
              <Text style={styles.loginEmoji}>🏢</Text>
              <Text style={styles.loginTitle}>Acceso SAT+ Municipal</Text>
              <Text style={styles.loginSubtitle}>Seleccione su rol de acceso nativo</Text>

              <TouchableOpacity 
                onPress={() => { setUser({ nombre: 'Juan Rodríguez', rol: 'CHOFER' }); setActiveTab('home'); }}
                style={[styles.loginRoleButton, { borderColor: '#2563eb' }]}
              >
                <View style={[styles.loginRoleIcon, { backgroundColor: '#eff6ff' }]}>
                  <Ionicons name="car-outline" size={24} color="#2563eb" />
                </View>
                <View style={styles.loginRoleText}>
                  <Text style={styles.loginRoleTitle}>Chofer de Carga Pesada</Text>
                  <Text style={styles.loginRoleDesc}>Solicite permisos y trace rutas autorizadas.</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={() => { setUser({ nombre: 'Insp. Carlos Massa', rol: 'INSPECTOR' }); setActiveTab('home'); }}
                style={[styles.loginRoleButton, { borderColor: '#f59e0b', marginTop: 15 }]}
              >
                <View style={[styles.loginRoleIcon, { backgroundColor: '#fffbeb' }]}>
                  <Ionicons name="shield-checkmark-outline" size={24} color="#f59e0b" />
                </View>
                <View style={styles.loginRoleText}>
                  <Text style={styles.loginRoleTitle}>Inspector Municipal</Text>
                  <Text style={styles.loginRoleDesc}>Audite y fiscalice credenciales QR en calle.</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* LOGGED IN VIEWS */}
        {user && (
          <View style={{ flex: 1 }}>
            
            {/* VIEW 1: HOME */}
            {activeTab === 'home' && (
              <ScrollView contentContainerStyle={styles.viewPadding}>
                
                {/* Hero Greeting Board */}
                <View style={styles.heroBoard}>
                  <Text style={styles.heroSub}>Municipio de Lanús</Text>
                  <Text style={styles.heroTitle}>Control de Tránsito Pesado</Text>
                  <Text style={styles.heroText}>
                    {user.rol === 'CHOFER'
                      ? 'Registre sus camiones y dibuje su trayecto de circulación en el ejido urbano para evitar multas.'
                      : 'Audite en calle las solicitudes y escanee credenciales de circulación digital en tiempo real.'}
                  </Text>
                </View>

                {/* Quick Actions Grid */}
                <Text style={styles.sectionLabel}>Acciones Principales</Text>
                <View style={styles.actionsContainer}>
                  {user.rol === 'CHOFER' ? (
                    <>
                      <TouchableOpacity onPress={() => setActiveTab('new_request')} style={styles.actionBtn}>
                        <View style={[styles.actionIcon, { backgroundColor: '#2563eb' }]}>
                          <Ionicons name="map-outline" size={20} color="white" />
                        </View>
                        <Text style={styles.actionBtnText}>Solicitar Nueva Ruta</Text>
                        <Ionicons name="chevron-forward-outline" size={16} color="#94a3b8" />
                      </TouchableOpacity>

                      <TouchableOpacity onPress={() => setActiveTab('requests')} style={[styles.actionBtn, { marginTop: 10 }]}>
                        <View style={[styles.actionIcon, { backgroundColor: '#475569' }]}>
                          <Ionicons name="document-text-outline" size={20} color="white" />
                        </View>
                        <Text style={styles.actionBtnText}>Mis Permisos Solicitados</Text>
                        <View style={styles.badgeCount}>
                          <Text style={styles.badgeCountText}>{routes.length}</Text>
                        </View>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      <TouchableOpacity onPress={() => setActiveTab('scan')} style={[styles.actionBtn, { borderColor: '#f59e0b' }]}>
                        <View style={[styles.actionIcon, { backgroundColor: '#f59e0b' }]}>
                          <Ionicons name="qr-code-outline" size={20} color="white" />
                        </View>
                        <Text style={styles.actionBtnText}>Escanear Credencial QR</Text>
                        <Ionicons name="chevron-forward-outline" size={16} color="#94a3b8" />
                      </TouchableOpacity>

                      <TouchableOpacity onPress={() => setActiveTab('requests')} style={[styles.actionBtn, { marginTop: 10 }]}>
                        <View style={[styles.actionIcon, { backgroundColor: '#64748b' }]}>
                          <Ionicons name="time-outline" size={20} color="white" />
                        </View>
                        <Text style={styles.actionBtnText}>Aprobaciones Pendientes</Text>
                        <View style={[styles.badgeCount, { backgroundColor: '#fffbeb' }]}>
                          <Text style={[styles.badgeCountText, { color: '#b45309' }]}>
                            {routes.filter(r => r.estado === 'PENDIENTE').length}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    </>
                  )}
                </View>

                {/* Recent Activity */}
                <Text style={styles.sectionLabel}>Permisos Recientes</Text>
                {routes.slice(0, 2).map(r => (
                  <TouchableOpacity key={r.id} onPress={() => setSelectedRoute(r)} style={styles.routeCard}>
                    <View style={styles.routeCardLeft}>
                      <View style={styles.truckIconCircle}>
                        <Ionicons name="cube-outline" size={20} color="#475569" />
                      </View>
                      <View>
                        <Text style={styles.routeCardTitle}>#{r.id} · {r.patente}</Text>
                        <Text style={styles.routeCardSub}>{r.tipoVehiculo} · {r.peso}</Text>
                      </View>
                    </View>
                    <View style={[styles.statusBadge, 
                      r.estado === 'APROBADA' ? styles.badgeApprove : 
                      r.estado === 'PENDIENTE' ? styles.badgePending : styles.badgeReject
                    ]}>
                      <Text style={[styles.statusBadgeText,
                        r.estado === 'APROBADA' ? { color: '#166534' } : 
                        r.estado === 'PENDIENTE' ? { color: '#b45309' } : { color: '#991b1b' }
                      ]}>{r.estado}</Text>
                    </View>
                  </TouchableOpacity>
                ))}

              </ScrollView>
            )}

            {/* VIEW 2: REQUESTS LIST */}
            {activeTab === 'requests' && (
              <View style={{ flex: 1 }}>
                <View style={styles.subHeader}>
                  <Text style={styles.subHeaderTitle}>
                    {user.rol === 'CHOFER' ? 'Historial de Trámites' : 'Control de Solicitudes'}
                  </Text>
                  <Text style={styles.subHeaderLabel}>{routes.length} Permisos</Text>
                </View>
                <ScrollView contentContainerStyle={styles.viewPadding}>
                  {routes.map(r => (
                    <TouchableOpacity key={r.id} onPress={() => setSelectedRoute(r)} style={styles.routeCard}>
                      <View style={styles.routeCardLeft}>
                        <View style={styles.truckIconCircle}>
                          <Ionicons name="document-outline" size={20} color="#475569" />
                        </View>
                        <View>
                          <Text style={styles.routeCardTitle}>#{r.id} · {r.patente}</Text>
                          <Text style={styles.routeCardSub}>{r.tipoVehiculo} · {r.peso}</Text>
                        </View>
                      </View>
                      <View style={[styles.statusBadge, 
                        r.estado === 'APROBADA' ? styles.badgeApprove : 
                        r.estado === 'PENDIENTE' ? styles.badgePending : styles.badgeReject
                      ]}>
                        <Text style={[styles.statusBadgeText,
                          r.estado === 'APROBADA' ? { color: '#166534' } : 
                          r.estado === 'PENDIENTE' ? { color: '#b45309' } : { color: '#991b1b' }
                        ]}>{r.estado}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* VIEW 3: NEW REQUEST MAP CANVAS */}
            {activeTab === 'new_request' && (
              <View style={{ flex: 1 }}>
                <View style={styles.subHeader}>
                  <Text style={styles.subHeaderTitle}>Trazar Ruta en Mapa</Text>
                  <TouchableOpacity onPress={handleClearMap} style={styles.clearMapBtn}>
                    <Text style={styles.clearMapBtnText}>Reiniciar</Text>
                  </TouchableOpacity>
                </View>

                {/* Touch Canvas mapping area */}
                <View style={styles.mapCanvasContainer}>
                  <TouchableOpacity 
                    activeOpacity={1} 
                    onPress={handleMapPress}
                    style={styles.mapCanvas}
                  >
                    {/* Mock map features */}
                    <View style={[styles.mapRiver, { top: 50, height: 15 }]} />
                    <View style={[styles.mapRiver, { top: 180, height: 20 }]} />
                    <View style={[styles.mapRoad, { top: 120, height: 10 }]} />
                    <View style={[styles.mapRoad, { left: 130, width: 8, height: '100%' }]} />

                    {/* Instruction overlay */}
                    {routePoints.length === 0 && (
                      <View style={styles.mapHintBox}>
                        <Text style={styles.mapHintTitle}>Mapa Táctil Municipal</Text>
                        <Text style={styles.mapHintText}>Toque la pantalla del mapa en orden para ir dibujando las calles de su recorrido.</Text>
                      </View>
                    )}

                    {/* Render plotted points and lines */}
                    {routePoints.map((pt, idx) => (
                      <View key={idx} style={[styles.mapPoint, { left: pt.x - 7, top: pt.y - 7, backgroundColor: idx === 0 ? '#10b981' : idx === routePoints.length - 1 ? '#ef4444' : '#2563eb' }]}>
                        <Text style={styles.mapPointText}>{idx + 1}</Text>
                      </View>
                    ))}
                  </TouchableOpacity>
                </View>

                {/* Route request details form */}
                <ScrollView style={styles.formContainer} contentContainerStyle={{ paddingBottom: 30 }}>
                  <View style={styles.formRow}>
                    <View style={{ flex: 1, marginRight: 10 }}>
                      <Text style={styles.formLabel}>Patente del Camión</Text>
                      <TextInput 
                        style={styles.formInput} 
                        placeholder="AA 123 BB" 
                        placeholderTextColor="#94a3b8"
                        value={patente} 
                        onChangeText={setPatente}
                        autoCapitalize="characters"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.formLabel}>Peso Autorizado</Text>
                      <TextInput 
                        style={styles.formInput} 
                        placeholder="28 Tn" 
                        placeholderTextColor="#94a3b8"
                        value={peso} 
                        onChangeText={setPeso}
                      />
                    </View>
                  </View>

                  <View style={[styles.formRow, { marginTop: 15 }]}>
                    <View style={{ flex: 1, marginRight: 10 }}>
                      <Text style={styles.formLabel}>Tipo de Acoplado</Text>
                      <TextInput 
                        style={styles.formInput} 
                        value={tipoVehiculo} 
                        onChangeText={setTipoVehiculo}
                      />
                    </View>
                    <View style={{ flex: 1, justifyContent: 'center', paddingTop: 18 }}>
                      <View style={styles.switchRow}>
                        <Text style={styles.switchLabel}>Carga Peligrosa</Text>
                        <Switch value={cargaPeligrosa} onValueChange={setCargaPeligrosa} thumbColor={cargaPeligrosa ? '#2563eb' : '#f4f3f4'} trackColor={{ false: '#767577', true: '#81b0ff' }} />
                      </View>
                    </View>
                  </View>

                  <TouchableOpacity onPress={handleAddRequest} style={styles.submitFormBtn}>
                    <Text style={styles.submitFormBtnText}>Enviar Solicitud Municipal</Text>
                  </TouchableOpacity>
                </ScrollView>
              </View>
            )}

            {/* VIEW 4: INSPECTOR SCANNER SIMULATOR */}
            {activeTab === 'scan' && (
              <ScrollView contentContainerStyle={styles.viewPadding}>
                <View style={[styles.subHeader, { paddingHorizontal: 0, marginBottom: 15 }]}>
                  <Text style={styles.subHeaderTitle}>Validación de Permisos QR</Text>
                </View>

                {/* Simulated Camera Scanner box */}
                <View style={styles.scannerViewport}>
                  <View style={styles.scannerBoundary} />
                  
                  {isScanning ? (
                    <View style={styles.scannerLoader}>
                      <ActivityIndicator size="large" color="#f59e0b" />
                      <Text style={styles.scannerLoaderText}>Escaneando código QR municipal...</Text>
                    </View>
                  ) : scanResult ? (
                    <View style={styles.scannerSuccessCenter}>
                      <Ionicons name="checkmark-circle" size={48} color="#10b981" />
                      <Text style={styles.scannerSuccessText}>PERMISO VÁLIDO</Text>
                    </View>
                  ) : isInvalidScan ? (
                    <View style={styles.scannerSuccessCenter}>
                      <Ionicons name="close-circle" size={48} color="#ef4444" />
                      <Text style={[styles.scannerSuccessText, { color: '#ef4444' }]}>PERMISO INVÁLIDO</Text>
                    </View>
                  ) : (
                    <Text style={styles.scannerOverlayText}>Cámara lista. Seleccione una acción de simulación.</Text>
                  )}
                  
                  {!scanResult && !isInvalidScan && !isScanning && (
                    <View style={styles.scannerLaser} />
                  )}
                </View>

                {/* Controls for Simulation */}
                <Text style={styles.sectionLabel}>Seleccionar Prueba de Escaneo</Text>
                <View style={styles.scannerSimActions}>
                  {routes.filter(r => r.estado === 'APROBADA').map(r => (
                    <TouchableOpacity key={r.id} onPress={() => simulateScan(r.id)} style={styles.simCardBtn}>
                      <Text style={styles.simCardText}>Escanear Patente: {r.patente}</Text>
                      <Text style={styles.simCardTag}>Aprobado</Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity onPress={simulateInvalidScan} style={[styles.simCardBtn, { borderColor: '#fca5a5' }]}>
                    <Text style={[styles.simCardText, { color: '#b91c1c' }]}>Escanear Código QR Vencido / Trucho</Text>
                    <Text style={[styles.simCardTag, { backgroundColor: '#fee2e2', color: '#b91c1c' }]}>Inválido</Text>
                  </TouchableOpacity>
                </View>

                {/* Validation Info display card */}
                {scanResult && (
                  <View style={styles.validationCard}>
                    <View style={styles.validationHeader}>
                      <Ionicons name="ribbon-outline" size={20} color="#15803d" />
                      <Text style={styles.validationTitle}>Credencial Autorizada SAT+</Text>
                    </View>
                    <View style={styles.validationGrid}>
                      <View style={styles.valGridCol}>
                        <Text style={styles.valColLabel}>Chofer Autorizado</Text>
                        <Text style={styles.valColVal}>{scanResult.chofer}</Text>
                      </View>
                      <View style={styles.valGridCol}>
                        <Text style={styles.valColLabel}>Patente Camión</Text>
                        <Text style={styles.valColVal}>{scanResult.patente}</Text>
                      </View>
                      <View style={styles.valGridCol}>
                        <Text style={styles.valColLabel}>Tipo Acoplado</Text>
                        <Text style={styles.valColVal}>{scanResult.tipoVehiculo}</Text>
                      </View>
                      <View style={styles.valGridCol}>
                        <Text style={styles.valColLabel}>Peso Máximo</Text>
                        <Text style={styles.valColVal}>{scanResult.peso}</Text>
                      </View>
                    </View>
                  </View>
                )}

                {isInvalidScan && (
                  <View style={styles.invalidScanWarning}>
                    <Ionicons name="warning-outline" size={24} color="#991b1b" />
                    <Text style={styles.invalidScanText}>
                      Alerta de control vial. El código QR no corresponde a ningún permiso habilitado para circular hoy por el partido de Lanús.
                    </Text>
                  </View>
                )}

              </ScrollView>
            )}

          </View>
        )}

      </View>

      {/* Dynamic Tab Bar Navigation */}
      {user && (
        <View style={styles.tabBar}>
          <TouchableOpacity onPress={() => { setActiveTab('home'); setSelectedRoute(null); setScanResult(null); setIsInvalidScan(false); }} style={styles.tabItem}>
            <Ionicons name="home-outline" size={20} color={activeTab === 'home' ? '#2563eb' : '#94a3b8'} />
            <Text style={[styles.tabText, activeTab === 'home' && { color: '#2563eb' }]}>Inicio</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => { setActiveTab('requests'); setSelectedRoute(null); setScanResult(null); setIsInvalidScan(false); }} style={styles.tabItem}>
            <Ionicons name="document-text-outline" size={20} color={activeTab === 'requests' ? '#2563eb' : '#94a3b8'} />
            <Text style={[styles.tabText, activeTab === 'requests' && { color: '#2563eb' }]}>Permisos</Text>
          </TouchableOpacity>

          {user.rol === 'CHOFER' ? (
            <TouchableOpacity onPress={() => { setActiveTab('new_request'); setSelectedRoute(null); setScanResult(null); setIsInvalidScan(false); }} style={styles.tabItem}>
              <Ionicons name="map-outline" size={20} color={activeTab === 'new_request' ? '#2563eb' : '#94a3b8'} />
              <Text style={[styles.tabText, activeTab === 'new_request' && { color: '#2563eb' }]}>Trazar Ruta</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => { setActiveTab('scan'); setSelectedRoute(null); setScanResult(null); setIsInvalidScan(false); }} style={styles.tabItem}>
              <Ionicons name="qr-code-outline" size={20} color={activeTab === 'scan' ? '#2563eb' : '#94a3b8'} />
              <Text style={[styles.tabText, activeTab === 'scan' && { color: '#2563eb' }]}>Escanear</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* DETAILS / WALLET PERMIT DRAWER MODAL */}
      {selectedRoute && (
        <Modal visible={true} transparent={true} animationType="slide">
          <View style={styles.modalBg}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalHeaderTitle}>Solicitud de Circulación</Text>
                <TouchableOpacity onPress={() => setSelectedRoute(null)} style={styles.modalCloseBtn}>
                  <Text style={styles.modalCloseText}>Cerrar</Text>
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={styles.modalBody}>
                {selectedRoute.estado === 'APROBADA' ? (
                  <View style={styles.walletContainer}>
                    {/* Wallet pass */}
                    <View style={styles.walletPass}>
                      <View style={styles.walletPassHeader}>
                        <Text style={styles.walletPassMun}>MUNICIP. LANÚS</Text>
                        <Ionicons name="shield-checkmark" size={16} color="#10b981" />
                      </View>
                      <View style={styles.walletPassBody}>
                        <View>
                          <Text style={styles.walletLabel}>Patente Autorizada</Text>
                          <Text style={styles.walletValue}>{selectedRoute.patente}</Text>
                        </View>
                        <View style={styles.walletQrBox}>
                          <Ionicons name="qr-code" size={48} color="#0f172a" />
                        </View>
                      </View>
                      <View style={styles.walletFooter}>
                        <Text style={styles.walletFooterLabel}>CÓDIGO DE CONTROL: {selectedRoute.id}</Text>
                        <View style={styles.activeTag}>
                          <Text style={styles.activeTagText}>ACTIVO</Text>
                        </View>
                      </View>
                    </View>
                    <Text style={styles.walletPassHint}>Presente este código QR en los retenes municipales de tránsito.</Text>
                  </View>
                ) : selectedRoute.estado === 'PENDIENTE' ? (
                  <View style={[styles.statusBanner, { backgroundColor: '#fffbeb', borderColor: '#fef3c7' }]}>
                    <Ionicons name="time" size={24} color="#d97706" />
                    <Text style={[styles.statusBannerText, { color: '#b45309' }]}>Su trámite está siendo evaluado por el área de control de tránsito pesado municipal.</Text>
                  </View>
                ) : (
                  <View style={[styles.statusBanner, { backgroundColor: '#fef2f2', borderColor: '#fee2e2' }]}>
                    <Ionicons name="close-circle" size={24} color="#dc2626" />
                    <Text style={[styles.statusBannerText, { color: '#991b1b' }]}>Trámite Rechazado. La tara del vehículo excede la capacidad estructural del trazado vial.</Text>
                  </View>
                )}

                {/* Technical Information list */}
                <Text style={[styles.sectionLabel, { marginTop: 15, marginBottom: 8 }]}>Detalles del Vehículo</Text>
                <View style={styles.techInfoBlock}>
                  <View style={styles.techInfoRow}>
                    <Text style={styles.techLabel}>Conductor</Text>
                    <Text style={styles.techVal}>{selectedRoute.chofer}</Text>
                  </View>
                  <View style={styles.techInfoRow}>
                    <Text style={styles.techLabel}>Tipo de Acoplado</Text>
                    <Text style={styles.techVal}>{selectedRoute.tipoVehiculo}</Text>
                  </View>
                  <View style={styles.techInfoRow}>
                    <Text style={styles.techLabel}>Carga Autorizada</Text>
                    <Text style={styles.techVal}>{selectedRoute.peso}</Text>
                  </View>
                  <View style={styles.techInfoRow}>
                    <Text style={styles.techLabel}>Carga Peligrosa</Text>
                    <Text style={[styles.techVal, selectedRoute.cargaPeligrosa && { color: '#ef4444', fontWeight: 'bold' }]}>
                      {selectedRoute.cargaPeligrosa ? 'SÍ' : 'NO'}
                    </Text>
                  </View>
                </View>

                {/* Inspector Actions when pending */}
                {user?.rol === 'INSPECTOR' && selectedRoute.estado === 'PENDIENTE' && (
                  <View style={styles.inspectorActionsContainer}>
                    <TouchableOpacity onPress={() => handleReject(selectedRoute.id)} style={styles.rejectPermitBtn}>
                      <Text style={styles.rejectPermitText}>Rechazar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleApprove(selectedRoute.id)} style={styles.approvePermitBtn}>
                      <Text style={styles.approvePermitText}>Aprobar Permiso</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    height: 56,
    backgroundColor: '#0f172a',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconContainer: {
    backgroundColor: '#2563eb',
    padding: 6,
    borderRadius: 8,
    marginRight: 10,
  },
  headerTitle: {
    color: 'white',
    fontSize: 14,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: '#94a3b8',
    fontSize: 9,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileTextContainer: {
    alignItems: 'flex-end',
    marginRight: 10,
  },
  profileName: {
    color: 'white',
    fontSize: 11,
    fontWeight: 'bold',
  },
  profileRole: {
    color: '#94a3b8',
    fontSize: 8,
    fontWeight: '500',
  },
  logoutButton: {
    backgroundColor: '#1e293b',
    padding: 6,
    borderRadius: 99,
  },
  mainContent: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loginContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  loginCard: {
    width: '100%',
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
    alignItems: 'center',
  },
  loginEmoji: {
    fontSize: 40,
    marginBottom: 10,
  },
  loginTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
  },
  loginSubtitle: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 4,
    marginBottom: 24,
    textAlign: 'center',
    fontWeight: '500',
  },
  loginRoleButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderWidth: 2,
    borderRadius: 16,
    padding: 16,
  },
  loginRoleIcon: {
    padding: 10,
    borderRadius: 12,
    marginRight: 14,
  },
  loginRoleText: {
    flex: 1,
  },
  loginRoleTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  loginRoleDesc: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
    fontWeight: '500',
  },
  viewPadding: {
    padding: 16,
  },
  heroBoard: {
    backgroundColor: '#1e3a8a',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  heroSub: {
    fontSize: 8,
    fontWeight: '700',
    color: '#93c5fd',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  heroTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: 'white',
    marginTop: 2,
  },
  heroText: {
    fontSize: 11,
    color: '#bfdbfe',
    marginTop: 6,
    lineHeight: 15,
  },
  sectionLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 20,
    marginBottom: 10,
  },
  actionsContainer: {
    width: '100%',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    padding: 12,
  },
  actionIcon: {
    padding: 8,
    borderRadius: 10,
    marginRight: 12,
  },
  actionBtnText: {
    flex: 1,
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  badgeCount: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  badgeCountText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#2563eb',
  },
  routeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'white',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    padding: 12,
    marginBottom: 8,
  },
  routeCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  truckIconCircle: {
    backgroundColor: '#f1f5f9',
    padding: 8,
    borderRadius: 10,
    marginRight: 12,
  },
  routeCardTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  routeCardSub: {
    fontSize: 9,
    color: '#64748b',
    marginTop: 2,
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
  },
  badgeApprove: {
    backgroundColor: '#ecfdf5',
    borderColor: '#d1fae5',
  },
  badgePending: {
    backgroundColor: '#fffbeb',
    borderColor: '#fef3c7',
  },
  badgeReject: {
    backgroundColor: '#fef2f2',
    borderColor: '#fee2e2',
  },
  statusBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  subHeader: {
    height: 48,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  subHeaderTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  subHeaderLabel: {
    fontSize: 9,
    color: '#64748b',
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  clearMapBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
  },
  clearMapBtnText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#475569',
  },
  mapCanvasContainer: {
    flex: 1.2,
    backgroundColor: '#e2e8f0',
  },
  mapCanvas: {
    flex: 1,
    backgroundColor: '#cbd5e1',
    position: 'relative',
  },
  mapRiver: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: '#93c5fd',
    opacity: 0.5,
  },
  mapRoad: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: '#94a3b8',
    opacity: 0.3,
  },
  mapHintBox: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    padding: 10,
    borderRadius: 12,
  },
  mapHintTitle: {
    color: '#38bdf8',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  mapHintText: {
    color: '#cbd5e1',
    fontSize: 9,
    fontWeight: '500',
    marginTop: 2,
    lineHeight: 12,
  },
  mapPoint: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapPointText: {
    color: 'white',
    fontSize: 7,
    fontWeight: 'bold',
  },
  formContainer: {
    flex: 1,
    backgroundColor: 'white',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  formRow: {
    flexDirection: 'row',
  },
  formLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748b',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  formInput: {
    height: 38,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 11,
    fontWeight: 'bold',
    color: '#0f172a',
    backgroundColor: '#f8fafc',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 38,
  },
  switchLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#334155',
  },
  submitFormBtn: {
    backgroundColor: '#2563eb',
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 15,
  },
  submitFormBtnText: {
    color: 'white',
    fontSize: 11,
    fontWeight: 'bold',
  },
  scannerViewport: {
    width: '100%',
    aspectRatio: 1.3,
    backgroundColor: '#0f172a',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1e293b',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  scannerBoundary: {
    position: 'absolute',
    top: 20,
    bottom: 20,
    left: 20,
    right: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderStyle: 'dashed',
    borderRadius: 14,
  },
  scannerLaser: {
    width: '100%',
    height: 2,
    backgroundColor: '#ef4444',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 5,
    elevation: 4,
  },
  scannerLoader: {
    alignItems: 'center',
  },
  scannerLoaderText: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: 8,
  },
  scannerSuccessCenter: {
    alignItems: 'center',
    zIndex: 10,
  },
  scannerSuccessText: {
    color: '#10b981',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 8,
    letterSpacing: 0.5,
  },
  scannerOverlayText: {
    color: '#64748b',
    fontSize: 10,
    paddingHorizontal: 24,
    textAlign: 'center',
    fontWeight: '500',
  },
  scannerSimActions: {
    width: '100%',
  },
  simCardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 6,
  },
  simCardText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#334155',
  },
  simCardTag: {
    fontSize: 8,
    fontWeight: '800',
    textTransform: 'uppercase',
    backgroundColor: '#d1fae5',
    color: '#065f46',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  validationCard: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 18,
    padding: 16,
    marginTop: 15,
  },
  validationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 10,
    marginBottom: 10,
  },
  validationTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#15803d',
    marginLeft: 6,
  },
  validationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  valGridCol: {
    width: '50%',
    marginBottom: 8,
  },
  valColLabel: {
    fontSize: 8,
    color: '#94a3b8',
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  valColVal: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#334155',
    marginTop: 1,
  },
  invalidScanWarning: {
    backgroundColor: '#fff1f2',
    borderWidth: 1,
    borderColor: '#ffe4e6',
    borderRadius: 18,
    padding: 14,
    marginTop: 15,
    flexDirection: 'row',
    alignItems: 'center',
  },
  invalidScanText: {
    flex: 1,
    fontSize: 10,
    fontWeight: '600',
    color: '#991b1b',
    marginLeft: 10,
    lineHeight: 14,
  },
  tabBar: {
    height: 52,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#94a3b8',
    marginTop: 2,
  },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
  },
  modalHeader: {
    height: 48,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  modalHeaderTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  modalCloseBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  modalCloseText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#64748b',
  },
  modalBody: {
    padding: 16,
  },
  walletContainer: {
    alignItems: 'center',
  },
  walletPass: {
    width: '100%',
    backgroundColor: '#0f172a',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  walletPassHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    paddingBottom: 10,
  },
  walletPassMun: {
    fontSize: 9,
    fontWeight: '800',
    color: '#60a5fa',
    letterSpacing: 0.5,
  },
  walletPassBody: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  walletLabel: {
    fontSize: 8,
    color: '#94a3b8',
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  walletValue: {
    fontSize: 18,
    fontWeight: '900',
    color: 'white',
    marginTop: 2,
  },
  walletQrBox: {
    backgroundColor: 'white',
    padding: 8,
    borderRadius: 10,
  },
  walletFooter: {
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    paddingTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  walletFooterLabel: {
    fontSize: 8,
    color: '#64748b',
    fontWeight: 'bold',
  },
  activeTag: {
    backgroundColor: '#10b981',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  activeTagText: {
    fontSize: 7,
    fontWeight: '900',
    color: '#0f172a',
  },
  walletPassHint: {
    fontSize: 9,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 10,
    fontWeight: '500',
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
  },
  statusBannerText: {
    flex: 1,
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 10,
    lineHeight: 14,
  },
  techInfoBlock: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    padding: 12,
  },
  techInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  techLabel: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
  },
  techVal: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  inspectorActionsContainer: {
    flexDirection: 'row',
    marginTop: 15,
    gap: 10,
  },
  rejectPermitBtn: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fca5a5',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff5f5',
  },
  rejectPermitText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#c53030',
  },
  approvePermitBtn: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  approvePermitText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: 'white',
  },
});
