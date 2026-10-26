import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

// Offline only: accepts saved public match fields, never reads credentials or makes requests.
export function compareLiveTv(payload, renderedIds, now = Date.now()) {
  if (!payload || payload.error || (payload.errors && Object.keys(payload.errors).length) ||
      !Array.isArray(payload.response) || !Array.isArray(renderedIds)) {
    throw new Error('Se requiere una respuesta válida de /api/live y una lista de IDs renderizados.');
  }
  const receivedIds = payload.response.map(item => item?.fixture?.id);
  if ([...receivedIds, ...renderedIds].some(id => !Number.isSafeInteger(id) || id <= 0)) {
    throw new Error('Todos los encuentros deben tener un ID entero positivo.');
  }
  const duplicateIds = ids => [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
  const received = new Set(receivedIds), rendered = new Set(renderedIds);
  const cachedAt = typeof payload.cachedAt === 'number' && Number.isFinite(payload.cachedAt) ? payload.cachedAt : null;
  const cacheAgeSeconds = cachedAt === null ? null : Math.floor((now - cachedAt) / 1000);
  const missingIds = receivedIds.filter(id => !rendered.has(id));
  const unexpectedIds = renderedIds.filter(id => !received.has(id));
  const duplicateReceivedIds = duplicateIds(receivedIds), duplicateRenderedIds = duplicateIds(renderedIds);
  return {
    receivedIds, renderedIds, missingIds, unexpectedIds, duplicateReceivedIds, duplicateRenderedIds,
    exactMatch: !missingIds.length && !unexpectedIds.length && !duplicateReceivedIds.length && !duplicateRenderedIds.length,
    cachedAt, cacheAgeSeconds,
    revalidationDue: cacheAgeSeconds === null ? null : cacheAgeSeconds >= 300,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [, , responsePath, idsPath] = process.argv;
    if (!responsePath || !idsPath) throw new Error('Uso: node scripts/diagnose-live-tv.mjs respuesta.json ids-renderizados.json');
    const result = compareLiveTv(JSON.parse(fs.readFileSync(responsePath, 'utf8')), JSON.parse(fs.readFileSync(idsPath, 'utf8')));
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.exactMatch ? 0 : 1;
  } catch (error) {
    console.error(error instanceof SyntaxError ? 'JSON inválido.' : error.message);
    process.exitCode = 2;
  }
}
