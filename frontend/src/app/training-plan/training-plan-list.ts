import { Component, OnInit, OnDestroy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { AuthService } from '../auth.service';
import { FirebaseService, GymMoveItem } from '../firebase.service';
import { TrainingPlanService } from '../services/training-plan.service';
import { TrainingPlan, WorkoutDay } from '../models/training-plan.model';
import { TrainingPlanFormModal } from './training-plan-form-modal/training-plan-form-modal';

@Component({
  selector: 'app-training-plan-list',
  standalone: true,
  imports: [CommonModule, TrainingPlanFormModal],
  templateUrl: './training-plan-list.html',
  styleUrl: './training-plan-list.css'
})
export class TrainingPlanList implements OnInit, OnDestroy {
  private auth = inject(AuthService);
  private planService = inject(TrainingPlanService);
  private fb = inject(FirebaseService);

  username: string = '';
  plans = signal<TrainingPlan[]>([]);
  gymMoves = signal<GymMoveItem[]>([]);
  isLoading = signal<boolean>(true);
  isSubmitting = signal<boolean>(false);
  errorMessage = signal<string>('');

  // Modals / Selected plan view
  selectedPlanForEdit = signal<TrainingPlan | null>(null);
  showFormModal = signal<boolean>(false);
  deletingPlanId = signal<string | null>(null);
  activatingPlanId = signal<string | null>(null);

  private plansSub?: Subscription;

  ngOnInit(): void {
    this.username = this.auth.getUsername() || '';

    if (this.username) {
      this.subscribePlans();
      this.loadGymMoves();
    } else {
      this.isLoading.set(false);
    }
  }

  ngOnDestroy(): void {
    this.plansSub?.unsubscribe();
  }

  private subscribePlans(): void {
    this.isLoading.set(true);
    this.plansSub = this.planService.getTrainingPlans$(this.username).subscribe({
      next: (data) => {
        this.plans.set(data);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error fetching training plans:', err);
        this.errorMessage.set('Failed to load training plans.');
        this.isLoading.set(false);
      }
    });
  }

  private async loadGymMoves(): Promise<void> {
    try {
      const moves = await this.fb.getGymMoves(this.username);
      this.gymMoves.set(moves);
    } catch (e) {
      console.error('Error loading gym moves for plan builder:', e);
    }
  }

  openCreateModal(): void {
    this.selectedPlanForEdit.set(null);
    this.showFormModal.set(true);
  }

  openEditModal(plan: TrainingPlan, event?: Event): void {
    if (event) event.stopPropagation();
    this.selectedPlanForEdit.set(plan);
    this.showFormModal.set(true);
  }

  closeFormModal(): void {
    this.showFormModal.set(false);
    this.selectedPlanForEdit.set(null);
  }

  async handleSavePlan(formData: Partial<TrainingPlan>): Promise<void> {
    this.isSubmitting.set(true);
    try {
      const editing = this.selectedPlanForEdit();
      if (editing && editing.id) {
        await this.planService.updateTrainingPlan(
          editing.id,
          {
            title: formData.title,
            description: formData.description,
            isActive: formData.isActive,
            days: formData.days
          },
          this.username
        );
      } else {
        await this.planService.createTrainingPlan({
          username: this.username,
          title: formData.title || 'My Training Plan',
          description: formData.description || '',
          isActive: formData.isActive ?? true,
          days: formData.days || this.planService.getDefaultWorkoutDays()
        });
      }
      this.closeFormModal();
    } catch (error: any) {
      console.error('Failed to save training plan:', error);
      alert(error.message || 'Error saving training plan');
    } finally {
      this.isSubmitting.set(false);
    }
  }

  async setAsActive(plan: TrainingPlan, event: Event): Promise<void> {
    event.stopPropagation();
    if (!plan.id) return;
    this.activatingPlanId.set(plan.id);
    try {
      await this.planService.setActivePlan(plan.id, this.username);
    } catch (error) {
      console.error('Failed to set active plan:', error);
    } finally {
      this.activatingPlanId.set(null);
    }
  }

  async deletePlan(plan: TrainingPlan, event: Event): Promise<void> {
    event.stopPropagation();
    if (!plan.id) return;
    if (!confirm(`Are you sure you want to delete "${plan.title}"?`)) return;

    this.deletingPlanId.set(plan.id);
    try {
      await this.planService.deleteTrainingPlan(plan.id);
    } catch (error) {
      console.error('Failed to delete training plan:', error);
    } finally {
      this.deletingPlanId.set(null);
    }
  }

  countExercises(plan: TrainingPlan): number {
    if (!plan.days) return 0;
    return plan.days.reduce((total, d) => total + (d.exercises?.length || 0), 0);
  }

  countActiveDays(plan: TrainingPlan): number {
    if (!plan.days) return 0;
    return plan.days.filter((d) => !d.isRestDay).length;
  }
}
