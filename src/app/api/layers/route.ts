import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { DOMParser } from '@xmldom/xmldom';
import { kml } from '@tmcw/togeojson';

export async function GET() {
  try {
    const layers = await prisma.layer.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json(layers);
  } catch (error) {
    console.error('Error fetching layers:', error);
    return NextResponse.json({ error: 'Failed to fetch layers', details: String(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const urlObj = new URL(request.url);
    const dryRun = urlObj.searchParams.get('dryRun') === 'true';

    const body = await request.json();

    // 1. Bulk create support
    if (Array.isArray(body)) {
      const created = [];
      for (const layer of body) {
        const newLayer = await prisma.layer.create({
          data: {
            name: layer.name,
            type: layer.type,
            color: layer.color || '#10B981',
            geoData: typeof layer.geoData === 'string' ? layer.geoData : JSON.stringify(layer.geoData),
          }
        });
        created.push(newLayer);
      }
      return NextResponse.json(created);
    }

    // 2. Standard Parse/Extract flow
    const { name, type, geoData, url, color } = body; 
    let fetchedGeoData = geoData;

    if (url) {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch from URL');
      fetchedGeoData = await response.text();
    }

    const createdLayers: any[] = [];

    const handleSave = async (layerData: any) => {
      if (dryRun) {
        createdLayers.push({ id: Math.random().toString(36).substr(2, 9), ...layerData });
      } else {
        createdLayers.push(await prisma.layer.create({ data: layerData }));
      }
    };

    if (type === 'kml') {
      const dom = new DOMParser().parseFromString(fetchedGeoData, 'text/xml');
      const folders = dom.getElementsByTagName('Folder');

      if (folders.length > 0) {
        for (let i = 0; i < folders.length; i++) {
          const originalFolder = folders[i];
          const nameNode = originalFolder.getElementsByTagName('name')[0];
          const folderName = nameNode && nameNode.textContent ? nameNode.textContent : `Grupo ${i + 1}`;
          
          const folderClone = originalFolder.cloneNode(true) as any;
          const childFolders = folderClone.getElementsByTagName('Folder');
          for (let j = childFolders.length - 1; j >= 0; j--) {
            if (childFolders[j].parentNode) {
              childFolders[j].parentNode?.removeChild(childFolders[j]);
            }
          }

          const newDocStr = `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document></Document></kml>`;
          const newDom = new DOMParser().parseFromString(newDocStr, 'text/xml');
          const docElement = newDom.getElementsByTagName('Document')[0];
          
          docElement.appendChild(newDom.importNode(folderClone, true));
          
          const converted = kml(newDom);
          if (converted.features && converted.features.length > 0) {
            await handleSave({
              name: `${name} - ${folderName}`,
              type: 'geojson',
              color: color || '#10B981',
              geoData: JSON.stringify(converted),
            });
          }
        }
        
        // Extract top-level Placemarks
        const topLevelDocStr = `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document></Document></kml>`;
        const topLevelDom = new DOMParser().parseFromString(topLevelDocStr, 'text/xml');
        const topLevelDocElement = topLevelDom.getElementsByTagName('Document')[0];
        
        const documentNodes = dom.getElementsByTagName('Document');
        if (documentNodes.length > 0) {
           const children = documentNodes[0].childNodes;
           for(let i = 0; i < children.length; i++) {
             if (children[i].nodeName === 'Placemark') {
               topLevelDocElement.appendChild(topLevelDom.importNode(children[i], true));
             }
           }
        }
        const topLevelConverted = kml(topLevelDom);
        if (topLevelConverted.features && topLevelConverted.features.length > 0) {
           await handleSave({
              name: `${name} - General`,
              type: 'geojson',
              color: color || '#10B981',
              geoData: JSON.stringify(topLevelConverted),
           });
        }
        return NextResponse.json(createdLayers);
      } else {
        const converted = kml(dom);
        await handleSave({
          name,
          type: 'geojson',
          color: color || '#10B981',
          geoData: JSON.stringify(converted),
        });
        return NextResponse.json(createdLayers);
      }
    } else {
      // GeoJSON parsing
      let parsedObj;
      try {
        parsedObj = typeof fetchedGeoData === 'string' ? JSON.parse(fetchedGeoData) : fetchedGeoData;
      } catch (e) {
        throw new Error('Invalid JSON provided');
      }

      if (parsedObj.type === 'FeatureCollection' && parsedObj.groups && Array.isArray(parsedObj.groups)) {
        const groupMap = new Map();
        parsedObj.groups.forEach((g: any) => {
          groupMap.set(g.id, { name: g.title || g.name || `Grupo ${g.id}`, features: [] });
        });
        
        const generalFeatures: any[] = [];
        
        if (parsedObj.features && Array.isArray(parsedObj.features)) {
          parsedObj.features.forEach((f: any) => {
            const groupId = f.properties?.group || f.properties?.folder;
            if (groupId && groupMap.has(groupId)) {
              groupMap.get(groupId).features.push(f);
            } else {
              generalFeatures.push(f);
            }
          });
        }

        for (const [id, group] of groupMap.entries()) {
          if (group.features.length > 0) {
            await handleSave({
              name: `${name} - ${group.name}`,
              type: 'geojson',
              color: color || '#10B981',
              geoData: JSON.stringify({ type: 'FeatureCollection', features: group.features }),
            });
          }
        }
        
        if (generalFeatures.length > 0) {
          await handleSave({
            name: `${name} - General`,
            type: 'geojson',
            color: color || '#10B981',
            geoData: JSON.stringify({ type: 'FeatureCollection', features: generalFeatures }),
          });
        }
        
        return NextResponse.json(createdLayers.length > 0 ? createdLayers : []);
      } else {
        await handleSave({
          name,
          type,
          color: color || '#10B981',
          geoData: JSON.stringify(parsedObj),
        });
        return NextResponse.json(createdLayers);
      }
    }
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to create layer(s)' }, { status: 500 });
  }
}
