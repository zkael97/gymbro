import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../auth.service';

export interface GymMoveItem {
  id?: string;
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
  reps: number;
  date: string;
  createdDate?: string;
}

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
  activeMenu = 'tracker';
  isBackOfficeOpen = true;
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
  logReps: number | null = null;
  logDate = this.getTodayDateString();

  // Helper to get local YYYY-MM-DD regardless of UTC timezone offset
  private getTodayDateString(): string {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Toast Alert Notification (Success / Error)
  showAlertNotification = signal<boolean>(false);
  alertType = signal<'success' | 'error'>('success');
  alertMessage = signal<string>('');
  private alertTimer: any = null;

  readonly upperCategories = ['Chest', 'Back', 'Shoulders', 'Arms', 'Others'];
  readonly lowerCategories = ['Quadriceps', 'Hamstring', 'Glutes', 'Calves', 'Others'];

  constructor(
    private http: HttpClient,
    private router: Router,
    private auth: AuthService
  ) { }

  ngOnInit(): void {
    this.username = this.auth.getUsername();
    this.loadGymMoves();
    this.loadWorkoutLogs();
  }

  loadGymMoves(): void {
    this.http.get<GymMoveItem[]>('http://localhost:8080/api/gym-moves').subscribe({
      next: (data) => {
        this.gymMoves.set(data || []);
      },
      error: (err) => {
        console.error('Failed to load gym moves', err);
      }
    });
  }

  loadWorkoutLogs(): void {
    const user = this.username || '';
    this.http.get<WorkoutLogItem[]>(`http://localhost:8080/api/workout-logs?username=${encodeURIComponent(user)}`).subscribe({
      next: (data) => {
        this.workoutLogs.set(data || []);
      },
      error: (err) => {
        console.error('Failed to load workout logs', err);
      }
    });
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
    this.logReps = null;
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
    if (this.logReps === null || this.logReps <= 0) {
      this.addLogError = 'Jumlah repetisi harus lebih dari 0.';
      return;
    }

    const selectedMove = this.gymMoves().find((m) => m.id === this.logMoveId);
    const moveTitle = selectedMove ? selectedMove.title : 'Exercise';

    this.isSubmittingLog.set(true);
    const payload = {
      username: this.username || 'user',
      moveId: this.logMoveId,
      moveTitle,
      weight: this.logWeight || 0,
      reps: Number(this.logReps),
      date: this.logDate || new Date().toISOString().substring(0, 10)
    };

    try {
      const response = await fetch('http://localhost:8080/api/workout-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.message || `Server returned ${response.status}`);
      }

      const newLog = await response.json();
      this.isSubmittingLog.set(false);
      this.workoutLogs.update((list) => [newLog, ...list]);
      this.showAddLogModal.set(false);

      this.triggerAlert('success', `Latihan "${newLog.moveTitle}" berhasil dicatat di Tracker!`);
    } catch (err: any) {
      this.isSubmittingLog.set(false);
      this.showAddLogModal.set(false);
      const msg = err?.message?.includes('Failed to fetch')
        ? 'Gagal menyimpan catatan karena masalah jaringan/koneksi terputus.'
        : (err?.message || 'Gagal menyimpan catatan latihan.');
      this.triggerAlert('error', msg);
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
    const payload = {
      title: this.moveTitle.trim(),
      description: this.moveDescription.trim(),
      type: this.moveType,
      category: this.moveCategory
    };

    try {
      const response = await fetch('http://localhost:8080/api/gym-moves', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.message || `Server returned ${response.status}`);
      }

      const newMove = await response.json();

      // Immediately close modal form, update list, and trigger 5s alert
      this.isSubmittingMove.set(false);
      this.gymMoves.update((list) => [newMove, ...list]);
      this.showAddModal.set(false);

      this.triggerAlert('success', `Gerakan "${newMove.title}" berhasil disimpan!`);
    } catch (err: any) {
      this.isSubmittingMove.set(false);
      this.showAddModal.set(false);

      const errorMessage =
        err?.message?.includes('Failed to fetch') || err?.message?.includes('NetworkError')
          ? 'Gagal menyimpan gerakan karena masalah jaringan atau koneksi server terputus.'
          : (err?.message || 'Gagal menyimpan gerakan ke server.');

      this.triggerAlert('error', errorMessage);
    }
  }

  toggleBackOffice(): void {
    this.isBackOfficeOpen = !this.isBackOfficeOpen;
  }

  toggleMobileSidebar(): void {
    this.isMobileSidebarOpen.update((v) => !v);
  }

  closeMobileSidebar(): void {
    this.isMobileSidebarOpen.set(false);
  }

  setActive(menu: string): void {
    this.activeMenu = menu;
    this.closeMobileSidebar();
  }

  signOut(): void {
    this.http.post<any>('http://localhost:8080/api/logout', {}).subscribe({
      next: () => {
        this.auth.clearUser();
        this.router.navigate(['/login']);
      },
      error: () => {
        // Even if API call fails, clear local session and redirect
        this.auth.clearUser();
        this.router.navigate(['/login']);
      }
    });
  }
}
