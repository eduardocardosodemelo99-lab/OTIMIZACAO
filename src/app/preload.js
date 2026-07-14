/**
 * Preload script - ponte segura entre renderer e main process.
 * Nenhuma API Node é exposta diretamente; tudo passa por contextBridge.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('cs2app', {
  version: '0.1.0',

  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close')
  },

  dashboard: {
    getSystemInfo: () => ipcRenderer.invoke('dashboard:getSystemInfo'),
    getLiveStats: () => ipcRenderer.invoke('dashboard:getLiveStats')
  },

  scanner: {
    runFullScan: () => ipcRenderer.invoke('scanner:runFullScan'),
    cleanCategory: (categoryKey) => ipcRenderer.invoke('scanner:cleanCategory', categoryKey)
  },

  windowsTweaks: {
    apply: (tweakId, options) => ipcRenderer.invoke('windows:applyTweak', tweakId, options),
    revert: (tweakId, options) => ipcRenderer.invoke('windows:revertTweak', tweakId, options),
    listStatus: () => ipcRenderer.invoke('windows:listStatus'),
    getUnnecessaryServices: () => ipcRenderer.invoke('windows:getUnnecessaryServices'),
    getCacheTargets: () => ipcRenderer.invoke('windows:getCacheTargets'),
    getPriorityLevels: () => ipcRenderer.invoke('windows:getPriorityLevels'),
    isWindowsPlatform: () => ipcRenderer.invoke('windows:isWindowsPlatform')
  },

  profiles: {
    list: () => ipcRenderer.invoke('profiles:list'),
    apply: (profileId) => ipcRenderer.invoke('profiles:apply', profileId)
  },

  cs2: {
    getAutoexec: () => ipcRenderer.invoke('cs2:getAutoexec'),
    saveAutoexec: (content) => ipcRenderer.invoke('cs2:saveAutoexec', content),
    applyPreset: (presetId) => ipcRenderer.invoke('cs2:applyPreset', presetId)
  },

  benchmark: {
    start: (options) => ipcRenderer.invoke('benchmark:start', options),
    onSample: (callback) => ipcRenderer.on('benchmark:sample', (_e, data) => callback(data)),
    getHistory: () => ipcRenderer.invoke('benchmark:getHistory'),
    checkPresentMon: () => ipcRenderer.invoke('benchmark:checkPresentMon'),
    onPresentMonStatus: (callback) => ipcRenderer.on('benchmark:presentMonStatus', (_e, data) => callback(data))
  },

  backup: {
    create: () => ipcRenderer.invoke('backup:create'),
    restore: (backupId) => ipcRenderer.invoke('backup:restore', backupId),
    list: () => ipcRenderer.invoke('backup:list')
  },

  app: {
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
    openExternal: (url) => ipcRenderer.invoke('app:openExternal', url)
  }
});
