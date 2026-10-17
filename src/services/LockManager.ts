import fs from "fs";
import path from "path";

export interface AssetLock {
  assetId: string;
  assetType: string;
  userId: string;
  userName: string;
  acquiredAt: string;
  heartbeatAt: string;
  ttlSeconds: number;
}

const locks = new Map<string, AssetLock>();
let lockDir = "./data/.locks";
let defaultTtlSeconds = 300;

export function initLockManager(baseDataDir: string, timeoutMinutes: number = 5) {
  lockDir = path.join(baseDataDir, ".locks");
  defaultTtlSeconds = timeoutMinutes * 60;
  if (!fs.existsSync(lockDir)) {
    try {
      fs.mkdirSync(lockDir, { recursive: true });
    } catch {}
  }
  loadLocksFromDisk();
}

function lockKey(assetType: string, assetId: string) {
  return `${assetType}:${assetId}`;
}

function loadLocksFromDisk() {
  try {
    if (!fs.existsSync(lockDir)) return;
    const files = fs.readdirSync(lockDir);
    const now = Date.now();
    for (const f of files) {
      if (!f.endsWith(".lock.json")) continue;
      const fullPath = path.join(lockDir, f);
      try {
        const raw = fs.readFileSync(fullPath, "utf-8");
        const lock: AssetLock = JSON.parse(raw);
        const lastHb = new Date(lock.heartbeatAt).getTime();
        if (now - lastHb < lock.ttlSeconds * 1000) {
          locks.set(lockKey(lock.assetType, lock.assetId), lock);
        } else {
          try { fs.unlinkSync(fullPath); } catch {}
        }
      } catch {}
    }
  } catch {}
}

export function acquireLock(assetType: string, assetId: string, userId: string, userName: string): { success: boolean; lock?: AssetLock; message?: string } {
  const key = lockKey(assetType, assetId);
  const now = new Date().toISOString();
  const existing = locks.get(key);

  if (existing) {
    const elapsedSec = (Date.now() - new Date(existing.heartbeatAt).getTime()) / 1000;
    if (elapsedSec < existing.ttlSeconds && existing.userId !== userId) {
      return {
        success: false,
        lock: existing,
        message: `Asset locked by ${existing.userName} (${Math.round(existing.ttlSeconds - elapsedSec)}s remaining)`
      };
    }
  }

  const lock: AssetLock = {
    assetType,
    assetId,
    userId,
    userName,
    acquiredAt: existing?.acquiredAt || now,
    heartbeatAt: now,
    ttlSeconds: defaultTtlSeconds
  };

  locks.set(key, lock);
  const diskFile = path.join(lockDir, `${assetType}_${assetId.replace(/[^a-zA-Z0-9_-]/g, "_")}.lock.json`);
  try {
    fs.writeFileSync(diskFile, JSON.stringify(lock, null, 2), "utf-8");
  } catch {}

  return { success: true, lock };
}

export function releaseLock(assetType: string, assetId: string, userId: string, force: boolean = false): { success: boolean } {
  const key = lockKey(assetType, assetId);
  const existing = locks.get(key);
  if (!existing) return { success: true };

  if (!force && existing.userId !== userId) {
    return { success: false };
  }

  locks.delete(key);
  const diskFile = path.join(lockDir, `${assetType}_${assetId.replace(/[^a-zA-Z0-9_-]/g, "_")}.lock.json`);
  if (fs.existsSync(diskFile)) {
    try { fs.unlinkSync(diskFile); } catch {}
  }
  return { success: true };
}

export function getActiveLocks(): AssetLock[] {
  const now = Date.now();
  const validLocks: AssetLock[] = [];
  for (const [key, lock] of locks.entries()) {
    const elapsed = (now - new Date(lock.heartbeatAt).getTime()) / 1000;
    if (elapsed < lock.ttlSeconds) {
      validLocks.push(lock);
    } else {
      locks.delete(key);
    }
  }
  return validLocks;
}
