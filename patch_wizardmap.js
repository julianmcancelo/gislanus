const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'components', 'WizardMap.tsx');
let content = fs.readFileSync(filePath, 'utf-8');

// 1. Controller props & state
content = content.replace(
  'function WizardMapController({ onComplete, initialGeo, initialWaypoints }: any) {\\n  const map = useMap();\\n  const [routingControl, setRoutingControl] = useState<any>(null);\\n  const [currentRoute, setCurrentRoute] = useState<any>(null);\\n  const [waypoints, setWaypoints] = useState<any[]>([]);\\n  const [savedFeatures, setSavedFeatures] = useState<any[]>([]);\\n  const [isTracing, setIsTracing] = useState(false);\\n  const [routeName, setRouteName] = useState(\\'Recorrido 1\\');',
  'function WizardMapController({ onComplete, initialGeo, initialWaypoints, defaultRouteName }: any) {\\n  const map = useMap();\\n  const [routingControl, setRoutingControl] = useState<any>(null);\\n  const [currentRoute, setCurrentRoute] = useState<any>(null);\\n  const [waypoints, setWaypoints] = useState<any[]>([]);\\n  const [savedFeatures, setSavedFeatures] = useState<any[]>([]);\\n  const [isTracing, setIsTracing] = useState(false);\\n  const [routeName, setRouteName] = useState(defaultRouteName || \\'Recorrido 1\\');\\n\\n  useEffect(() => {\\n    if (defaultRouteName && savedFeatures.length === 0) {\\n      setRouteName(defaultRouteName);\\n    }\\n  }, [defaultRouteName]);'
);

// 2. WizardMapProps
content = content.replace(
  'interface WizardMapProps {\\n  onComplete: (geoJson: any, streets: string[], waypoints: any[]) => void;\\n  initialGeo?: any;\\n  initialWaypoints?: any[];\\n}',
  'interface WizardMapProps {\\n  onComplete: (geoJson: any, streets: string[], waypoints: any[]) => void;\\n  initialGeo?: any;\\n  initialWaypoints?: any[];\\n  defaultRouteName?: string;\\n}'
);

// 3. WizardMap component
content = content.replace(
  'export default function WizardMap({ onComplete, initialGeo, initialWaypoints }: WizardMapProps) {',
  'export default function WizardMap({ onComplete, initialGeo, initialWaypoints, defaultRouteName }: WizardMapProps) {'
);

content = content.replace(
  '<WizardMapController onComplete={onComplete} initialGeo={initialGeo} initialWaypoints={initialWaypoints} />',
  '<WizardMapController onComplete={onComplete} initialGeo={initialGeo} initialWaypoints={initialWaypoints} defaultRouteName={defaultRouteName} />'
);

fs.writeFileSync(filePath, content);
console.log('WizardMap patched successfully.');
