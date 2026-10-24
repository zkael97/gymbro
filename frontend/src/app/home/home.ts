import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../auth.service';
import { FirebaseService, GymMoveItem, WorkoutLogItem } from '../firebase.service';
import { TrainingPlanList } from '../training-plan/training-plan-list';

export interface DateGroupedLogs {
  date: string;
  formattedDate: string;
  logs: WorkoutLogItem[];
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, TrainingPlanList],
  templateUrl: './home.html',
  styleUrl: './home.css'
})
export class Home implements OnInit {
  username: string | null = '';
  activeMenu = signal<string>('dashboard');
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
  deletingLogId = signal<string | null>(null);
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

  // Helper untuk menentukan tipe gerakan (upper/lower) dari gymMoves
  getMoveType(moveId?: string, moveTitle?: string): 'upper' | 'lower' {
    if (moveId) {
      const match = this.gymMoves().find((m) => m.id === moveId);
      if (match?.type) {
        return match.type.toLowerCase() === 'lower' ? 'lower' : 'upper';
      }
    }
    if (moveTitle) {
      const match = this.gymMoves().find((m) => m.title.trim().toLowerCase() === moveTitle.trim().toLowerCase());
      if (match?.type) {
        return match.type.toLowerCase() === 'lower' ? 'lower' : 'upper';
      }
    }
    return 'upper';
  }

  // Icon gerakan: kaki (🦵) untuk lower, badan atas / otot dada-lengan (💪 / 🏋️) untuk upper
  getMoveIcon(moveId?: string, moveTitle?: string): string {
    const type = this.getMoveType(moveId, moveTitle);
    return type === 'lower' ? '🦵' : '💪';
  }

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

  // Hitung jumlah terpanjang hari berturut-turut (max streak) latihan
  get longestGymStreak(): number {
    const logs = this.workoutLogs();
    if (!logs.length) return 0;

    // Kumpulkan tanggal unik dan urutkan secara kronologis (ascending)
    const uniqueDates = Array.from(new Set(logs.map(log => log.date))).filter(Boolean).sort();
    if (!uniqueDates.length) return 0;

    let maxStreak = 1;
    let currentStreak = 1;

    for (let i = 1; i < uniqueDates.length; i++) {
      const prevDate = new Date(uniqueDates[i - 1] + 'T00:00:00');
      const currDate = new Date(uniqueDates[i] + 'T00:00:00');
      const diffDays = Math.round((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        currentStreak++;
        if (currentStreak > maxStreak) {
          maxStreak = currentStreak;
        }
      } else if (diffDays > 1) {
        currentStreak = 1;
      }
    }

    return maxStreak;
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

    if (!this.username) {
      this.addLogError = 'Sesi tidak valid, silakan login ulang.';
      return;
    }

    this.isSubmittingLog.set(true);

    try {
      const newLog = await this.firebaseService.addWorkoutLog({
        username: this.username,
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

  async deleteWorkoutLog(log: WorkoutLogItem, event?: Event): Promise<void> {
    if (event) {
      event.stopPropagation();
    }
    if (!log.id) {
      this.triggerAlert('error', 'ID catatan latihan tidak valid.');
      return;
    }

    const confirmDelete = window.confirm(`Apakah Anda yakin ingin menghapus catatan latihan "${log.moveTitle}"?`);
    if (!confirmDelete) {
      return;
    }

    const targetId = log.id;
    this.deletingLogId.set(targetId);

    try {
      await this.firebaseService.deleteWorkoutLog(targetId);
      this.workoutLogs.update((list) => list.filter((item) => item.id !== targetId));
      this.triggerAlert('success', `Catatan latihan "${log.moveTitle}" berhasil dihapus!`);
    } catch (err: any) {
      this.triggerAlert('error', err?.message || 'Gagal menghapus catatan latihan.');
    } finally {
      this.deletingLogId.set(null);
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

  // Track which move ID is currently being deleted
  deletingMoveId = signal<string | null>(null);

  async deleteMove(move: GymMoveItem, event?: Event): Promise<void> {
    if (event) {
      event.stopPropagation();
    }
    if (!move.id) {
      this.triggerAlert('error', 'ID gerakan tidak valid.');
      return;
    }

    const confirmDelete = window.confirm(`Apakah Anda yakin ingin menghapus gerakan "${move.title}"?`);
    if (!confirmDelete) {
      return;
    }

    const targetId = move.id;
    this.deletingMoveId.set(targetId);

    try {
      await this.firebaseService.deleteGymMove(targetId);
      // Only remove the move with the exact unique document ID so identical moves remain untouched
      this.gymMoves.update((list) => list.filter((item) => item.id !== targetId));
      this.triggerAlert('success', `Gerakan "${move.title}" berhasil dihapus!`);
    } catch (err: any) {
      this.triggerAlert('error', err?.message || 'Gagal menghapus gerakan.');
    } finally {
      this.deletingMoveId.set(null);
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
