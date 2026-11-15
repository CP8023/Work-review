/* ============================================================
   备份增强：写入网盘同步文件夹 / 分享 / 剪贴板 / 自动备份
   数据仍只在本机，只是让「带走数据」这件事更省事。
   ============================================================ */
(function (global) {
  'use strict';

  const App = global.Review;
  const $ = function (sel, root) { return (root || document).querySelector(sel); };

  const DB_NAME = 'work-review-backup';
  const STORE = 'handles';
  const HANDLE_KEY = 'json';
  const AUTO_DELAY = 2000;

  let dbPromise = null;
  let autoTimer = null;

  /* ---------------- 能力检测 ---------------- */

  function fsSupported() {
    return typeof global.showSaveFilePicker === 'function' && !!global.indexedDB;
  }

  function shareSupported() {
    return !!(global.navigator && global.navigator.share && global.File);
  }

  function copySupported() {
    return !!(global.navigator && global.navigator.clipboard && global.navigator.clipboard.writeText);
  }

  App.backupFS = fsSupported();
  App.backupShare = shareSupported();
  App.backupCopy = copySupported();
  App.backupFileName = null;

  /* ---------------- IndexedDB：保存文件句柄 ---------------- */

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      const req = global.indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function () {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    }).catch(function (err) {
      dbPromise = null;
      throw err;
    });
    return dbPromise;
  }

  function idbPut(key, value) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(value, key);
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error); };
        tx.onabort = function () { reject(tx.error); };
      });
    });
  }

  function idbGet(key) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        const tx = db.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).get(key);
        req.onsuccess = function () { resolve(req.result || null); };
        req.onerror = function () { reject(req.error); };
      });
    });
  }

  function getHandle() {
    if (!App.backupFS) return Promise.resolve(null);
    return idbGet(HANDLE_KEY).catch(function () { return null; });
  }

  /* 启动时读一次文件句柄，用于设置页展示 */
  getHandle().then(function (handle) {
    App.backupFileName = handle && handle.name ? handle.name : null;
    if (App.ui && App.ui.view === 'settings' && typeof App.renderSettings === 'function') {
      App.renderSettings();
    }
  });

  /* ---------------- 权限 ---------------- */

  function ensurePermission(handle, interactive) {
    if (!handle || typeof handle.queryPermission !== 'function') return Promise.resolve(true);
    let state = 'granted';
    try {
      state = handle.queryPermission({ mode: 'readwrite' });
    } catch (err) {
      return Promise.resolve(true);
    }
    if (state === 'granted') return Promise.resolve(true);
    if (!interactive || typeof handle.requestPermission !== 'function') return Promise.resolve(false);
    return handle.requestPermission({ mode: 'readwrite' }).then(function (next) {
      return next === 'granted';
    }).catch(function () { return false; });
  }

  /* ---------------- 记录「已备份」 ---------------- */

  function markBackupDone() {
    App.state.settings.lastExportAt = new Date().toISOString();
    App.persist();
    if (App.ui.view === 'settings') App.renderSettings();
  }

  /* ---------------- 选择备份文件（网盘同步文件夹） ---------------- */

  App.pickBackupFile = function () {
    if (!App.backupFS) {
      App.toast('当前浏览器不支持直接写入文件，请用「分享」或「导出」');
      return;
    }
    global.showSaveFilePicker({
      suggestedName: 'work-review-backup.json',
      types: [{ description: 'JSON 备份', accept: { 'application/json': ['.json'] } }]
    }).then(function (handle) {
      return idbPut(HANDLE_KEY, handle).then(function () {
        App.backupFileName = handle.name;
        App.toast('已选择备份文件：' + handle.name);
        return App.writeBackupFile();
      });
    }).catch(function (err) {
      if (err && err.name === 'AbortError') return;
      App.toast('选择备份文件失败');
    });
  };

  /* ---------------- 写入备份文件 ---------------- */

  App.writeBackupFile = function (opts) {
    opts = opts || {};
    if (!App.backupFS) return Promise.resolve(false);
    return getHandle().then(function (handle) {
      if (!handle) return false;
      return ensurePermission(handle, opts.interactive !== false).then(function (ok) {
        if (!ok) return false;
        return handle.createWritable().then(function (writable) {
          return writable.write(App.backupJSON()).then(function () { return writable.close(); });
        }).then(function () {
          App.backupFileName = handle.name;
          markBackupDone();
          if (!opts.silent) App.toast('已写入备份：' + handle.name);
          return true;
        });
      });
    }).catch(function () {
      if (!opts.silent) App.toast('写入备份失败，请重新选择备份文件');
      return false;
    });
  };

  /* ---------------- 分享 / 剪贴板 ---------------- */

  App.shareBackup = function () {
    if (!App.backupShare) {
      App.toast('当前浏览器不支持分享');
      return;
    }
    let file;
    try {
      file = new File([App.backupJSON()], 'work-review-backup.json', { type: 'application/json' });
    } catch (err) {
      App.toast('生成备份文件失败');
      return;
    }
    if (global.navigator.canShare && !global.navigator.canShare({ files: [file] })) {
      App.toast('当前浏览器不能分享文件，已改为下载');
      App.exportJSON();
      return;
    }
    global.navigator.share({ files: [file], title: '工作复盘备份' }).then(function () {
      markBackupDone();
    }).catch(function (err) {
      if (err && err.name === 'AbortError') return;
      App.exportJSON();
    });
  };

  App.copyBackup = function () {
    if (!App.backupCopy) {
      App.toast('当前浏览器不支持复制到剪贴板');
      return;
    }
    global.navigator.clipboard.writeText(App.backupJSON()).then(function () {
      markBackupDone();
      App.toast('备份 JSON 已复制，可粘贴到备忘录 / 网盘笔记');
    }).catch(function () {
      App.toast('复制失败');
    });
  };

  /* ---------------- 自动备份 ---------------- */

  App.scheduleAutoBackup = function () {
    if (!App.state.settings.autoBackup || !App.backupFS) return;
    clearTimeout(autoTimer);
    autoTimer = setTimeout(function () {
      autoTimer = null;
      if (!App.state.settings.autoBackup) return;
      App.writeBackupFile({ silent: true, interactive: false });
    }, AUTO_DELAY);
  };

  App.toggleAutoBackup = function () {
    const next = !App.state.settings.autoBackup;
    App.state.settings.autoBackup = next;
    App.persist();
    App.renderSettings();
    if (next) {
      if (App.backupFileName) {
        App.toast('已开启自动备份');
      } else {
        App.toast('请先选择备份文件');
        App.pickBackupFile();
      }
    } else {
      App.toast('已关闭自动备份');
    }
  };

  /* ---------------- 备份新鲜度 ---------------- */

  App.backupAgeDays = function () {
    const iso = App.state.settings.lastExportAt;
    if (!iso) return Infinity;
    const t = new Date(iso).getTime();
    if (isNaN(t)) return Infinity;
    return Math.floor((Date.now() - t) / 86400000);
  };

  App.backupOld = function () {
    return App.backupAgeDays() >= 14;
  };
})(window);
