import { Injectable } from '@angular/core';
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  addDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { environment } from '../environments/environment';

export interface UserProfile {
  id: string;
  username: string;
}

export interface GymMoveItem {
  id?: string;
  username?: string;
  title: string;
  description?: string;
  type: string;
  category: string;
  createdDate?: string;
}

export interface WorkoutLogItem {
  id?: string;
  username: string;
  moveId: string;
  moveTitle: string;
  weight: number;
  reps: number[] | number;
  date: string;
  createdDate?: string;
}

@Injectable({ providedIn: 'root' })
export class FirebaseService {
  private app = !getApps().length ? initializeApp(environment.firebase) : getApp();
  public db = getFirestore(this.app);

  // Helper for hash comparison (SHA-256 fallback in browser Web Crypto API)
  private async hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // --- AUTH METHODS ---

  async register(username: string, password: string): Promise<{ user: UserProfile; message: string }> {
    const cleanUser = username.trim().toLowerCase();
    if (!cleanUser || !password) {
      throw new Error('Username and password are required');
    }

    const userDocRef = doc(this.db, 'users', cleanUser);
    const existing = await getDoc(userDocRef);
    if (existing.exists()) {
      throw new Error('Username already exists');
    }

    const passwordHash = await this.hashPassword(password);
    await setDoc(userDocRef, {
      username: cleanUser,
      passwordHash,
      createdAt: serverTimestamp(),
      lastLogin: null
    });

    return {
      message: 'Registration successful',
      user: { id: cleanUser, username: cleanUser }
    };
  }

  async login(username: string, password: string): Promise<{ token: string; user: UserProfile; message: string }> {
    const cleanUser = username.trim().toLowerCase();
    if (!cleanUser || !password) {
      throw new Error('Username and password are required');
    }

    const userDocRef = doc(this.db, 'users', cleanUser);
    const userSnap = await getDoc(userDocRef);
    if (!userSnap.exists()) {
      throw new Error('Invalid username or password');
    }

    const data = userSnap.data();
    const inputHash = await this.hashPassword(password);

    // Support SHA-256 hash or plaintext password match
    const isMatched = data['passwordHash'] === inputHash || data['passwordHash'] === password;
    if (!isMatched) {
      throw new Error('Invalid username or password');
    }

    await updateDoc(userDocRef, { lastLogin: serverTimestamp() });

    return {
      token: 'fb-token-' + cleanUser + '-' + Date.now(),
      message: 'Login successful',
      user: { id: cleanUser, username: cleanUser }
    };
  }

  async forgotPassword(username: string, newPassword: string): Promise<{ message: string }> {
    const cleanUser = username.trim().toLowerCase();
    const userDocRef = doc(this.db, 'users', cleanUser);
    const userSnap = await getDoc(userDocRef);

    if (!userSnap.exists()) {
      throw new Error('Username not found');
    }

    const passwordHash = await this.hashPassword(newPassword);
    await updateDoc(userDocRef, { passwordHash });

    return { message: 'Password has been successfully updated' };
  }

  // --- GYM MOVES METHODS ---

  async getGymMoves(username?: string): Promise<GymMoveItem[]> {
    const cleanUser = username ? username.trim().toLowerCase() : '';
    if (!cleanUser) {
      return [];
    }

    const movesRef = collection(this.db, 'gym_moves');
    const q = query(movesRef, where('username', '==', cleanUser));
    const snap = await getDocs(q);

    const results: GymMoveItem[] = [];
    snap.forEach((d) => {
      const data = d.data();
      let createdDate = new Date().toISOString();
      if (data['createdAt'] instanceof Timestamp) {
        createdDate = data['createdAt'].toDate().toISOString();
      }
      results.push({
        id: d.id,
        username: data['username'] || '',
        title: data['title'] || '',
        description: data['description'] || '',
        type: data['type'] || 'upper',
        category: data['category'] || '',
        createdDate
      });
    });

    return results;
  }

  async addGymMove(item: Omit<GymMoveItem, 'id' | 'createdDate'>): Promise<GymMoveItem> {
    const cleanUser = item.username ? item.username.trim().toLowerCase() : '';
    if (!cleanUser) {
      throw new Error('Username is required to create a move');
    }

    const movesRef = collection(this.db, 'gym_moves');
    const docData = {
      username: cleanUser,
      title: item.title.trim(),
      description: item.description?.trim() || '',
      type: item.type.toLowerCase(),
      category: item.category.trim(),
      createdAt: serverTimestamp()
    };

    const docRef = await addDoc(movesRef, docData);
    return {
      id: docRef.id,
      ...item,
      username: cleanUser,
      createdDate: new Date().toISOString()
    };
  }

  // --- WORKOUT LOGS METHODS ---

  async getWorkoutLogs(username?: string): Promise<WorkoutLogItem[]> {
    const logsRef = collection(this.db, 'workout_logs');
    const cleanUser = username ? username.trim().toLowerCase() : '';

    let q = query(logsRef, orderBy('date', 'desc'));
    if (cleanUser) {
      q = query(logsRef, where('username', '==', cleanUser), orderBy('date', 'desc'));
    }

    const snap = await getDocs(q);
    const results: WorkoutLogItem[] = [];

    snap.forEach((d) => {
      const data = d.data();
      let createdDate = new Date().toISOString();
      if (data['createdAt'] instanceof Timestamp) {
        createdDate = data['createdAt'].toDate().toISOString();
      }
      results.push({
        id: d.id,
        username: data['username'] || '',
        moveId: data['moveId'] || '',
        moveTitle: data['moveTitle'] || '',
        weight: Number(data['weight']) || 0,
        reps: Array.isArray(data['reps']) ? data['reps'] : [],
        date: data['date'] || '',
        createdDate
      });
    });

    return results;
  }

  async addWorkoutLog(log: Omit<WorkoutLogItem, 'id' | 'createdDate'>): Promise<WorkoutLogItem> {
    const logsRef = collection(this.db, 'workout_logs');
    const repsArray = Array.isArray(log.reps) ? log.reps : [log.reps];

    const docData = {
      username: log.username ? log.username.trim().toLowerCase() : '',
      moveId: log.moveId || null,
      moveTitle: log.moveTitle.trim(),
      weight: Number(log.weight) || 0,
      reps: repsArray,
      date: log.date,
      createdAt: serverTimestamp()
    };

    const docRef = await addDoc(logsRef, docData);
    return {
      id: docRef.id,
      ...log,
      reps: repsArray,
      createdDate: new Date().toISOString()
    };
  }
}
