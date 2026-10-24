import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  Timestamp,
  onSnapshot
} from 'firebase/firestore';
import { FirebaseService } from '../firebase.service';
import {
  TrainingPlan,
  CreateTrainingPlanDto,
  UpdateTrainingPlanDto,
  WorkoutDay
} from '../models/training-plan.model';

@Injectable({
  providedIn: 'root'
})
export class TrainingPlanService {
  private readonly collectionName = 'training_plans';

  constructor(private fb: FirebaseService) {}

  /**
   * Helper to format default 7 days of the week for a new plan
   */
  getDefaultWorkoutDays(): WorkoutDay[] {
    return [
      { dayOfWeek: 'monday', title: 'Chest & Triceps', isRestDay: false, exercises: [] },
      { dayOfWeek: 'tuesday', title: 'Back & Biceps', isRestDay: false, exercises: [] },
      { dayOfWeek: 'wednesday', title: 'Rest & Recovery', isRestDay: true, exercises: [] },
      { dayOfWeek: 'thursday', title: 'Legs & Abs', isRestDay: false, exercises: [] },
      { dayOfWeek: 'friday', title: 'Shoulders & Arms', isRestDay: false, exercises: [] },
      { dayOfWeek: 'saturday', title: 'Full Body / Cardio', isRestDay: false, exercises: [] },
      { dayOfWeek: 'sunday', title: 'Rest Day', isRestDay: true, exercises: [] }
    ];
  }

  /**
   * Real-time Observable sync for user's training plans using Firestore onSnapshot
   */
  getTrainingPlans$(username: string): Observable<TrainingPlan[]> {
    return new Observable<TrainingPlan[]>((observer) => {
      const cleanUser = username?.trim().toLowerCase();
      if (!cleanUser) {
        observer.next([]);
        return;
      }

      const plansRef = collection(this.fb.db, this.collectionName);
      const q = query(plansRef, where('username', '==', cleanUser));

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const plans: TrainingPlan[] = snapshot.docs.map((docSnap) => {
            const data = docSnap.data();
            return this.mapDocToTrainingPlan(docSnap.id, data);
          });

          // Sort active first, then newest
          plans.sort((a, b) => {
            if (a.isActive && !b.isActive) return -1;
            if (!a.isActive && b.isActive) return 1;
            return (b.createdDate || '').localeCompare(a.createdDate || '');
          });

          observer.next(plans);
        },
        (error) => {
          observer.error(error);
        }
      );

      return () => unsubscribe();
    });
  }

  /**
   * Single fetch promise for user's training plans
   */
  async getTrainingPlans(username: string): Promise<TrainingPlan[]> {
    const cleanUser = username?.trim().toLowerCase();
    if (!cleanUser) return [];

    const plansRef = collection(this.fb.db, this.collectionName);
    const q = query(plansRef, where('username', '==', cleanUser));
    const snap = await getDocs(q);

    const plans = snap.docs.map((d) => this.mapDocToTrainingPlan(d.id, d.data()));
    plans.sort((a, b) => {
      if (a.isActive && !b.isActive) return -1;
      if (!a.isActive && b.isActive) return 1;
      return (b.createdDate || '').localeCompare(a.createdDate || '');
    });

    return plans;
  }

  /**
   * Get single training plan by ID
   */
  async getTrainingPlanById(planId: string): Promise<TrainingPlan | null> {
    if (!planId) return null;
    const docRef = doc(this.fb.db, this.collectionName, planId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return this.mapDocToTrainingPlan(snap.id, snap.data());
  }

  /**
   * Create a new training plan
   */
  async createTrainingPlan(dto: CreateTrainingPlanDto): Promise<TrainingPlan> {
    const cleanUser = dto.username?.trim().toLowerCase();
    if (!cleanUser) throw new Error('Username is required to create a training plan.');
    if (!dto.title?.trim()) throw new Error('Plan title is required.');

    // If marked active, ensure other plans are deactivated
    if (dto.isActive) {
      await this.deactivateAllPlans(cleanUser);
    }

    const plansRef = collection(this.fb.db, this.collectionName);
    const docData = {
      username: cleanUser,
      title: dto.title.trim(),
      description: dto.description?.trim() || '',
      isActive: Boolean(dto.isActive),
      days: dto.days || this.getDefaultWorkoutDays(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    const docRef = await addDoc(plansRef, docData);

    return {
      id: docRef.id,
      username: cleanUser,
      title: docData.title,
      description: docData.description,
      isActive: docData.isActive,
      days: docData.days,
      createdDate: new Date().toISOString(),
      updatedDate: new Date().toISOString()
    };
  }

  /**
   * Update an existing training plan
   */
  async updateTrainingPlan(planId: string, dto: UpdateTrainingPlanDto, username: string): Promise<void> {
    if (!planId) throw new Error('Plan ID is required for update.');
    const cleanUser = username?.trim().toLowerCase();

    if (dto.isActive && cleanUser) {
      await this.deactivateAllPlans(cleanUser, planId);
    }

    const docRef = doc(this.fb.db, this.collectionName, planId);
    const updateData: Record<string, any> = {
      updatedAt: serverTimestamp()
    };

    if (dto.title !== undefined) updateData['title'] = dto.title.trim();
    if (dto.description !== undefined) updateData['description'] = dto.description.trim();
    if (dto.isActive !== undefined) updateData['isActive'] = Boolean(dto.isActive);
    if (dto.days !== undefined) updateData['days'] = dto.days;

    await updateDoc(docRef, updateData);
  }

  /**
   * Set plan as the user's active training plan
   */
  async setActivePlan(planId: string, username: string): Promise<void> {
    const cleanUser = username?.trim().toLowerCase();
    if (!cleanUser) throw new Error('Username required.');
    await this.deactivateAllPlans(cleanUser, planId);
    const docRef = doc(this.fb.db, this.collectionName, planId);
    await updateDoc(docRef, {
      isActive: true,
      updatedAt: serverTimestamp()
    });
  }

  /**
   * Delete training plan
   */
  async deleteTrainingPlan(planId: string): Promise<void> {
    if (!planId) throw new Error('Plan ID is required to delete.');
    const docRef = doc(this.fb.db, this.collectionName, planId);
    await deleteDoc(docRef);
  }

  /**
   * Deactivate other user plans to ensure a single active plan
   */
  private async deactivateAllPlans(username: string, excludePlanId?: string): Promise<void> {
    const plans = await this.getTrainingPlans(username);
    const deactivations = plans
      .filter((p) => p.id !== excludePlanId && p.isActive)
      .map((p) => {
        if (!p.id) return Promise.resolve();
        const docRef = doc(this.fb.db, this.collectionName, p.id);
        return updateDoc(docRef, { isActive: false, updatedAt: serverTimestamp() });
      });

    await Promise.all(deactivations);
  }

  private mapDocToTrainingPlan(id: string, data: any): TrainingPlan {
    let createdDate = new Date().toISOString();
    let updatedDate = new Date().toISOString();

    if (data['createdAt'] instanceof Timestamp) {
      createdDate = data['createdAt'].toDate().toISOString();
    }
    if (data['updatedAt'] instanceof Timestamp) {
      updatedDate = data['updatedAt'].toDate().toISOString();
    }

    return {
      id,
      username: data['username'] || '',
      title: data['title'] || '',
      description: data['description'] || '',
      isActive: Boolean(data['isActive']),
      days: Array.isArray(data['days']) ? data['days'] : [],
      createdDate,
      updatedDate
    };
  }
}
