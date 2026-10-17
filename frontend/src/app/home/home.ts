import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../auth.service';
import { FirebaseService, GymMoveItem, WorkoutLogItem } from '../firebase.service';

export interface DateGroupedLogs {
  date: string;
  formattedDate: string;
  logs: WorkoutLogItem[];
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './home.html',
  styleUrl: './home.css'
})
export class Home implements OnInit {
  username: string | null = '';
  activeMenu = signal<string>('tracker');
  isMobileSidebarOpen = signal<boolean>(false);

  // Gym Move State as Signals for instant synchronous UI re-rendering
  gymMoves = signal<GymMoveItem[]>([]);
  showAddModal = signal<boolean>(false);
  isSubmittingMove = signal<boolean>(false);

  // Form inputs (Add Gym Move)
  moveTitle = '';
  moveDescription = '';
  moveType = '';
  moveCategory = '';
  addError = '';

  // Workout Log / Tracker State
  workoutLogs = signal<WorkoutLogItem[]>([]);
  showAddLogModal = signal<boolean>(false);
  isSubmittingLog = signal<boolean>(false);
  addLogError = '';

  // Form inputs (Add Move to Tracker)
  logMoveId = '';
  logWeight: number | null = null;
  logReps1: number | null = null;
  logReps2: number | null = null;
  logReps3: number | null = null;
  logDate = this.getTodayDateString();

