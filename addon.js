const { addonBuilder } = require('stremio-addon-sdk');
const fs = require('fs');
const path = require('path');

const manifest = require('./manifest.json');

const builder = new addonBuilder(manifest);

// Función para cargar metadatos desde archivos JSON
function loadMetadata(type, id) {
  try {
    const filePath = path.join(__dirname, type, `${id}.json`);
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error(`Error loading ${type} ${id}:`, err.message);
    return null;
  }
}

// Función para listar todos los IDs disponibles
function listAllIds(type) {
  const dirPath = path.join(__dirname, type);
  try {
    const files = fs.readdirSync(dirPath);
    return files
      .filter(file => file.endsWith('.json'))
      .map(file => file.replace('.json', ''));
  } catch (err) {
    console.error(`Error listing ${type}:`, err.message);
    return [];
  }
}

// Handler para el catálogo
builder.defineCatalogHandler(({ type, id, extra }) => {
  console.log(`Catalog request: type=${type}, id=${id}, extra=${JSON.stringify(extra)}`);
  
  if (id !== 'movies' && id !== 'series') {
    return Promise.resolve({ metas: [] });
  }

  const ids = listAllIds(type);
  const metas = ids.map(id => {
    const data = loadMetadata(type, id);
    if (!data || !data.meta) return null;
    
    // Para series, añadimos el conteo de temporadas
    if (type === 'series' && data.streams) {
      const seasons = new Set(data.streams.map(s => s.season));
      return {
        ...data.meta,
        id: `tt${id}`,
        type: 'series',
        seasonCount: seasons.size
      };
    }
    
    return {
      ...data.meta,
      id: `tt${id}`,
      type
    };
  }).filter(Boolean);

  return Promise.resolve({ metas });
});

// Handler para los metadatos
builder.defineMetaHandler(({ type, id }) => {
  console.log(`Meta request: type=${type}, id=${id}`);
  
  if (!id.startsWith('tt')) {
    return Promise.resolve({ meta: null });
  }

  const cleanId = id.replace('tt', '');
  const data = loadMetadata(type, cleanId);
  
  if (!data || !data.meta) {
    return Promise.resolve({ meta: null });
  }

  // Estructura especial para series
  if (type === 'series') {
    const videos = data.streams?.map(stream => ({
      id: `tt${cleanId}:${stream.season}:${stream.episode}`,
      title: stream.title || `Episode ${stream.episode}`,
      season: stream.season,
      episode: stream.episode,
      released: new Date().toISOString(),
      overview: stream.description || stream.title || '',
      thumbnail: stream.thumbnail || data.meta.poster
    })) || [];

    return Promise.resolve({
      meta: {
        ...data.meta,
        id: `tt${cleanId}`,
        type: 'series',
        videos
      }
    });
  }

  // Para películas
  return Promise.resolve({ 
    meta: {
      ...data.meta,
      id: `tt${cleanId}`,
      type: 'movie'
    }
  });
});

// Handler para los streams
builder.defineStreamHandler(({ type, id }) => {
  console.log(`Stream request: type=${type}, id=${id}`);
  
  if (!id.startsWith('tt')) {
    return Promise.resolve({ streams: [] });
  }

  const cleanId = id.replace('tt', '');
  const data = loadMetadata(type, cleanId);
  
  if (!data || !data.streams) {
    return Promise.resolve({ streams: [] });
  }

  let streamsToReturn = data.streams;
  
  // Para series, filtramos por temporada y episodio
  if (type === 'series') {
    const idParts = id.split(':');
    if (idParts.length === 3) {
      const [_, season, episode] = idParts;
      streamsToReturn = data.streams.filter(stream => 
        stream.season.toString() === season && 
        stream.episode.toString() === episode
      );
    } else {
      // Si no viene en formato serie:season:episode, devolvemos vacío
      return Promise.resolve({ streams: [] });
    }
  }

  const streams = streamsToReturn.map(stream => ({
    title: stream.title,
    url: stream.url,
    behaviorHints: {
      notWebReady: stream.type !== 'hls',
      // Otras sugerencias de comportamiento opcionales:
      // bingeGroup: `season-${stream.season}` // Para agrupar episodios
    },
    // Metadatos adicionales para el reproductor
    ...(stream.thumbnail && { thumbnail: stream.thumbnail }),
    ...(stream.subtitles && { subtitles: stream.subtitles })
  }));

  return Promise.resolve({ streams });
});

// Exportar la interfaz del addon
module.exports = builder.getInterface();