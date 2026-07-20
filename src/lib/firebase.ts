import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  orderBy,
  Firestore,
} from 'firebase/firestore';
import { firebaseConfig, isFirebaseConfigured } from './firebase.config';
import { Client, Document, AppSettings, BouncedCheck, StockItem } from '../types';

let app: FirebaseApp | null = null;
let db: Firestore | null = null;

export function initFirebase() {
  if (!isFirebaseConfigured()) return false;
  try {
    if (!getApps().length) {
      app = initializeApp(firebaseConfig);
    } else {
      app = getApps()[0];
    }
    db = getFirestore(app);
    return true;
  } catch (e) {
    console.error('Firebase init failed:', e);
    return false;
  }
}

function getDb(): Firestore {
  if (!db) throw new Error('Firebase not initialized');
  return db;
}

// ─── Clients ─────────────────────────────────────────────────────────────────

export async function fbSaveClient(client: Client): Promise<void> {
  const ref = doc(getDb(), 'clients', client.id);
  await setDoc(ref, client);
}

export async function fbDeleteClient(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), 'clients', id));
}

export async function fbLoadClients(): Promise<Client[]> {
  const q = query(collection(getDb(), 'clients'), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as Client);
}

// ─── Documents ───────────────────────────────────────────────────────────────

export async function fbSaveDocument(document: Document): Promise<void> {
  const ref = doc(getDb(), 'documents', document.id);
  await setDoc(ref, document);
}

export async function fbDeleteDocument(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), 'documents', id));
}

export async function fbLoadDocuments(): Promise<Document[]> {
  const q = query(collection(getDb(), 'documents'), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as Document);
}

// ─── Settings ────────────────────────────────────────────────────────────────

export async function fbSaveSettings(settings: AppSettings): Promise<void> {
  await setDoc(doc(getDb(), 'settings', 'main'), settings);
}

export async function fbLoadSettings(): Promise<AppSettings | null> {
  const snap = await getDoc(doc(getDb(), 'settings', 'main'));
  return snap.exists() ? (snap.data() as AppSettings) : null;
}

// ─── Bounced Checks ──────────────────────────────────────────────────────────

export async function fbSaveCheck(check: BouncedCheck): Promise<void> {
  const ref = doc(getDb(), 'bouncedChecks', check.id);
  await setDoc(ref, check);
}

export async function fbDeleteCheck(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), 'bouncedChecks', id));
}

export async function fbLoadChecks(): Promise<BouncedCheck[]> {
  const q = query(collection(getDb(), 'bouncedChecks'), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as BouncedCheck);
}

// ─── Stock Items (Estoque) ───────────────────────────────────────────────────

export async function fbSaveStockItem(item: StockItem): Promise<void> {
  const ref = doc(getDb(), 'stockItems', item.id);
  await setDoc(ref, item);
}

export async function fbDeleteStockItem(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), 'stockItems', id));
}

export async function fbLoadStockItems(): Promise<StockItem[]> {
  const q = query(collection(getDb(), 'stockItems'), orderBy('descricao', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as StockItem);
}

export { isFirebaseConfigured };
