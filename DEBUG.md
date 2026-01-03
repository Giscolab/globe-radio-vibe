logger.ts:64 [2026-01-03T17:32:06.674Z] [INFO] [Storage] Initializing SQLite WASM... 
installHook.js:1  Ignoring inability to install OPFS sqlite3_vfs: The OPFS sqlite3_vfs cannot run in the main thread because it requires Atomics.wait().
overrideMethod @ installHook.js:1
(anonymes) @ sqlite3.mjs:12606
Promise.catch
(anonymes) @ sqlite3.mjs:12605
(anonymes) @ sqlite3.mjs:5637
Promise.then
ff @ sqlite3.mjs:5641
sqlite3ApiBootstrap @ sqlite3.mjs:5673
Module.runSQLite3PostLoadInit @ sqlite3.mjs:13581
(anonymes) @ sqlite3.mjs:13644
Promise.then
ff @ sqlite3.mjs:13638
loadSqliteWasm @ db.ts:70
initDatabase @ db.ts:80
init @ App.tsx:32
(anonymes) @ App.tsx:43
commitHookEffectListMount @ react-dom.development.js:23189
commitPassiveMountOnFiber @ react-dom.development.js:24965
commitPassiveMountEffects_complete @ react-dom.development.js:24930
commitPassiveMountEffects_begin @ react-dom.development.js:24917
commitPassiveMountEffects @ react-dom.development.js:24905
flushPassiveEffectsImpl @ react-dom.development.js:27078
flushPassiveEffects @ react-dom.development.js:27023
(anonymes) @ react-dom.development.js:26808
workLoop @ scheduler.development.js:266
flushWork @ scheduler.development.js:239
performWorkUntilDeadline @ scheduler.development.js:533
logger.ts:64 [2026-01-03T17:32:06.723Z] [INFO] [Storage] Using in-memory storage (OPFS not available) 
logger.ts:64 [2026-01-03T17:32:06.725Z] [INFO] [Storage] Migrations applied 
logger.ts:64 [2026-01-03T17:32:06.727Z] [INFO] [Storage] Seeded 9 stations 
logger.ts:64 [2026-01-03T17:32:06.727Z] [INFO] [Storage] Database initialized (mode: memory) 
installHook.js:1  [2026-01-03T17:32:07.004Z] [ERROR] [StationService] No user session available 
overrideMethod @ installHook.js:1
console.error @ index.tsx:86
log @ logger.ts:70
error @ logger.ts:92
callRadioProxy @ stationService.ts:103
await in callRadioProxy
getTopStations @ stationService.ts:230
(anonymes) @ StationsPanel.tsx:58
commitHookEffectListMount @ react-dom.development.js:23189
commitPassiveMountOnFiber @ react-dom.development.js:24965
commitPassiveMountEffects_complete @ react-dom.development.js:24930
commitPassiveMountEffects_begin @ react-dom.development.js:24917
commitPassiveMountEffects @ react-dom.development.js:24905
flushPassiveEffectsImpl @ react-dom.development.js:27078
flushPassiveEffects @ react-dom.development.js:27023
(anonymes) @ react-dom.development.js:26808
workLoop @ scheduler.development.js:266
flushWork @ scheduler.development.js:239
performWorkUntilDeadline @ scheduler.development.js:533
installHook.js:1  [2026-01-03T17:32:07.137Z] [ERROR] [StationService] No user session available 
overrideMethod @ installHook.js:1
console.error @ index.tsx:86
log @ logger.ts:70
error @ logger.ts:92
callRadioProxy @ stationService.ts:103
await in callRadioProxy
getStationsByCountry @ stationService.ts:161
await in getStationsByCountry
queryFn @ useStations.ts:16
fetchFn @ query.ts:474
run @ retryer.ts:155
start @ retryer.ts:221
fetch @ query.ts:546
#executeFetch @ queryObserver.ts:343
setOptions @ queryObserver.ts:191
(anonymes) @ useBaseQuery.ts:123
commitHookEffectListMount @ react-dom.development.js:23189
commitPassiveMountOnFiber @ react-dom.development.js:24965
commitPassiveMountEffects_complete @ react-dom.development.js:24930
commitPassiveMountEffects_begin @ react-dom.development.js:24917
commitPassiveMountEffects @ react-dom.development.js:24905
flushPassiveEffectsImpl @ react-dom.development.js:27078
flushPassiveEffects @ react-dom.development.js:27023
commitRootImpl @ react-dom.development.js:26974
commitRoot @ react-dom.development.js:26721
performSyncWorkOnRoot @ react-dom.development.js:26156
flushSyncCallbacks @ react-dom.development.js:12042
(anonymes) @ react-dom.development.js:25690
installHook.js:1  [2026-01-03T17:32:07.138Z] [WARN] [StationService] Proxy unavailable, using 2 local stations 
overrideMethod @ installHook.js:1
log @ logger.ts:67
warn @ logger.ts:88
getStationsByCountry @ stationService.ts:169
await in getStationsByCountry
queryFn @ useStations.ts:16
fetchFn @ query.ts:474
run @ retryer.ts:155
start @ retryer.ts:221
fetch @ query.ts:546
#executeFetch @ queryObserver.ts:343
setOptions @ queryObserver.ts:191
(anonymes) @ useBaseQuery.ts:123
commitHookEffectListMount @ react-dom.development.js:23189
commitPassiveMountOnFiber @ react-dom.development.js:24965
commitPassiveMountEffects_complete @ react-dom.development.js:24930
commitPassiveMountEffects_begin @ react-dom.development.js:24917
commitPassiveMountEffects @ react-dom.development.js:24905
flushPassiveEffectsImpl @ react-dom.development.js:27078
flushPassiveEffects @ react-dom.development.js:27023
commitRootImpl @ react-dom.development.js:26974
commitRoot @ react-dom.development.js:26721
performSyncWorkOnRoot @ react-dom.development.js:26156
flushSyncCallbacks @ react-dom.development.js:12042
(anonymes) @ react-dom.development.js:25690
client:865 [vite] server connection lost. Polling for restart...


# Contexte du bug

- Edge Function radio-proxy renvoie 401 Missing authorization header
- stationService.ts utilise supabase.auth.getSession()
- supabase est bien importé mais session === null
- Le projet Supabase semble exiger un JWT utilisateur
- Aucun login n'est implémenté dans l'app
- Vite spamme des erreurs car stationService plante au chargement