  // Helper to get local YYYY-MM-DD regardless of UTC timezone offset
  private getTodayDateString(): string {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Helper to format reps (weight in kg per repetition/set) for display
  formatReps(reps: number[] | number | undefined): string {
    if (Array.isArray(reps)) {
      return reps.length > 0 ? reps.map((r) => `${r} kg`).join(', ') : '0 kg';
    }
    return reps !== undefined && reps !== null ? `${reps} kg` : '0 kg';
  }

  // Toast Alert Notification (Success / Error)
  showAlertNotification = signal<boolean>(false);
  alertType = signal<'success' | 'error'>('success');
  alertMessage = signal<string>('');
  private alertTimer: any = null;

  readonly upperCategories = ['Chest', 'Back', 'Shoulders', 'Arms', 'Others'];
  readonly lowerCategories = ['Quadriceps', 'Hamstring', 'Glutes', 'Calves', 'Others'];

  constructor(
    private router: Router,
    private auth: AuthService,
    private firebaseService: FirebaseService
  ) { }

  ngOnInit(): void {
    this.username = this.auth.getUsername();
    this.loadGymMoves();
    this.loadWorkoutLogs();
  }

  async loadGymMoves(): Promise<void> {
    try {
      const data = await this.firebaseService.getGymMoves(this.username || '');
      this.gymMoves.set(data || []);
    } catch (err) {
      console.error('Failed to load gym moves', err);
    }
  }

  async loadWorkoutLogs(): Promise<void> {
    try {
      const data = await this.firebaseService.getWorkoutLogs(this.username || '');
      this.workoutLogs.set(data || []);
    } catch (err) {
      console.error('Failed to load workout logs', err);
    }
  }

  // Group workout logs by date (descending: newest date first)
  get groupedWorkoutLogs(): DateGroupedLogs[] {
    const logs = this.workoutLogs();
    const groups: { [date: string]: WorkoutLogItem[] } = {};

    for (const log of logs) {
      if (!groups[log.date]) {
        groups[log.date] = [];
      }
      groups[log.date].push(log);
    }

    const todayStr = new Date().toISOString().substring(0, 10);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().substring(0, 10);

    const sortedDates = Object.keys(groups).sort((a, b) => b.localeCompare(a));

    return sortedDates.map((dateStr) => {
      let formattedDate = dateStr;
      if (dateStr === todayStr) {
        formattedDate = 'Hari Ini (' + dateStr + ')';
      } else if (dateStr === yesterdayStr) {
        formattedDate = 'Kemarin (' + dateStr + ')';
      } else {
        const d = new Date(dateStr + 'T00:00:00');
        formattedDate = d.toLocaleDateString('id-ID', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      }

      return {
        date: dateStr,
        formattedDate,
        logs: groups[dateStr]
      };
    });
  }

  openAddLogModal(): void {
    const moves = this.gymMoves();
    this.logMoveId = moves.length > 0 ? (moves[0].id || '') : '';
    this.logWeight = null;
    this.logReps1 = null;
    this.logReps2 = null;
    this.logReps3 = null;
    this.logDate = this.getTodayDateString();
    this.addLogError = '';
    this.showAddLogModal.set(true);
  }

  closeAddLogModal(): void {
    this.showAddLogModal.set(false);
    this.addLogError = '';
  }

  async saveWorkoutLog(): Promise<void> {
    this.addLogError = '';
    if (!this.logMoveId) {
      this.addLogError = 'Silakan pilih gerakan olahraga.';
      return;
    }
    if (this.logReps1 === null || this.logReps1 === undefined || this.logReps1 <= 0) {
      this.addLogError = 'Repetisi 1 wajib diisi dan harus lebih dari 0.';
      return;
    }

    const repsArray: number[] = [Number(this.logReps1)];
    if (this.logReps2 !== null && this.logReps2 !== undefined && this.logReps2 > 0) {
      repsArray.push(Number(this.logReps2));
    }
    if (this.logReps3 !== null && this.logReps3 !== undefined && this.logReps3 > 0) {
      repsArray.push(Number(this.logReps3));
    }

    const selectedMove = this.gymMoves().find((m) => m.id === this.logMoveId);
    const moveTitle = selectedMove ? selectedMove.title : 'Exercise';

    this.isSubmittingLog.set(true);

    try {
      const newLog = await this.firebaseService.addWorkoutLog({
        username: this.username || 'user',
        moveId: this.logMoveId,
        moveTitle,
        weight: this.logWeight || 0,
        reps: repsArray,
        date: this.logDate || new Date().toISOString().substring(0, 10)
      });

      this.isSubmittingLog.set(false);
      this.workoutLogs.update((list) => [newLog, ...list]);
      this.showAddLogModal.set(false);

      this.triggerAlert('success', `Latihan "${newLog.moveTitle}" berhasil dicatat di Tracker!`);
    } catch (err: any) {
      this.isSubmittingLog.set(false);
      this.showAddLogModal.set(false);
      this.triggerAlert('error', err?.message || 'Gagal menyimpan catatan latihan.');
    }
  }

  get availableCategories(): string[] {
    if (this.moveType === 'upper') {
      return this.upperCategories;
    } else if (this.moveType === 'lower') {
      return this.lowerCategories;
    }
    return [];
  }

  onTypeChange(): void {
    this.moveCategory = '';
  }

  openAddModal(): void {
    this.moveTitle = '';
    this.moveDescription = '';
    this.moveType = 'upper';
    this.moveCategory = this.upperCategories[0];
    this.addError = '';
    this.showAddModal.set(true);
  }

  closeAddModal(): void {
    this.showAddModal.set(false);
    this.addError = '';
  }

  triggerAlert(type: 'success' | 'error', message: string): void {
    if (this.alertTimer) {
      clearTimeout(this.alertTimer);
    }
    this.alertType.set(type);
    this.alertMessage.set(message);
    this.showAlertNotification.set(true);

    // Auto dismiss after 5 seconds
    this.alertTimer = setTimeout(() => {
      this.closeAlert();
    }, 5000);
  }

  closeAlert(): void {
    if (this.alertTimer) {
      clearTimeout(this.alertTimer);
      this.alertTimer = null;
    }
    this.showAlertNotification.set(false);
  }

  async saveGymMove(): Promise<void> {
    this.addError = '';
    if (!this.moveTitle.trim()) {
      this.addError = 'Title is required';
      return;
    }
    if (!this.moveType) {
      this.addError = 'Please select a type (upper or lower)';
      return;
    }
    if (!this.moveCategory) {
      this.addError = 'Please select a category';
      return;
    }

    this.isSubmittingMove.set(true);

    try {
      const newMove = await this.firebaseService.addGymMove({
        username: this.username || '',
        title: this.moveTitle.trim(),
        description: this.moveDescription.trim(),
        type: this.moveType,
        category: this.moveCategory
      });

      this.isSubmittingMove.set(false);
      this.gymMoves.update((list) => [newMove, ...list]);
      this.showAddModal.set(false);

      this.triggerAlert('success', `Gerakan "${newMove.title}" berhasil disimpan!`);
    } catch (err: any) {
      this.isSubmittingMove.set(false);
      this.showAddModal.set(false);
      this.triggerAlert('error', err?.message || 'Gagal menyimpan gerakan ke server.');
    }
  }

  toggleMobileSidebar(): void {
    this.isMobileSidebarOpen.update((v) => !v);
  }

  closeMobileSidebar(): void {
    this.isMobileSidebarOpen.set(false);
  }

  setActive(menu: string): void {
    this.activeMenu.set(menu);
    this.closeMobileSidebar();
  }

  signOut(): void {
    this.auth.clearUser();
    this.router.navigate(['/login']);
  }
}
